import { categoryIcon } from "@/utils/category-icon";

describe("categoryIcon", () => {
  it("resolves every seeded icon name to a component", () => {
    for (const name of [
      "ShoppingCart",
      "House",
      "Car",
      "ShoppingBag",
      "Receipt",
      "HeartPulse",
      "Wallet",
      "Tag",
    ]) {
      expect(typeof categoryIcon(name)).toBe("function");
    }
  });

  it("falls back to Tag for unknown names", () => {
    expect(categoryIcon("NotAnIcon")).toBe(categoryIcon("Tag"));
  });

  it("falls back to Tag for null", () => {
    expect(categoryIcon(null)).toBe(categoryIcon("Tag"));
  });
});
