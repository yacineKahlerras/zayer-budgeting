/**
 * App-wide dark theme. The app is always dark — there is no light variant.
 */

import { Platform } from "react-native";

export const Colors = {
  background: "#0B0F1A",
  card: "#161B27",
  cardElevated: "#1E2433",
  text: "#FFFFFF",
  textMuted: "#8A93A6",
  border: "#252B3A",
  accent: "#3B82F6",
  positive: "#34D399",
  negative: "#F87171",
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
