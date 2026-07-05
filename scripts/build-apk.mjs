/**
 * Build a standalone release APK locally.
 *
 *   npm run apk          full build: sync → deps → prebuild → gradle → dist/
 *   npm run apk -- --fast   skip `expo prebuild` (use when only JS/TS changed,
 *                           NOT after app.json / icon / assets changes)
 *   npm run apk -- --no-deps  skip `npm install` in the build copy
 *
 * WHY a separate build copy (C:\zb): react-native-keyboard-controller's New-Arch
 * C++ codegen produces paths past Windows' 260-char MAX_PATH limit, and ninja
 * ignores LongPathsEnabled. Building from a short path (C:\zb) keeps paths under
 * the limit. See memory: android-build-shortpath.
 *
 * Requirements: Windows, JDK 17 (Android Studio JBR), Android SDK + NDK,
 * the SDK path in BUILD_DIR/android/local.properties.
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";

// ------- config (edit these two if your machine differs) -------------------
const BUILD_DIR = "C:\\zb"; // short path to dodge MAX_PATH
const JAVA_HOME = "C:\\Program Files\\Android\\Android Studio\\jbr";
const SDK_DIR = "C:\\Users\\yacine\\AppData\\Local\\Android\\Sdk";
// ---------------------------------------------------------------------------

const PROJECT = process.cwd();
const args = new Set(process.argv.slice(2));
const FAST = args.has("--fast");
const NO_DEPS = args.has("--no-deps");

// Source trees + root files to mirror into the build copy.
const SRC_DIRS = [
  "app", "assets", "components", "constants", "db", "drizzle", "utils",
  "hooks", "scripts",
];
const ROOT_FILES = [
  "app.json", "package.json", "package-lock.json", "babel.config.js",
  "tsconfig.json", "metro.config.js", "drizzle.config.ts", "expo-env.d.ts",
];

const env = { ...process.env, JAVA_HOME, CI: "1" };
function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env, ...opts });
}
function ps(script) {
  // Run a PowerShell snippet (robocopy/Remove-Item need it on Windows).
  run(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`);
}

console.log(`Building Zayer APK from ${BUILD_DIR}  (fast=${FAST})`);

// 1. Sync source into the build copy (mirror dirs; keep android/ + node_modules).
mkdirSync(BUILD_DIR, { recursive: true });
for (const d of SRC_DIRS) {
  const from = join(PROJECT, d);
  if (existsSync(from)) {
    // robocopy exit codes 0-7 are success; PowerShell must not treat them as errors.
    ps(`robocopy '${from}' '${join(BUILD_DIR, d)}' /MIR /NFL /NDL /NJH /NJS /NP; if ($LASTEXITCODE -lt 8) { exit 0 } else { exit 1 }`);
  }
}
for (const f of ROOT_FILES) {
  const from = join(PROJECT, f);
  if (existsSync(from)) copyFileSync(from, join(BUILD_DIR, f));
}

// 2. Install deps in the build copy.
if (!NO_DEPS) run("npm install --legacy-peer-deps", { cwd: BUILD_DIR });

// 3. Regenerate native android/ from app.json + assets (icon, name, package).
//    Skipped with --fast; REQUIRED after any branding change.
if (!FAST) {
  run("npx expo prebuild --platform android --clean", { cwd: BUILD_DIR });
  // --clean wipes local.properties; restore the SDK path.
  writeFileSync(
    join(BUILD_DIR, "android", "local.properties"),
    `sdk.dir=${SDK_DIR.replace(/\\/g, "\\\\")}\n`
  );
}

// 4. Stop any leftover Gradle daemon so it isn't holding build files open,
//    then clean stale native build outputs.
try {
  run(".\\gradlew --stop", { cwd: join(BUILD_DIR, "android") });
} catch {
  /* no daemon running — fine */
}
ps(`foreach ($d in @('${BUILD_DIR}\\android\\app\\build','${BUILD_DIR}\\android\\app\\.cxx','${BUILD_DIR}\\android\\build')) { if (Test-Path $d) { Remove-Item $d -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue } }`);

// 5. Build the release APK (bundles JS in → standalone; signs with debug key).
//    Lint is skipped: not needed for a personal sideload APK and its cache is
//    the flaky, file-locking part of the build.
run(".\\gradlew :app:assembleRelease -x lintVitalRelease -x lintVitalAnalyzeRelease", {
  cwd: join(BUILD_DIR, "android"),
});

// 6. Deliver to dist/.
const out = join(
  BUILD_DIR, "android", "app", "build", "outputs", "apk", "release",
  "app-release.apk"
);
const version =
  JSON.parse(readFileSync(join(PROJECT, "app.json"), "utf8")).expo.version;
mkdirSync(join(PROJECT, "dist"), { recursive: true });
const dest = join(PROJECT, "dist", `Zayer-${version}-release.apk`);
copyFileSync(out, dest);

console.log(`\n✅ APK ready: dist/Zayer-${version}-release.apk`);
console.log("   Standalone (no Metro). Sideload onto your phone via Files.");
