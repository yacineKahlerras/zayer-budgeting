/**
 * Shared UI primitives.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { AmountInput } from "@/components/ui/amount-input";
import { Chip } from "@/components/ui/chip";
import { DeleteRow } from "@/components/ui/delete-row";
import { ModalHeader } from "@/components/ui/modal-header";
import { SegmentedControl } from "@/components/ui/segmented-control";

describe("Chip", () => {
  it("renders its label and fires onPress", () => {
    const onPress = jest.fn();
    render(<Chip label="Food" selected={false} onPress={onPress} />);
    fireEvent.press(screen.getByText("Food"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("SegmentedControl", () => {
  const OPTIONS = [
    { value: "day" as const, label: "Day" },
    { value: "month" as const, label: "Month" },
    { value: "year" as const, label: "Year" },
  ];

  it("renders every option", () => {
    render(
      <SegmentedControl options={OPTIONS} value="month" onChange={jest.fn()} />
    );
    for (const o of OPTIONS) expect(screen.getByText(o.label)).toBeTruthy();
  });

  it("reports the tapped value", () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl options={OPTIONS} value="month" onChange={onChange} />
    );
    fireEvent.press(screen.getByText("Day"));
    expect(onChange).toHaveBeenCalledWith("day");
  });
});

describe("AmountInput", () => {
  it("shows the currency symbol for the wallet", () => {
    render(
      <AmountInput value="" onChangeText={jest.fn()} currency="DZD" />
    );
    expect(screen.getByText("DA")).toBeTruthy();
  });

  it("sanitizes input to digits and a single decimal point", () => {
    const onChangeText = jest.fn();
    render(
      <AmountInput value="" onChangeText={onChangeText} currency="USD" />
    );
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.changeText(input, "1a2.3.4$");
    expect(onChangeText).toHaveBeenCalledWith("12.34");
  });

  it("passes clean values through unchanged", () => {
    const onChangeText = jest.fn();
    render(
      <AmountInput value="" onChangeText={onChangeText} currency="USD" />
    );
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "1500.50");
    expect(onChangeText).toHaveBeenCalledWith("1500.50");
  });
});

describe("DeleteRow", () => {
  it("renders the label and fires onPress", () => {
    const onPress = jest.fn();
    render(<DeleteRow label="Delete wallet" onPress={onPress} />);
    fireEvent.press(screen.getByText("Delete wallet"));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("ModalHeader", () => {
  it("shows the title and wires cancel/save", () => {
    const onCancel = jest.fn();
    const onSave = jest.fn();
    render(
      <ModalHeader title="New budget" onCancel={onCancel} onSave={onSave} />
    );
    expect(screen.getByText("New budget")).toBeTruthy();
  });

  it("disables save while saving", () => {
    const onSave = jest.fn();
    render(
      <ModalHeader
        title="T"
        onCancel={jest.fn()}
        onSave={onSave}
        saving={true}
      />
    );
    // The check icon is replaced by a spinner and the button is disabled.
    expect(screen.UNSAFE_queryAllByType(require("react-native").ActivityIndicator)).toHaveLength(1);
  });
});
