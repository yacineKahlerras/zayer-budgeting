// Metro configuration for Expo.
// We extend the default config so Drizzle's generated `.sql` migration files
// can be imported as assets (see drizzle/migrations.js). Without this, Metro
// doesn't know how to resolve `import m0000 from './0000_xxx.sql'`.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// `.sql` must be an ASSET (raw text), NOT a source file — otherwise Metro tries
// to parse the SQL as JavaScript and fails with a syntax error.
config.resolver.assetExts.push("sql");

module.exports = config;
