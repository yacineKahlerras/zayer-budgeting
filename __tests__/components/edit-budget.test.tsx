/**
 * The budget editor: period, currency placement, collapsed scope picker.
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
  addBudget,
  addWallet,
  getBudget,
  listBudgetsWithProgress,
  listCategoryTree,
} from "@/db/queries";

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockParams = { current: {} as Record<string, string> };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams.current,
}));

import EditBudget from "@/app/edit-budget";

beforeEach(async () => {
  mockRouter.back.mockClear();
  mockParams.current = {};
  await ensureDefaults(db);
});

async function renderScreen() {
  render(<EditBudget />);
  await waitFor(() => expect(screen.getByText("Resets every")).toBeTruthy());
}

function pressSave() {
  fireEvent.press(screen.getByLabelText("Save"));
}

describe("new budget", () => {
  it("defaults: monthly limit label, Overall scope collapsed, no currency section for one currency", async () => {
    await renderScreen();
    expect(screen.getByText("Monthly limit")).toBeTruthy();
    expect(screen.getByText("Overall")).toBeTruthy(); // collapsed summary
    expect(screen.queryByText("Food")).toBeNull(); // rows hidden
    expect(screen.queryByText("Currency")).toBeNull(); // single-currency user
  });

  it("switching the period renames the limit label", async () => {
    await renderScreen();
    fireEvent.press(screen.getByText("Day"));
    expect(screen.getByText("Daily limit")).toBeTruthy();
    fireEvent.press(screen.getByText("Year"));
    expect(screen.getByText("Yearly limit")).toBeTruthy();
  });

  it("shows currency chips above the scope once the user has several currencies", async () => {
    await addWallet({ name: "Dinars", currency: "DZD", initialBalance: 0 });
    await renderScreen();
    expect(screen.getByText("Currency")).toBeTruthy();
    expect(screen.getByText("USD")).toBeTruthy();
    expect(screen.getByText("DZD")).toBeTruthy();
  });

  it("expands the scope picker: Overall row first, categories with dropdowns", async () => {
    await renderScreen();
    fireEvent.press(screen.getByText("Overall")); // summary → expand
    // Overall appears twice now: summary + row.
    expect(screen.getAllByText("Overall").length).toBe(2);
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Housing")).toBeTruthy();
    // Subcategories only after selecting a category.
    expect(screen.queryByText("Groceries")).toBeNull();
    fireEvent.press(screen.getByText("Food"));
    expect(screen.getByText("Groceries")).toBeTruthy();
  });

  it("saves an Overall monthly budget", async () => {
    await renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "50");
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const [b] = await listBudgetsWithProgress(new Date());
    expect(b).toMatchObject({
      amount: 5000,
      categoryId: null,
      subcategoryId: null,
      period: "month",
    });
  });

  it("saves a category+subcategory day budget", async () => {
    await renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "10");
    fireEvent.press(screen.getByText("Day"));
    fireEvent.press(screen.getByText("Overall")); // expand
    fireEvent.press(screen.getByText("Food"));
    fireEvent.press(screen.getByText("Restaurant"));
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());

    const tree = await listCategoryTree("expense");
    const food = tree.find((c) => c.name === "Food")!;
    const restaurant = food.subs.find((s) => s.name === "Restaurant")!;
    const [b] = await listBudgetsWithProgress(new Date());
    expect(b).toMatchObject({
      categoryId: food.id,
      subcategoryId: restaurant.id,
      period: "day",
    });
  });

  it("rejects a zero amount", async () => {
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
    expect(await listBudgetsWithProgress(new Date())).toEqual([]);
    alertSpy.mockRestore();
  });
});

describe("edit budget", () => {
  it("prefills and opens the scope picker on the saved category", async () => {
    const tree = await listCategoryTree("expense");
    const food = tree.find((c) => c.name === "Food")!;
    const groceries = food.subs.find((s) => s.name === "Groceries")!;
    const id = await addBudget({
      name: null,
      amount: 7500,
      categoryId: food.id,
      subcategoryId: groceries.id,
      period: "year",
      currency: "USD",
    });
    mockParams.current = { id };
    await renderScreen();

    expect(screen.getByText("Edit budget")).toBeTruthy();
    expect(screen.getByText("Yearly limit")).toBeTruthy();
    expect(screen.getByDisplayValue("75.00")).toBeTruthy();
    // Picker open with the saved sub visible: summary + sub row.
    expect(screen.getAllByText("Groceries").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Delete budget")).toBeTruthy();
  });

  it("updates the amount", async () => {
    const id = await addBudget({
      name: null,
      amount: 1000,
      categoryId: null,
      subcategoryId: null,
      period: "month",
      currency: "USD",
    });
    mockParams.current = { id };
    await renderScreen();
    fireEvent.changeText(screen.getByDisplayValue("10.00"), "20");
    pressSave();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await getBudget(id))?.amount).toBe(2000);
  });
});
