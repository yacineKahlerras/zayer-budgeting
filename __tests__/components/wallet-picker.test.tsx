import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import {
  WalletMenuModal,
  WalletPickerDialog,
} from "@/components/ui/wallet-picker-dialog";
import type { WalletWithBalance } from "@/db/queries";

const WALLETS: WalletWithBalance[] = [
  {
    id: "w1",
    name: "Cash",
    currency: "DZD",
    icon: null,
    color: null,
    initialBalance: 0,
    balance: 4830700,
  },
  {
    id: "w2",
    name: "usd",
    currency: "USD",
    icon: null,
    color: null,
    initialBalance: 0,
    balance: 1141300,
  },
];

describe("WalletMenuModal", () => {
  it("lists every wallet with balance · currency", () => {
    render(
      <WalletMenuModal
        visible
        wallets={WALLETS}
        selected="w1"
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText("Switch wallet")).toBeTruthy();
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText("DA48,307.00 · DZD")).toBeTruthy();
    expect(screen.getByText("usd")).toBeTruthy();
    expect(screen.getByText("$11,413.00 · USD")).toBeTruthy();
  });

  it("selects a wallet and closes", () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    render(
      <WalletMenuModal
        visible
        wallets={WALLETS}
        selected="w1"
        onSelect={onSelect}
        onClose={onClose}
      />
    );
    fireEvent.press(screen.getByText("usd"));
    expect(onSelect).toHaveBeenCalledWith("w2");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when not visible", () => {
    render(
      <WalletMenuModal
        visible={false}
        wallets={WALLETS}
        selected="w1"
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByText("Switch wallet")).toBeNull();
  });
});

describe("WalletPickerDialog", () => {
  it("shows the current wallet name and currency in the trigger", () => {
    render(
      <WalletPickerDialog
        wallets={WALLETS}
        selected="w2"
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText("usd")).toBeTruthy();
    expect(screen.getByText("USD")).toBeTruthy();
  });

  it("opens the dialog on tap and forwards the selection", () => {
    const onSelect = jest.fn();
    render(
      <WalletPickerDialog
        wallets={WALLETS}
        selected="w1"
        onSelect={onSelect}
      />
    );
    fireEvent.press(screen.getByText("Cash"));
    expect(screen.getByText("Switch wallet")).toBeTruthy();
    fireEvent.press(screen.getByText("usd"));
    expect(onSelect).toHaveBeenCalledWith("w2");
  });

  it("does not open with a single wallet (screen-scope selector)", () => {
    render(
      <WalletPickerDialog
        wallets={[WALLETS[0]]}
        selected="w1"
        onSelect={jest.fn()}
      />
    );
    fireEvent.press(screen.getByText("Cash"));
    expect(screen.queryByText("Switch wallet")).toBeNull();
  });
});
