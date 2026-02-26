"use client";

import type { KeyboardEventHandler, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFieldGridProps = {
  children: ReactNode;
  className?: string;
};

export function SearchFieldGrid({ children, className }: SearchFieldGridProps) {
  return <div className={cn("grid flex-1 gap-2 md:grid-cols-2", className)}>{children}</div>;
}

type SearchTextFieldProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  className?: string;
};

export function SearchTextField({
  value,
  placeholder,
  onChange,
  onKeyDown,
  className,
}: SearchTextFieldProps) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn("h-9 text-sm", className)}
    />
  );
}
