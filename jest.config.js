/** Jest config: jest-expo preset + real-SQLite data layer (see docs/TESTING.md). */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  moduleNameMapper: {
    // Every import of the app's db singleton gets the in-memory test database.
    // db/queries.ts and db/use-database.ts import it RELATIVELY ("./client"),
    // so both specifier shapes are mapped; no other module is named client.
    "^@/db/client$": "<rootDir>/test/db-client.mock.ts",
    "^\\./client$": "<rootDir>/test/db-client.mock.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native|react-native-keyboard-controller|react-native-css-interop))",
  ],
  testMatch: ["<rootDir>/__tests__/**/*.test.(ts|tsx)"],
  // The e2e/ directory holds Maestro YAML flows, not Jest tests.
  testPathIgnorePatterns: ["/node_modules/", "/e2e/", "/.drive/"],
};
