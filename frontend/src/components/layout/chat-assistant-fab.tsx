"use client";

import { Bot, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export const CHATBOT_FAB_VISIBLE_KEY = "vibe_hr_chatbot_fab_visible";
export const CHATBOT_FAB_EVENT = "vibe_hr_chatbot_fab_changed";

function getChatbotFabVisible(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(CHATBOT_FAB_VISIBLE_KEY);
  if (raw == null) return true;
  return raw !== "false";
}

export function ChatAssistantFab() {
  const [visible, setVisible] = useState<boolean>(() => getChatbotFabVisible());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function syncFromStorage() {
      setVisible(getChatbotFabVisible());
    }

    function onStorage(event: StorageEvent) {
      if (event.key === CHATBOT_FAB_VISIBLE_KEY) syncFromStorage();
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener(CHATBOT_FAB_EVENT, syncFromStorage as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHATBOT_FAB_EVENT, syncFromStorage as EventListener);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-5 z-40 rounded-full shadow-lg lg:bottom-6"
        aria-label="챗봇 열기"
        title="챗봇 열기"
      >
        <Bot className="mr-1 h-4 w-4" /> 챗봇
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            onClick={() => setOpen(false)}
            aria-label="챗봇 닫기"
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-md border-l bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold">개발 보조 챗봇 (MVP)</h3>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="닫기">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>대화형 패널 MVP가 활성화되었습니다.</p>
              <p>다음 단계에서 대화/변경 Diff/실행 로그 탭을 순차 연결합니다.</p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
