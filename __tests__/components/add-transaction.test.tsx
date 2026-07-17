/**
 * The add/edit-transaction screen, rendered for real over the test database.
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
  getTransaction,
  getTransactionsPage,
  listCategoryTree,
  listWallets,
} from "@/db/queries";

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockParams = { current: {} as Record<string, string> };

// Getters defer property access until call time — the screen module is
// imported (and the factory runs) before these consts are initialized.
jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams.current,
}));

import AddTransaction from "@/app/add-transaction";

beforeEach(async () => {
  mockRouter.back.mockClear();
  mockParams.current = {};
  await ensureDefaults(db);
});

async function renderScreen() {
  render(<AddTransaction />);
  // Wait for wallets + categories to load (loading spinner gone).
  await waitFor(() => expect(screen.getByText("Wallet")).toBeTruthy());
}

/** The ModalHeader's ✓ save button. */
function pressSave() {
  fireEvent.press(screen.getByLabelText("Save"));
}

describe("new transaction", () => {
  it("renders collapsed by default: summary row, no category rows", async () => {
    await renderScreen();
    expect(screen.getByText("Choose category")).toBeTruthy();
    expect(screen.queryByText("Housing")).toBeNull();
  });

  it("expands the picker, selects a category and shows its subcategories", async () => {
    await renderScreen();
    fireEvent.press(screen.getByText("Choose category"));
    expect(screen.getByText("Housing")).toBeTruthy();

    fireEvent.press(screen.getByText("Food"));
    // Subs unfold and the summary shows the selection.
    expect(screen.getByText("Groceries")).toBeTruthy();
    expect(screen.queryByText("Choose category")).toBeNull();
  });

  it("collapses the whole picker once a subcategory is picked", async () => {
    await renderScreen();
    fireEvent.press(screen.getByText("Choose category"));
    fireEvent.press(screen.getByText("Food"));
    // Picker is open: both the summary and the list show Groceries.
    expect(screen.getByText("Groceries")).toBeTruthy();
    fireEvent.press(screen.getByText("Groceries"));
    // Now collapsed: the list rows are gone, so the sibling "Housing" category
    // is no longer rendered, and the summary reads the chosen subcategory.
    expect(screen.queryByText("Housing")).toBeNull();
    expect(screen.getByText("Groceries")).toBeTruthy();
  });

  it("keeps the picker open and re-refines after toggling a subcategory off", async () => {
    await renderScreen();
    fireEvent.press(screen.getByText("Choose category"));
    fireEvent.press(screen.getByText("Food"));
    fireEvent.press(screen.getByText("Groceries")); // pick → collapses
    // Re-open: the summary and the list both read Groceries now.
    fireEvent.press(screen.getByText("Groceries"));
    const rows = screen.getAllByText("Groceries");
    // Toggle the selected subcategory (the list row) off — picker stays open.
    fireEvent.press(rows[rows.length - 1]);
    expect(screen.getByText("Housing")).toBeTruthy();
  });

  it("switching direction clears the selection and collapses the picker", async () => {
    await renderScreen();
    fireEvent.press(screen.getByText("Choose category"));
    fireEvent.press(screen.getByText("Food"));
    fireEvent.press(screen.getByText("Expense")); // toggle to income
    expect(screen.getByText("Income")).toBeTruthy();
    expect(screen.getByText("Choose category")).toBeTruthy();
  });

  it("rejects saving without an amount", async () => {
    const alertSpy = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    await renderScreen();
    pressSave();
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Enter an amount",
        expect.any(String)
      )
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(await getTransactionsPage(0, 10)).toHaveLength(0);
    alertSpy.mockRestore();
  });

  it("saves a complete expense to the database and navigates back", async () => {
    await renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "24.50");
    fireEvent.press(screen.getByText("Choose category"));
    fireEvent.press(screen.getByText("Food"));
    fireEvent.press(screen.getByText("Groceries"));

    pressSave();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const [tx] = await getTransactionsPage(0, 10);
    expect(tx.amount).toBe(-2450);
    expect(tx.title).toBe("Groceries");
    expect(tx.categoryName).toBe("Food");
  });

  it("preselects the wallet passed from the home screen", async () => {
    const { addWallet } = require("@/db/queries");
    const second = await addWallet({
      name: "Savings",
      currency: "EUR",
      initialBalance: 0,
    });
    mockParams.current = { walletId: second };
    await renderScreen();
    expect(screen.getByText("Savings · EUR")).toBeTruthy();
  });

  it("tapping the wallet row opens the wallet dialog even with one wallet", async () => {
    await renderScreen();
    fireEvent.press(screen.getByText("Cash · USD"));
    expect(screen.getByText("Switch wallet")).toBeTruthy();
  });

  it("selecting a wallet in the dialog updates the row and currency symbol", async () => {
    const { addWallet } = require("@/db/queries");
    await addWallet({ name: "Dinars", currency: "DZD", initialBalance: 0 });
    await renderScreen();
    fireEvent.press(screen.getByText("Cash · USD"));
    fireEvent.press(screen.getByText("Dinars"));
    expect(screen.getByText("Dinars · DZD")).toBeTruthy();
    expect(screen.getByText("DA")).toBeTruthy();
  });
});

describe("edit transaction", () => {
  it("prefills fields, opens the picker on the saved category, and updates", async () => {
    const [w] = await listWallets();
    const tree = await listCategoryTree("expense");
    const food = tree.find((c) => c.name === "Food")!;
    const groceries = food.subs.find((s) => s.name === "Groceries")!;
    const id = await addTransaction({
      walletId: w.id,
      categoryId: food.id,
      subcategoryId: groceries.id,
      amount: 1000,
      direction: "expense",
      title: "Old title",
      note: "old note",
      date: new Date(2026, 6, 1),
    });
    mockParams.current = { id };
    await renderScreen();

    expect(screen.getByText("Edit transaction")).toBeTruthy();
    // Picker opened up front: "Groceries" appears in BOTH the summary row and
    // the unfolded subcategory list.
    await waitFor(() =>
      expect(screen.getAllByText("Groceries").length).toBeGreaterThanOrEqual(2)
    );
    // More options auto-expanded because a title/note exists.
    expect(screen.getByDisplayValue("Old title")).toBeTruthy();
    expect(screen.getByDisplayValue("old note")).toBeTruthy();
    expect(screen.getByDisplayValue("10.00")).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue("10.00"), "12.00");
    pressSave();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await getTransaction(id))!.amount).toBe(1200);
  });
});
