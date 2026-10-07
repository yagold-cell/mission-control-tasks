"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, Layers, RotateCcw, SendHorizontal, Sparkles, X, XCircle,
} from "lucide-react";
import { api, refreshAll, useSpaces } from "@/lib/client";
import type { AgentScope, ChatMessage, PendingAction } from "@/lib/types";

const STORAGE_KEY = "mc_agent_chat_v1";
const YES = ["כן", "מאשר", "מאשרת", "אישור", "אשר", "בצע", "יאללה", "סבבה", "yes", "ok", "אוקיי"];
const NO = ["לא", "לא מאשר", "לא מאשרת", "בטל", "ביטול", "עזוב", "no"];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const normalize = (s: string) => s.trim().replace(/[.!,?״"']/g, "").toLowerCase();

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function AgentWidget() {
  const pathname = usePathname();
  const { data: spaces } = useSpaces();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<AgentScope>({ type: "all" });
  const [scopeMenu, setScopeMenu] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // restore + persist conversation
  useEffect(() => setMessages(loadMessages()), []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)));
    } catch {}
  }, [messages]);

  // scope follows the page: inside a space -> that space, dashboard -> all
  useEffect(() => {
    const m = pathname.match(/^\/spaces\/(\d+)/);
    setScope(m ? { type: "space", spaceId: Number(m[1]) } : { type: "all" });
  }, [pathname]);

  useLayoutEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const scopeSpace = scope.type === "space" ? spaces?.find((s) => s.id === scope.spaceId) : undefined;
  const scopeLabel = scope.type === "all" ? "כל המרחבים" : scopeSpace?.name ?? "מרחב";
  const openPending = [...messages].reverse().find((m) => m.pending && m.pendingState === "open");

  async function resolve(msgId: string, pending: PendingAction, approve: boolean) {
    setMessages((ms) => ms.map((m) => (m.id === msgId ? { ...m, pendingState: approve ? "approved" : "rejected" } : m)));
    setLoading(true);
    try {
      const res = await api<{ message: string; changed: boolean }>("/api/agent/confirm", { method: "POST", body: { id: pending.id, approve } });
      if (res.changed) await refreshAll();
      setMessages((ms) => [...ms, { id: uid(), role: "assistant", content: res.message }]);
    } catch {
      setMessages((ms) => [...ms, { id: uid(), role: "assistant", content: "משהו השתבש בביצוע. נסה שוב.", error: true }]);
    } finally {
      setLoading(false);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");

    // a typed "yes"/"no" answers the open confirmation
    if (openPending?.pending) {
      const n = normalize(content);
      if (YES.includes(n) || NO.includes(n)) {
        setMessages((ms) => [...ms, { id: uid(), role: "user", content }]);
        await resolve(openPending.id, openPending.pending, YES.includes(n));
        return;
      }
      // a new request replaces the open confirmation
      api("/api/agent/confirm", { method: "POST", body: { id: openPending.pending.id, approve: false } }).catch(() => {});
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", content };
    const next = messages.map((m) => (m.pendingState === "open" ? { ...m, pendingState: "rejected" as const } : m)).concat(userMsg);
    setMessages(next);
    setLoading(true);
    try {
      const history = next.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
      const res = await api<{ reply: string; changed: boolean; changes: string[]; pending: PendingAction | null }>("/api/agent", {
        method: "POST",
        body: { messages: history, scope },
      });
      if (res.changed) await refreshAll();
      setMessages((ms) => [
        ...ms,
        {
          id: uid(),
          role: "assistant",
          content: res.reply,
          changes: res.changes?.length ? res.changes : undefined,
          pending: res.pending ?? undefined,
          pendingState: res.pending ? "open" : undefined,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error && e.message !== "unauthorized" ? e.message : "לא הצלחתי להתחבר לעוזר. נסה שוב.";
      setMessages((ms) => [...ms, { id: uid(), role: "assistant", content: msg, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions =
    scope.type === "all"
      ? ["מה המשימות הכי חשובות שצריך לתת להן עדיפות?", "תסכם לי מה מחכה לי השבוע", "תדחה את כל מה שבאיחור למחר"]
      : [`מה הכי דחוף ב${scopeLabel}?`, `תוסיף ל${scopeLabel} משימה לבדוק מיילים מחר`, "תסמן את כל המשימות של היום כהושלמו"];

  return (
    <>
      {/* launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "fixed z-50 bottom-5 right-5 sm:bottom-6 sm:right-6 group flex items-center gap-2 rounded-full text-white shadow-pop transition-all duration-300",
          "bg-gradient-to-l from-brand to-violet-600 hover:shadow-xl hover:shadow-brand/40 hover:-translate-y-0.5",
          open ? "size-14 justify-center max-sm:hidden" : "h-14 pl-5 pr-4",
        )}
        aria-label={open ? "סגירת הצ'אט" : "פתיחת צ'אט עם העוזר"}
      >
        {open ? (
          <ChevronDown className="size-6" />
        ) : (
          <>
            <span className="relative grid place-items-center size-8 rounded-full bg-white/20">
              <Sparkles className="size-[18px]" />
              <span className="absolute -top-0.5 -left-0.5 size-3 rounded-full bg-emerald-400 border-2 border-violet-600" />
            </span>
            <span className="font-semibold text-sm whitespace-nowrap">שאל את העוזר</span>
          </>
        )}
      </button>

      {/* panel */}
      {open && (
        <div
          className={clsx(
            "fixed z-50 bg-white flex flex-col overflow-hidden animate-slide-up",
            "inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[410px] sm:h-[min(700px,calc(100dvh-8rem))] sm:rounded-3xl sm:shadow-pop sm:border sm:border-line",
          )}
        >
          {/* header */}
          <div className="bg-gradient-to-l from-brand to-violet-600 text-white px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative size-10 rounded-2xl bg-white/20 grid place-items-center">
                <Sparkles className="size-5" />
                <span className="absolute -bottom-0.5 -left-0.5 size-3 rounded-full bg-emerald-400 border-2 border-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-5">העוזר החכם</div>
                <div className="text-[11px] text-white/75">GPT-6 Luna · זמין לעזור</div>
              </div>
              <button
                onClick={() => setMessages([])}
                className="p-2 rounded-xl hover:bg-white/15 transition"
                title="שיחה חדשה"
              >
                <RotateCcw className="size-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white/15 transition" title="סגירה">
                <X className="size-5" />
              </button>
            </div>

            {/* scope selector */}
            <div className="relative mt-3">
              <button
                onClick={() => setScopeMenu((v) => !v)}
                className="w-full flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-2 text-sm transition"
              >
                <span className="text-white/75 text-xs">עובד על:</span>
                {scope.type === "all" ? (
                  <Layers className="size-4" />
                ) : (
                  <span className="size-2.5 rounded-full ring-2 ring-white/70" style={{ background: scopeSpace?.color }} />
                )}
                <span className="font-semibold flex-1 text-right truncate">{scopeLabel}</span>
                <ChevronDown className={clsx("size-4 transition", scopeMenu && "rotate-180")} />
              </button>
              {scopeMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setScopeMenu(false)} />
                  <div className="absolute z-20 inset-x-0 top-full mt-1.5 bg-white text-ink rounded-xl shadow-pop border border-line p-1 animate-pop-in max-h-64 overflow-y-auto scroll-thin">
                    <ScopeOption
                      active={scope.type === "all"}
                      onClick={() => {
                        setScope({ type: "all" });
                        setScopeMenu(false);
                      }}
                      icon={<Layers className="size-4 text-slate-500" />}
                      label="כל המרחבים"
                    />
                    {spaces?.map((s) => (
                      <ScopeOption
                        key={s.id}
                        active={scope.type === "space" && scope.spaceId === s.id}
                        onClick={() => {
                          setScope({ type: "space", spaceId: s.id });
                          setScopeMenu(false);
                        }}
                        icon={<span className="size-2.5 rounded-full mx-[3px]" style={{ background: s.color }} />}
                        label={s.name}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto scroll-thin px-4 py-4 space-y-4 bg-slate-50/60">
            {messages.length === 0 && (
              <div className="animate-fade-in">
                <div className="flex gap-2.5">
                  <Avatar />
                  <div className="bg-white border border-line rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-6 shadow-card">
                    היי! אני העוזר שלך לניהול משימות ✨
                    <br />
                    אפשר לשאול אותי מה הכי חשוב, או לבקש שאוסיף, אעדכן, אדחה או אסגור משימות.
                  </div>
                </div>
                <div className="mt-4 mr-10 space-y-2">
                  <div className="text-[11px] font-semibold text-muted">נסו למשל:</div>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full text-right text-sm bg-white border border-line rounded-xl px-3 py-2 hover:border-brand hover:text-brand transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end animate-fade-in">
                  <div className="max-w-[85%] bg-brand text-white rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap shadow-sm">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2.5 animate-fade-in">
                  <Avatar />
                  <div className="max-w-[85%] min-w-0 space-y-2">
                    <div
                      className={clsx(
                        "rounded-2xl rounded-tr-md px-4 py-2.5 text-sm leading-6 shadow-card border",
                        m.error ? "bg-red-50 border-red-100 text-red-700" : "bg-white border-line",
                      )}
                    >
                      <RichText text={m.content} />
                    </div>
                    {m.changes && m.changes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.changes.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                            <Check className="size-3" />
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.pending && <PendingCard pending={m.pending} state={m.pendingState} disabled={loading} onResolve={(ok) => resolve(m.id, m.pending!, ok)} />}
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex gap-2.5 animate-fade-in">
                <Avatar />
                <div className="bg-white border border-line rounded-2xl rounded-tr-md px-4 py-3 shadow-card flex items-center gap-1">
                  <span className="typing-dot size-1.5 rounded-full bg-brand" />
                  <span className="typing-dot size-1.5 rounded-full bg-brand" />
                  <span className="typing-dot size-1.5 rounded-full bg-brand" />
                </div>
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-line p-3 bg-white">
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-slate-50 focus-within:bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                    (e.target as HTMLTextAreaElement).style.height = "auto";
                  }
                }}
                placeholder={openPending ? 'כתבו "כן" לאישור או "לא" לביטול…' : "כתבו הודעה לעוזר…"}
                className="flex-1 resize-none bg-transparent outline-none text-sm leading-6 max-h-[120px] py-0.5"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="size-8 shrink-0 rounded-xl bg-brand text-white grid place-items-center hover:bg-brand-dark transition disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="שליחה"
              >
                <SendHorizontal className="size-4 -scale-x-100" />
              </button>
            </div>
            <div className="text-[10px] text-muted text-center mt-1.5">
              העוזר פועל רק על: <span className="font-semibold">{scopeLabel}</span> · Enter לשליחה
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Avatar() {
  return (
    <div className="size-7 shrink-0 rounded-xl bg-gradient-to-br from-brand to-violet-600 text-white grid place-items-center shadow-sm">
      <Sparkles className="size-3.5" />
    </div>
  );
}

function ScopeOption({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={clsx("w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition", active ? "bg-brand-soft text-brand font-semibold" : "hover:bg-slate-50")}>
      {icon}
      <span className="flex-1 text-right">{label}</span>
      {active && <Check className="size-4" />}
    </button>
  );
}

function PendingCard({ pending, state, disabled, onResolve }: { pending: PendingAction; state?: ChatMessage["pendingState"]; disabled: boolean; onResolve: (ok: boolean) => void }) {
  const isDelete = pending.kind === "delete";
  return (
    <div className={clsx("rounded-2xl border p-3 text-sm", isDelete ? "bg-red-50/70 border-red-200" : "bg-amber-50/70 border-amber-200")}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={clsx("size-4 mt-0.5 shrink-0", isDelete ? "text-red-600" : "text-amber-600")} />
        <div className="flex-1">
          <div className="font-semibold">{isDelete ? "נדרש אישור למחיקה" : "נדרש אישור"}</div>
          <div className="text-slate-600 text-xs mt-0.5 leading-5">{pending.description}</div>
        </div>
      </div>
      {state === "open" ? (
        <div className="flex gap-2 mt-3">
          <button
            disabled={disabled}
            onClick={() => onResolve(true)}
            className={clsx(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl text-white font-semibold py-2 transition disabled:opacity-50",
              isDelete ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700",
            )}
          >
            <Check className="size-4" />
            מאשר
          </button>
          <button
            disabled={disabled}
            onClick={() => onResolve(false)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-line hover:bg-slate-50 font-semibold py-2 transition disabled:opacity-50"
          >
            <X className="size-4" />
            לא מאשר
          </button>
        </div>
      ) : (
        <div className={clsx("flex items-center gap-1.5 mt-2 text-xs font-semibold", state === "approved" ? "text-emerald-700" : "text-slate-500")}>
          {state === "approved" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {state === "approved" ? "אושר" : "בוטל"}
        </div>
      )}
    </div>
  );
}

/** Minimal, safe markdown: **bold**, "-" bullets and numbered lists. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={clsx("my-1 space-y-0.5 pr-4", list.ordered ? "list-decimal" : "list-disc marker:text-brand")}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (line.trim() === "") continue;
    blocks.push(<p key={blocks.length} className="my-0.5">{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <>{blocks}</>;
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}
