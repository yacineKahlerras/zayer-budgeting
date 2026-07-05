/**
 * The inline balance editor on the home screen: correcting the balance logs
 * an adjustment transaction (never mutates the stored initial balance).
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import { BalanceEditor } from "@/components/home/balance-editor";
import {
  addWallet,
  getTransactionsPage,
  getWallet,
  getWalletBalance,
  listWalletsWithBalances,
  type WalletWithBalance,
} from "@/db/queries";

/** Build a WalletWithBalance whose derived balance is `cents`. */
async function walletAt(cents: number): Promise<WalletWithBalance> {
  await addWallet({ name: "Cash", currency: "USD", initialBalance: cents });
  const list = await listWalletsWithBalances();
  return list[list.length - 1];
}

function press(label: string) {
  fireEvent.press(screen.getByText(label));
}

describe("BalanceEditor", () => {
  it("renders nothing when there is no wallet", () => {
    const { toJSON } = render(
      <BalanceEditor
        wallet={null}
        visible
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );
    expect(toJSON()).toBeNull();
  });

  it("seeds the field with the current balance", async () => {
    const w = await walletAt(100_00);
    render(
      <BalanceEditor
        wallet={w}
        visible
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );
    expect(screen.getByDisplayValue("100.00")).toBeTruthy();
  });

  it("previews a −$50 expense when lowering 100 → 50", async () => {
    const w = await walletAt(100_00);
    render(
      <BalanceEditor
        wallet={w}
        visible
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );
    fireEvent.changeText(screen.getByDisplayValue("100.00"), "50");
    expect(screen.getByText(/expense to match/)).toBeTruthy();
  });

  it("previews an income when raising the balance", async () => {
    const w = await walletAt(20_00);
    render(
      <BalanceEditor
        wallet={w}
        visible
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );
    fireEvent.changeText(screen.getByDisplayValue("20.00"), "75");
    expect(screen.getByText(/income to match/)).toBeTruthy();
  });

  it("logs a −$50 expense and calls onSaved + onClose", async () => {
    const w = await walletAt(100_00);
    const onSaved = jest.fn();
    const onClose = jest.fn();
    render(
      <BalanceEditor
        wallet={w}
        visible
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    fireEvent.changeText(screen.getByDisplayValue("100.00"), "50");
    press("Save");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(await getWalletBalance(w.id)).toBe(50_00);
    const [tx] = await getTransactionsPage(0, 10, w.id);
    expect(tx.amount).toBe(-50_00);
    expect(tx.title).toBe("Balance adjustment");
  });

  it("never mutates the stored initial balance", async () => {
    const w = await walletAt(100_00);
    const before = (await getWallet(w.id))!.initialBalance;
    render(
      <BalanceEditor
        wallet={w}
        visible
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );
    fireEvent.changeText(screen.getByDisplayValue("100.00"), "10");
    press("Save");
    await waitFor(() => expect(getWallet(w.id)).resolves.toBeTruthy());
    expect((await getWallet(w.id))!.initialBalance).toBe(before);
  });

  it("cancels without logging anything", async () => {
    const w = await walletAt(30_00);
    const onSaved = jest.fn();
    render(
      <BalanceEditor
        wallet={w}
        visible
        onClose={jest.fn()}
        onSaved={onSaved}
      />
    );
    fireEvent.changeText(screen.getByDisplayValue("30.00"), "5");
    press("Cancel");
    expect(onSaved).not.toHaveBeenCalled();
    expect(await getTransactionsPage(0, 10, w.id)).toHaveLength(0);
  });
});
