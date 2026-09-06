"use client";

import { Bot, Check, Moon, Palette, Settings2, Sun } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CHATBOT_FAB_EVENT, CHATBOT_FAB_VISIBLE_KEY } from "@/components/layout/chat-assistant-fab";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  { value: "blue", label: "파랑", color: "#3c6dee" },
  { value: "skyblue", label: "하늘", color: "#0ea5e9" },
  { value: "gray", label: "회색", color: "#64748b" },
  { value: "green", label: "초록", color: "#16a34a" },
  { value: "red", label: "빨강", color: "#dc2626" },
];

const PALETTE_OPTIONS: Array<{ value: PaletteMode; label: string }> = [
  { value: "default", label: "기본" },
  { value: "vivid", label: "선명한 대비" },
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

export function ThemeSettingsPopover({ trigger }: { trigger?: ReactNode }) {
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
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? <Button type="button" variant="outline" size="icon" aria-label="화면 설정" title="화면 설정">
          <Settings2 className="h-4 w-4" />
        </Button>}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-label="화면 설정"
        className="max-h-[calc(100dvh-2rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto border-[var(--vibe-border-emphasis)] bg-card p-0 motion-reduce:animate-none!"
      >
        <div className="border-b px-4 py-3 text-base font-semibold text-foreground">화면 설정</div>

        <div className="space-y-4 p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Palette className="h-3.5 w-3.5" />
              강조 색상
            </div>
            <div role="group" aria-label="강조 색상" className="space-y-1">
              {PRIMARY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={draft.primaryTone === option.value}
                  onClick={() => setDraft((prev) => ({ ...prev, primaryTone: option.value }))}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                    draft.primaryTone === option.value
                      ? "bg-primary/15 ring-1 ring-inset ring-primary/30"
                      : "",
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
            <div className="text-xs font-semibold text-muted-foreground">팔레트 모드</div>
            <div role="group" aria-label="팔레트 모드" className="space-y-1">
              {PALETTE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={draft.paletteMode === option.value}
                  onClick={() => setDraft((prev) => ({ ...prev, paletteMode: option.value }))}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                    draft.paletteMode === option.value
                      ? "bg-primary/15 ring-1 ring-inset ring-primary/30"
                      : "",
                  )}
                >
                  <span className="h-3 w-3 rounded-full border border-border bg-background" />
                  <span className="flex-1">{option.label}</span>
                  {draft.paletteMode === option.value ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">모드 설정</div>
            <button
              type="button"
              aria-pressed={draft.darkMode}
              onClick={() => setDraft((prev) => ({ ...prev, darkMode: !prev.darkMode }))}
              className="flex min-h-11 w-full items-center justify-between rounded-md border border-[var(--vibe-border-emphasis)] px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <span className="flex items-center gap-2">
                {draft.darkMode ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                다크모드
              </span>
              <span className={cn("text-xs font-semibold", draft.darkMode ? "text-primary" : "text-muted-foreground")}>
                {draft.darkMode ? "켜짐" : "꺼짐"}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">화면 도구</div>
            <button
              type="button"
              aria-pressed={draft.chatbotButtonVisible}
              onClick={() => setDraft((prev) => ({ ...prev, chatbotButtonVisible: !prev.chatbotButtonVisible }))}
              className="flex min-h-11 w-full items-center justify-between rounded-md border border-[var(--vibe-border-emphasis)] px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <span className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5" />
                챗봇 버튼 표시
              </span>
              <span
                className={cn("text-xs font-semibold", draft.chatbotButtonVisible ? "text-primary" : "text-muted-foreground")}
              >
                {draft.chatbotButtonVisible ? "켜짐" : "꺼짐"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-3 py-2">
          <p className="text-xs text-muted-foreground">현재 색상: {selectedPrimary.label}</p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" className="min-h-11" variant="query" onClick={applyDraft}>
              확인
            </Button>
            <Button type="button" size="sm" className="min-h-11" variant="outline" onClick={cancelDraft}>
              취소
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
