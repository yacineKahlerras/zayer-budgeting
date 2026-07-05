/**
 * Stats screen: period filters, range labels, empty state, breakdown, wallet
 * dialog, animated paging via the stepper.
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import {
  addTransaction,
  addWallet,
  listCategoryTree,
  listWallets,
} from "@/db/queries";

const mockRouter = { back: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    get router() {
      return mockRouter;
    },
    useLocalSearchParams: () => ({}),
    // Focus effects behave like plain effects in tests.
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(cb, [cb]);
    },
  };
});

import StatsScreen from "@/app/(tabs)/stats";

async function seedThisMonth() {
  await ensureDefaults(db);
  const [w] = await listWallets();
  const tree = await listCategoryTree("expense");
  const food = tree.find((c) => c.name === "Food")!;
  const now = new Date();
  await addTransaction({
    walletId: w.id,
    categoryId: food.id,
    subcategoryId: null,
    amount: 30_00,
    direction: "expense",
    title: null,
    note: null,
    date: new Date(now.getFullYear(), now.getMonth(), 1, 12),
  });
  return { w, food };
}

async function renderStats() {
  render(<StatsScreen />);
  await waitFor(() => expect(screen.getByText("Month")).toBeTruthy());
}

describe("StatsScreen", () => {
  it("shows the empty screen when there are no wallets", async () => {
    render(<StatsScreen />);
    await waitFor(() =>
      expect(screen.getByText("No wallets yet")).toBeTruthy()
    );
  });

  it("renders all four period options and the wallet pill", async () => {
    await seedThisMonth();
    await renderStats();
    for (const label of ["Day", "Week", "Month", "Year"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText("USD")).toBeTruthy();
  });

  it("month view shows this month's summary and breakdown", async () => {
    await seedThisMonth();
    await renderStats();
    await waitFor(() => expect(screen.getByText("Food")).toBeTruthy());
    expect(screen.getByText("Income")).toBeTruthy();
    expect(screen.getByText("Expense")).toBeTruthy();
    expect(screen.getAllByText("$30.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("switching to Day shows Today and the centered empty state", async () => {
    await seedThisMonth(); // spend on the 1st, not necessarily today
    await renderStats();
    fireEvent.press(screen.getByText("Day"));
    await waitFor(() => expect(screen.getByText("Today")).toBeTruthy());
    // If today is not the 1st, the day view is empty.
    if (new Date().getDate() !== 1) {
      await waitFor(() =>
        expect(screen.getByText("Nothing spent yet")).toBeTruthy()
      );
    }
  });

  it("year view labels the range with the year", async () => {
    await seedThisMonth();
    await renderStats();
    fireEvent.press(screen.getByText("Year"));
    await waitFor(() =>
      expect(screen.getByText(String(new Date().getFullYear()))).toBeTruthy()
    );
  });

  it("the back chevron pages to the previous period with the slide animation", async () => {
    await seedThisMonth();
    await renderStats();
    fireEvent.press(screen.getByText("Day"));
    await waitFor(() => expect(screen.getByText("Today")).toBeTruthy());

    const chevrons = screen.UNSAFE_root.findAll(
      (n: { props: { onPress?: unknown; hitSlop?: number } }) => typeof n.props.onPress === "function" && n.props.hitSlop === 10
    );
    fireEvent.press(chevrons[0]); // ‹ previous
    await waitFor(
      () => expect(screen.queryByText("Today")).toBeNull(),
      { timeout: 3000 }
    );
  });

  it("the options modal switches the breakdown to the ranked list", async () => {
    await seedThisMonth();
    await renderStats();
    await waitFor(() => expect(screen.getByText("Food")).toBeTruthy());

    // The sliders button is the only hitSlop-10 pressable inside the section
    // header row; open options via its onPress.
    const pressables = screen.UNSAFE_root.findAll(
      (n: { props: { onPress?: unknown; hitSlop?: number } }) => typeof n.props.onPress === "function" && n.props.hitSlop === 10
    );
    // [0]=‹ chevron, [1]=› chevron, [2]=sliders
    fireEvent.press(pressables[2]);
    await waitFor(() => expect(screen.getByText("Ranked list")).toBeTruthy());
    fireEvent.press(screen.getByText("Ranked list"));
    // Ranked list shows an index column ("1").
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
  });

  it("opens the centered wallet dialog from the pill", async () => {
    await seedThisMonth();
    await addWallet({ name: "Dinars", currency: "DZD", initialBalance: 0 });
    await renderStats();
    fireEvent.press(screen.getByText("Cash"));
    await waitFor(() => expect(screen.getByText("Switch wallet")).toBeTruthy());
    fireEvent.press(screen.getByText("Dinars"));
    // Scope switches; the DZD wallet has no data.
    await waitFor(() =>
      expect(screen.getByText("Nothing spent yet")).toBeTruthy()
    );
  });
});
