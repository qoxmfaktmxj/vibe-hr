"use client";

import * as React from "react";

import { VibeDatePicker } from "@/components/ui/vibe-date-picker";

type CustomDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  holidays?: string[];
  placeholder?: string;
  className?: string;
  closeOnSelect?: boolean;
  inline?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  ariaLabel?: string;
  disabled?: boolean;
};

export function CustomDatePicker({
  value,
  onChange,
  holidays = [],
  placeholder = "날짜 선택",
  className,
  closeOnSelect = true,
  inline = false,
  onKeyDown,
  ariaLabel,
  disabled = false,
}: CustomDatePickerProps) {
  return (
    <VibeDatePicker
      value={value}
      onChange={onChange}
      holidays={holidays}
      placeholder={placeholder}
      className={className}
      closeOnSelect={closeOnSelect}
      inline={inline}
      onKeyDown={onKeyDown}
      ariaLabel={ariaLabel}
      disabled={disabled}
    />
  );
}
