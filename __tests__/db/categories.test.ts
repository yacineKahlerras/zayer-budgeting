import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import {
  addCategory,
  addSubcategory,
  addTransaction,
  addWallet,
  deleteCategory,
  deleteSubcategory,
  getTransaction,
  listCategoryTree,
  updateCategory,
  updateSubcategory,
} from "@/db/queries";

describe("listCategoryTree", () => {
  it("filters by kind", async () => {
    await ensureDefaults(db);
    const expense = await listCategoryTree("expense");
    const income = await listCategoryTree("income");
    expect(expense.every((c) => c.kind === "expense")).toBe(true);
    expect(income.map((c) => c.name)).toEqual(["Income"]);
  });

  it("returns all kinds when unfiltered", async () => {
    await ensureDefaults(db);
    expect((await listCategoryTree()).length).toBe(7);
  });

  it("attaches subs to their own category only", async () => {
    await ensureDefaults(db);
    const tree = await listCategoryTree();
    const bills = tree.find((c) => c.name === "Bills")!;
    expect(bills.subs.map((s) => s.name)).toEqual(["Subscriptions", "Phone"]);
  });
});

describe("category CRUD", () => {
  it("addCategory appends with next sortOrder and defaults to non-default", async () => {
    await ensureDefaults(db);
    const id = await addCategory({ name: "Pets", kind: "expense", icon: null });
    const tree = await listCategoryTree();
    const pets = tree.find((c) => c.id === id)!;
    expect(pets.name).toBe("Pets");
    expect(tree[tree.length - 1].id).toBe(id); // sorted last
  });

  it("updateCategory renames without touching the icon", async () => {
    await ensureDefaults(db);
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    await updateCategory(food.id, { name: "Eating" });
    const renamed = (await listCategoryTree()).find((c) => c.id === food.id)!;
    expect(renamed.name).toBe("Eating");
    expect(renamed.icon).toBe("ShoppingCart");
  });

  it("deleteCategory cascades its subcategories", async () => {
    await ensureDefaults(db);
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    await deleteCategory(food.id);
    const tree = await listCategoryTree();
    expect(tree.find((c) => c.id === food.id)).toBeUndefined();
    // No orphan subs surface anywhere in the tree.
    const allSubNames = tree.flatMap((c) => c.subs.map((s) => s.name));
    expect(allSubNames).not.toContain("Groceries");
  });

  it("deleting a category keeps its transactions with a null category", async () => {
    await ensureDefaults(db);
    const w = await addWallet({ name: "W", currency: "USD", initialBalance: 0 });
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    const txId = await addTransaction({
      walletId: w,
      categoryId: food.id,
      subcategoryId: null,
      amount: 100,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    await deleteCategory(food.id);
    const tx = await getTransaction(txId);
    expect(tx).not.toBeNull();
    expect(tx!.categoryId).toBeNull();
  });
});

describe("subcategory CRUD", () => {
  it("addSubcategory appends under the right category", async () => {
    await ensureDefaults(db);
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    await addSubcategory(food.id, "Snacks");
    const updated = (await listCategoryTree()).find((c) => c.id === food.id)!;
    expect(updated.subs.map((s) => s.name)).toEqual([
      "Groceries",
      "Restaurant",
      "Fast Food",
      "Drinks",
      "Snacks",
    ]);
  });

  it("updateSubcategory renames", async () => {
    await ensureDefaults(db);
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    await updateSubcategory(food.subs[0].id, "Supermarket");
    const updated = (await listCategoryTree()).find((c) => c.id === food.id)!;
    expect(updated.subs[0].name).toBe("Supermarket");
  });

  it("deleteSubcategory removes it and nulls transaction references", async () => {
    await ensureDefaults(db);
    const w = await addWallet({ name: "W", currency: "USD", initialBalance: 0 });
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    const sub = food.subs[0];
    const txId = await addTransaction({
      walletId: w,
      categoryId: food.id,
      subcategoryId: sub.id,
      amount: 100,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    await deleteSubcategory(sub.id);
    const tx = await getTransaction(txId);
    expect(tx!.subcategoryId).toBeNull();
    expect(tx!.categoryId).toBe(food.id);
  });
});
