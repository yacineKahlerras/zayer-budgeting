// Babel configuration for Expo.
// The `inline-import` plugin inlines the contents of `.sql` files as strings at
// build time. Drizzle's Expo migrator (drizzle/migrations.js) imports the
// generated `.sql` files and needs their raw text available at runtime on the
// device — this plugin is what makes that work.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [["inline-import", { extensions: [".sql"] }]],
  };
};
