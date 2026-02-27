"use client";

import { Bot, Check, Moon, Palette, Settings2, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CHATBOT_FAB_EVENT, CHATBOT_FAB_VISIBLE_KEY } from "@/components/layout/chat-assistant-fab";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type PaletteMode = "default" | "vivid";
type PrimaryTone = "blue" | "skyblue" | "gray" | "green" | "red";

type ThemePreference = {
  darkMode: boolean;
  paletteMode: PaletteMode;
  primaryTone: PrimaryTone;
  chatbotButtonVisible: boolean;
};

const STORAGE_KEY = "vibe_hr_theme_preferences";

const PRIMARY_OPTIONS: Array<{ value: PrimaryTone; label: string; color: string }> = [
  { value: "blue", label: "Blue", color: "#3c6dee" },
  { value: "skyblue", label: "SkyBlue", color: "#0ea5e9" },
  { value: "gray", label: "Gray", color: "#64748b" },
  { value: "green", label: "Green", color: "#16a34a" },
  { value: "red", label: "Red", color: "#dc2626" },
];

const PALETTE_OPTIONS: Array<{ value: PaletteMode; label: string }> = [
  { value: "default", label: "A 타입" },
  { value: "vivid", label: "B 타입" },
];

function applyThemePreference(preference: ThemePreference) {
  const root = document.documentElement;
  root.classList.toggle("dark", preference.darkMode);
  root.dataset.palette = preference.paletteMode;
  root.dataset.primaryTone = preference.primaryTone;
}

function normalizePaletteMode(mode: string | undefined | null): PaletteMode {
  if (mode === "vivid") return "vivid";
  return "default";
}

function getCurrentPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return { darkMode: false, paletteMode: "default", primaryTone: "blue", chatbotButtonVisible: true };
  }

  const root = document.documentElement;
  const darkMode = root.classList.contains("dark");
  const paletteMode = normalizePaletteMode(root.dataset.palette);
  const primaryTone = (root.dataset.primaryTone as PrimaryTone | undefined) ?? "blue";
  const chatbotButtonVisible = window.localStorage.getItem(CHATBOT_FAB_VISIBLE_KEY) !== "false";
  return { darkMode, paletteMode, primaryTone, chatbotButtonVisible };
}

function loadStoredPreference(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const json = JSON.parse(raw) as Partial<ThemePreference>;
    if (!json) return null;
    return {
      darkMode: Boolean(json.darkMode),
      paletteMode: normalizePaletteMode(json.paletteMode as string | undefined),
      primaryTone: (json.primaryTone as PrimaryTone) || "blue",
      chatbotButtonVisible:
        typeof json.chatbotButtonVisible === "boolean"
          ? json.chatbotButtonVisible
          : window.localStorage.getItem(CHATBOT_FAB_VISIBLE_KEY) !== "false",
    };
  } catch {
    return null;
  }
}

export function ThemeSettingsPopover() {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState<ThemePreference>(() => loadStoredPreference() ?? getCurrentPreference());
  const [draft, setDraft] = useState<ThemePreference>(() => loadStoredPreference() ?? getCurrentPreference());

  useEffect(() => {
    applyThemePreference(applied);
  }, [applied]);

  const selectedPrimary = useMemo(
    () => PRIMARY_OPTIONS.find((option) => option.value === draft.primaryTone) ?? PRIMARY_OPTIONS[0],
    [draft.primaryTone],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(applied);
    }
    setOpen(nextOpen);
  }

  function applyDraft() {
    applyThemePreference(draft);
    setApplied(draft);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    window.localStorage.setItem(CHATBOT_FAB_VISIBLE_KEY, String(draft.chatbotButtonVisible));
    window.dispatchEvent(new Event(CHATBOT_FAB_EVENT));
    setOpen(false);
  }

  function cancelDraft() {
    setDraft(applied);
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="테마 설정" title="테마 설정">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-0">
        <div className="border-b bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">테마 설정</div>

        <div className="space-y-4 p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Palette className="h-3.5 w-3.5" />
              프라이머리 색상
            </div>
            <div className="space-y-1">
              {PRIMARY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, primaryTone: option.value }))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-50",
                    draft.primaryTone === option.value ? "bg-slate-100" : "",
                  )}
                >
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: option.color }} />
                  <span className="flex-1">{option.label}</span>
                  {draft.primaryTone === option.value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">팔레트 모드</div>
            <div className="space-y-1">
              {PALETTE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, paletteMode: option.value }))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-slate-700 hover:bg-slate-50",
                    draft.paletteMode === option.value ? "bg-slate-100" : "",
                  )}
                >
                  <span className="h-3 w-3 rounded-full border border-slate-300 bg-white" />
                  <span className="flex-1">{option.label}</span>
                  {draft.paletteMode === option.value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">모드 설정</div>
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
              className="flex w-full items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                {draft.darkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                다크모드
              </span>
              <span className={cn("text-xs font-semibold", draft.darkMode ? "text-primary" : "text-slate-500")}>
                {draft.darkMode ? "ON" : "OFF"}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">화면 도구</div>
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, chatbotButtonVisible: !prev.chatbotButtonVisible }))}
              className="flex w-full items-center justify-between rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5" />
                챗봇 버튼 표시
              </span>
              <span
                className={cn("text-xs font-semibold", draft.chatbotButtonVisible ? "text-primary" : "text-slate-500")}
              >
                {draft.chatbotButtonVisible ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2">
          <p className="text-xs text-slate-500">현재 색상: {selectedPrimary.label}</p>
          <div className="flex items-center gap-2">
            <Button type="button" size="xs" variant="query" onClick={applyDraft}>
              확인
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={cancelDraft}>
              취소
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
