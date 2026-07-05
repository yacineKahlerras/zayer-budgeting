/**
 * Renders every icon PNG the app needs from the SVG sources in this folder.
 * Run with: node assets/icon-src/generate.js
 *
 * Outputs into ../images/ (the paths app.json points at):
 *   icon.png                        1024  full square, ground + mark (iOS/store)
 *   android-icon-foreground.png     1024  transparent mark (adaptive foreground)
 *   android-icon-background.png     1024  dark ground (adaptive background)
 *   android-icon-monochrome.png     1024  white silhouette (themed icons)
 *   splash-icon.png                  512  transparent mark for the splash screen
 *   favicon.png                       48  small square for web
 */
const sharp = require("sharp");
const path = require("path");

const SRC = __dirname;
const OUT = path.join(__dirname, "..", "images");
const fg = path.join(SRC, "foreground.svg");
const bg = path.join(SRC, "background.svg");
const mono = path.join(SRC, "monochrome.svg");

/** A rounded-square version of the dark ground, for the baked square icon. */
const roundedGround = Buffer.from(
  `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
     <defs><radialGradient id="g" cx="50%" cy="38%" r="72%">
       <stop offset="0" stop-color="#1B2233"/>
       <stop offset="0.55" stop-color="#111624"/>
       <stop offset="1" stop-color="#0B0F1A"/>
     </radialGradient></defs>
     <rect width="1024" height="1024" rx="230" fill="url(#g)"/>
   </svg>`
);

async function main() {
  const fgPng = await sharp(fg).resize(1024, 1024).png().toBuffer();

  // Master square icon: rounded dark ground + centered mark.
  const iconPng = await sharp(roundedGround)
    .composite([{ input: fgPng }])
    .png()
    .toBuffer();
  await sharp(iconPng).toFile(path.join(OUT, "icon.png"));

  // Adaptive foreground (transparent).
  await sharp(fg).resize(1024, 1024).png().toFile(
    path.join(OUT, "android-icon-foreground.png")
  );

  // Adaptive background (full-bleed dark ground, no rounding — the OS masks it).
  await sharp(bg).resize(1024, 1024).png().toFile(
    path.join(OUT, "android-icon-background.png")
  );

  // Monochrome (white silhouette on transparent).
  await sharp(mono).resize(1024, 1024).png().toFile(
    path.join(OUT, "android-icon-monochrome.png")
  );

  // Splash mark (transparent, smaller).
  await sharp(fg).resize(512, 512).png().toFile(
    path.join(OUT, "splash-icon.png")
  );

  // Web favicon (downscale the already-composited square icon).
  await sharp(iconPng).resize(48, 48).png().toFile(
    path.join(OUT, "favicon.png")
  );

  console.log("Icons generated into assets/images/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
