/**
 * Global Jest setup: fresh database per test + mocks for native modules that
 * have no Node implementation. Component-specific mocks (expo-router params,
 * document picker results) live in the individual test files.
 */

import { resetTestDb } from "./db-client.mock";

beforeEach(() => {
  resetTestDb();
});

// react-native-keyboard-controller ships an official Jest mock.
jest.mock("react-native-keyboard-controller", () =>
  require("react-native-keyboard-controller/jest")
);

// expo-haptics: no-op.
jest.mock(
  "expo-haptics",
  () => ({
    impactAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  }),
  { virtual: true }
);

// The native date picker renders nothing in tests.
jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => React.createElement(React.Fragment),
  };
});

// lucide-react-native exports hundreds of SVG icon components; replace each
// with a render-nothing stub via a Proxy so imports of any icon name work.
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const cache = new Map<string, unknown>();
  const stub = (name: string) => {
    if (!cache.has(name)) {
      const Icon = () => React.createElement(React.Fragment);
      Icon.displayName = name;
      cache.set(name, Icon);
    }
    return cache.get(name);
  };
  return new Proxy(
    {},
    { get: (_t, prop: string) => (prop === "__esModule" ? true : stub(prop)) }
  );
});

// react-native-svg: minimal stubs for the donut chart.
jest.mock("react-native-svg", () => {
  const React = require("react");
  const stub = () => React.createElement(React.Fragment);
  return { __esModule: true, default: stub, Svg: stub, Circle: stub };
});
