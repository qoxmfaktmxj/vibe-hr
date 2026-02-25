"use client";

import { Bot, FileDiff, Logs, MessageSquare, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const CHATBOT_FAB_VISIBLE_KEY = "vibe_hr_chatbot_fab_visible";
export const CHATBOT_FAB_EVENT = "vibe_hr_chatbot_fab_changed";

type DrawerTab = "chat" | "diff" | "logs";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type RunLog = {
  id: string;
  level: "info" | "success";
  message: string;
  createdAt: string;
};

const CHAT_HISTORY_KEY = "vibe_hr_chatbot_mvp_history";
const LOG_HISTORY_KEY = "vibe_hr_chatbot_mvp_logs";

function getChatbotFabVisible(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(CHATBOT_FAB_VISIBLE_KEY);
  if (raw == null) return true;
  return raw !== "false";
}

function nowIso() {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function ChatAssistantFab() {
  const [visible, setVisible] = useState<boolean>(() => getChatbotFabVisible());
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("chat");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => readJson(CHAT_HISTORY_KEY, []));
  const [logs, setLogs] = useState<RunLog[]>(() => readJson(LOG_HISTORY_KEY, []));

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

  useEffect(() => {
    window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-100)));
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(LOG_HISTORY_KEY, JSON.stringify(logs.slice(-200)));
  }, [logs]);

  const diffPreview = useMemo(
    () => `--- a/frontend/src/components/example.tsx\n+++ b/frontend/src/components/example.tsx\n@@\n- return <div>Old</div>\n+ return <div>New</div>\n`,
    [],
  );

  function appendLog(message: string, level: RunLog["level"] = "info") {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, level, message, createdAt: nowIso() },
    ]);
  }

  function sendPrompt() {
    const text = prompt.trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      text,
      createdAt: nowIso(),
    };
    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-a`,
      role: "assistant",
      text: "요청 접수됨(MVP). 다음 단계에서 실제 에이전트 백엔드와 연결됩니다.",
      createdAt: nowIso(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    appendLog(`PROMPT 수신: ${text}`);
    appendLog("응답 생성 완료 (MVP stub)", "success");
    setPrompt("");
  }

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
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold">개발 보조 챗봇</h3>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="닫기">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-3 flex gap-1 rounded-md border p-1">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
                  activeTab === "chat" ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> 대화
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("diff")}
                className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
                  activeTab === "diff" ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <FileDiff className="h-3.5 w-3.5" /> 변경 Diff
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs ${
                  activeTab === "logs" ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <Logs className="h-3.5 w-3.5" /> 실행 로그
              </button>
            </div>

            {activeTab === "chat" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2">
                  {messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">메시지를 입력하면 대화 기록이 여기에 표시됩니다.</p>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="rounded border bg-card p-2 text-xs">
                        <p className="mb-1 font-medium">{message.role === "user" ? "나" : "챗봇"}</p>
                        <p>{message.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="요청을 입력하세요"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") sendPrompt();
                    }}
                  />
                  <Button type="button" onClick={sendPrompt} size="icon" aria-label="전송">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            {activeTab === "diff" ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/20 p-2">
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{diffPreview}</pre>
              </div>
            ) : null}

            {activeTab === "logs" ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-2">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">실행 로그가 없습니다.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="rounded border bg-card p-2 text-xs">
                      <p className={log.level === "success" ? "text-emerald-600" : "text-muted-foreground"}>{log.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{log.createdAt}</p>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
