"use client";

import { useEffect, useState } from "react";

import type { ActiveCodeListResponse } from "@/types/common-code";

type Props = {
  groupCode: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function CommonCodeSelect({ groupCode, label, value, onChange, disabled }: Props) {
  const [options, setOptions] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/codes/groups/by-code/${groupCode}/active`, { cache: "no-store" });
      if (!res.ok) {
        setOptions([]);
        return;
      }
      const data = (await res.json()) as ActiveCodeListResponse;
      setOptions(data.options);
    })();
  }, [groupCode]);

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select
        className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
      >
        <option value="">선택</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name} ({option.code})
          </option>
        ))}
      </select>
    </div>
  );
}
