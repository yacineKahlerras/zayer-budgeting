/**
 * The wallet editor: current-balance editing logs an adjustment transaction.
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import { db } from "@/db/client";
import {
  addTransaction,
  addWallet,
  getTransactionsPage,
  getWallet,
  getWalletBalance,
} from "@/db/queries";

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockParams = { current: {} as Record<string, string> };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams.current,
}));

import EditWallet from "@/app/edit-wallet";

beforeEach(() => {
  mockRouter.back.mockClear();
  mockParams.current = {};
});

function pressSave() {
  fireEvent.press(screen.getByLabelText("Save"));
}

/** A wallet whose derived balance is `cents` (via initial balance). */
async function walletAt(cents: number, name = "Main", currency = "USD") {
  return addWallet({ name, currency, initialBalance: cents });
}

describe("new wallet", () => {
  it("labels the balance field 'Starting balance' and creates the wallet", async () => {
    const { listWalletsWithBalances } = require("@/db/queries");
    render(<EditWallet />);
    await waitFor(() =>
      expect(screen.getByText("Starting balance")).toBeTruthy()
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Cash, Savings"),
      "Savings"
    );
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "250");
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const list = await listWalletsWithBalances();
    const savings = list.find((x: { name: string }) => x.name === "Savings")!;
    expect(savings.balance).toBe(250_00);
  });
});

describe("edit wallet — balance adjustment", () => {
  async function renderEditing(id: string) {
    mockParams.current = { id };
    render(<EditWallet />);
    await waitFor(() =>
      expect(screen.getByText("Current balance")).toBeTruthy()
    );
  }

  it("prefills the current derived balance, not the initial balance", async () => {
    const id = await walletAt(100_00);
    await addTransaction({
      walletId: id,
      categoryId: null,
      subcategoryId: null,
      amount: 40_00,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    await renderEditing(id);
    // 100 initial − 40 expense = 60 derived.
    expect(screen.getByDisplayValue("60.00")).toBeTruthy();
  });

  it("previews the adjustment that will be logged", async () => {
    const id = await walletAt(100_00);
    await renderEditing(id);
    fireEvent.changeText(screen.getByDisplayValue("100.00"), "50");
    expect(screen.getByText(/expense to match/)).toBeTruthy();
  });

  it("logs a −50 expense when lowering 100 → 50", async () => {
    const id = await walletAt(100_00);
    await renderEditing(id);
    fireEvent.changeText(screen.getByDisplayValue("100.00"), "50");
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getWalletBalance(id)).toBe(50_00);
    const [tx] = await getTransactionsPage(0, 10, id);
    expect(tx.amount).toBe(-50_00);
    expect(tx.title).toBe("Balance adjustment");
  });

  it("logs an income when raising the balance", async () => {
    const id = await walletAt(20_00);
    await renderEditing(id);
    fireEvent.changeText(screen.getByDisplayValue("20.00"), "75");
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getWalletBalance(id)).toBe(75_00);
    const [tx] = await getTransactionsPage(0, 10, id);
    expect(tx.amount).toBe(55_00);
  });

  it("logs nothing when the balance is untouched (name-only edit)", async () => {
    const id = await walletAt(30_00);
    await renderEditing(id);
    fireEvent.changeText(
      screen.getByDisplayValue("Main"),
      "Renamed"
    );
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getTransactionsPage(0, 10, id)).toHaveLength(0);
    expect((await getWallet(id))?.name).toBe("Renamed");
  });

  it("never mutates the stored initial balance", async () => {
    const id = await walletAt(100_00);
    const before = (await getWallet(id))!.initialBalance;
    await renderEditing(id);
    fireEvent.changeText(screen.getByDisplayValue("100.00"), "10");
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await getWallet(id))!.initialBalance).toBe(before);
  });
});
