import { useState, useEffect, useCallback, useRef } from "react";
import {
  Inbox as InboxIcon, Loader2, Mail, MailOpen, RefreshCw,
  Tag, Send, ChevronDown, X, CornerDownLeft, ArrowUpRight, ArrowDownLeft,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function authFetch(path: string, opts?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  });
}

// ---- minimal inline toast ----
type Toast = { id: number; title: string; description?: string; variant?: "default" | "destructive" };
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500);
  }, []);
  const ToastHost = () => (
    <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 999 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.variant === "destructive" ? "#FEF2F2" : "#0A0A0A",
          color: t.variant === "destructive" ? "#DC2626" : "#fff",
          padding: "10px 16px", borderRadius: 10, fontSize: "0.875rem", minWidth: 220,
          boxShadow: "0 8px 24px rgba(0,0,0,.15)",
        }}>
          <div style={{ fontWeight: 700 }}>{t.title}</div>
          {t.description && <div style={{ fontSize: "0.8125rem", opacity: 0.85, marginTop: 2 }}>{t.description}</div>}
        </div>
      ))}
    </div>
  );
  return { toast, ToastHost };
}

interface InboxThread {
  threadId: number;
  contactId: number | null;
  name: string;
  email: string | null;
  sequenceId: number | null;
  sequenceName: string | null;
  subject: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  isRead: boolean;
  unreadCount: number;
  category: string | null;
  hasMeetingIntent: boolean;
  status: string | null;
}

interface ThreadMessage {
  id: number;
  text: string;
  isOutgoing: boolean;
  sentAt: string;
  fromName: string | null;
  subject: string | null;
  fromEmail: string | null;
  to: string[];
  channel: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function MessageBubble({ msg }: { msg: ThreadMessage }) {
  const isSent = msg.isOutgoing;
  const senderInitial = (msg.fromName || msg.fromEmail || "?")[0].toUpperCase();

  return (
    <div style={{ display: "flex", gap: 12, flexDirection: isSent ? "row-reverse" : "row" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
        background: isSent ? "#2563EB" : "#EFF6FF", color: isSent ? "#fff" : "#2563EB",
        border: isSent ? "none" : "1px solid #DBEAFE",
      }}>
        {isSent ? "Y" : senderInitial}
      </div>
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 4, alignItems: isSent ? "flex-end" : "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isSent ? (
            <>
              <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>{formatDateTime(msg.sentAt)}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>You</span>
              <ArrowUpRight style={{ width: 12, height: 12, color: "#2563EB" }} />
            </>
          ) : (
            <>
              <ArrowDownLeft style={{ width: 12, height: 12, color: "#059669" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>{msg.fromName || msg.fromEmail || "Contact"}</span>
              <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>{formatDateTime(msg.sentAt)}</span>
            </>
          )}
        </div>
        <div style={{
          padding: "12px 16px", borderRadius: 16, fontSize: "0.875rem", lineHeight: 1.5, whiteSpace: "pre-wrap",
          background: isSent ? "#2563EB" : "#fff", color: isSent ? "#fff" : "#0A0A0A",
          border: isSent ? "none" : "1px solid #E2E8F0",
          borderTopRightRadius: isSent ? 4 : 16, borderTopLeftRadius: isSent ? 16 : 4,
        }}>
          {msg.text ? msg.text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() || msg.text : <span style={{ opacity: 0.5, fontStyle: "italic" }}>No content</span>}
        </div>
      </div>
    </div>
  );
}

function ReplyComposer({ thread, onSent }: { thread: InboxThread; onSent: () => void }) {
  const { toast, ToastHost } = useToast();
  const [open, setOpen] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await authFetch(`/api/replyio/inbox/threads/${thread.threadId}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: body.trim() }),
      });
      if (res.ok) {
        toast({ title: "Reply sent!" });
        setBody("");
        setOpen(false);
        onSent();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Failed to send reply", description: err?.error ?? "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error sending reply", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSend(); }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <div style={{ borderTop: "1px solid #E2E8F0" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", background: "transparent", border: "none", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>
          <CornerDownLeft style={{ width: 15, height: 15, color: "#2563EB" }} /> Reply to {thread.name}
        </div>
        <ChevronDown style={{ width: 15, height: 15, color: "#9CA3AF", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, fontSize: "0.75rem", color: "#64748B", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, padding: "8px 12px" }}>
            <div style={{ display: "flex", gap: 8 }}><span style={{ width: 32, fontWeight: 600, color: "#94A3B8" }}>To</span><span>{thread.email ?? thread.name}</span></div>
            {thread.subject && <div style={{ display: "flex", gap: 8 }}><span style={{ width: 32, fontWeight: 600, color: "#94A3B8" }}>Sub</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Re: {thread.subject}</span></div>}
          </div>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => { setBody(e.target.value); handleInput(); }}
            onKeyDown={handleKeyDown}
            placeholder="Write your reply… (⌘ Enter to send)"
            rows={3}
            style={{ width: "100%", resize: "none", borderRadius: 9, border: "1px solid #E2E8F0", background: "#fff", padding: "10px 14px", fontSize: "0.875rem", color: "#0A0A0A", outline: "none", lineHeight: 1.5, minHeight: 80, boxSizing: "border-box" }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
              <kbd style={{ padding: "2px 6px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 4, fontSize: "0.625rem", fontFamily: "monospace", color: "#2563EB" }}>⌘ Enter</kbd> to send
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setBody(""); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", background: "transparent", border: "none", borderRadius: 9, cursor: "pointer" }}>
                <X style={{ width: 14, height: 14 }} /> Discard
              </button>
              <button onClick={handleSend} disabled={sending || !body.trim()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", background: "#2563EB", color: "#fff", fontSize: "0.75rem", fontWeight: 700, borderRadius: 9, border: "none", cursor: "pointer", opacity: sending || !body.trim() ? 0.6 : 1 }}>
                {sending ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />}
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastHost />
    </div>
  );
}

export default function Inbox() {
  const { toast, ToastHost } = useToast();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InboxThread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await authFetch("/api/replyio/inbox/threads");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads ?? []);
      } else {
        setThreads([]);
        toast({ title: "Failed to load inbox", variant: "destructive" });
      }
    } catch {
      setThreads([]);
      toast({ title: "Error loading inbox", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function fetchMessages(thread: InboxThread) {
    setMessagesLoading(true);
    setMessages([]);
    try {
      const res = await authFetch(`/api/replyio/inbox/threads/${thread.threadId}/messages`);
      if (res.ok) setMessages((await res.json()).messages ?? []);
      else toast({ title: "Failed to load messages", variant: "destructive" });
    } catch {
      toast({ title: "Error loading messages", variant: "destructive" });
    } finally {
      setMessagesLoading(false);
    }
  }

  function handleOpen(thread: InboxThread) {
    setSelected(thread);
    fetchMessages(thread);
    if (!thread.isRead) {
      setThreads(prev => prev.map(t => t.threadId === thread.threadId ? { ...t, isRead: true, unreadCount: 0 } : t));
    }
  }

  const filtered = filter === "unread" ? threads.filter(t => !t.isRead) : threads;
  const unreadCount = threads.filter(t => !t.isRead).length;

  return (
    <>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              Reply Inbox
              {unreadCount > 0 && <span style={{ fontSize: "0.875rem", fontWeight: 600, background: "#2563EB", color: "#fff", padding: "2px 10px", borderRadius: 999 }}>{unreadCount}</span>}
            </h1>
            <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: "0.9375rem" }}>Email conversations from your Reply.io sequences</p>
          </div>
          <button onClick={() => fetchThreads(true)} disabled={refreshing} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", border: "1px solid #E2E8F0", color: "#64748B", fontSize: "0.875rem", fontWeight: 600, borderRadius: 9, background: "#fff", cursor: "pointer", opacity: refreshing ? 0.6 : 1 }}>
            <RefreshCw style={{ width: 15, height: 15 }} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 20 }}>
          {/* Left — thread list */}
          <div>
            <div style={{ display: "flex", marginBottom: 12, background: "#F5F3FF", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              {(["all", "unread"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  flex: 1, padding: "10px 0", fontSize: "0.875rem", fontWeight: 700, border: "none", cursor: "pointer",
                  background: filter === f ? "#fff" : "transparent",
                  color: filter === f ? "#2563EB" : "#64748B",
                  borderBottom: filter === f ? "2px solid #2563EB" : "none",
                }}>
                  {f === "unread" ? `Unread (${unreadCount})` : "All"}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 style={{ width: 20, height: 20, color: "#2563EB" }} className="animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <InboxIcon style={{ width: 32, height: 32, color: "#CBD5E1", margin: "0 auto 8px" }} />
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{filter === "unread" ? "No unread replies" : "No conversations yet"}</p>
                <p style={{ fontSize: "0.75rem", color: "#94A3B8", margin: "4px 0 0" }}>{filter === "unread" ? "You're all caught up!" : "Replies from your sequences will appear here"}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filtered.map(thread => {
                  const isSelected = selected?.threadId === thread.threadId;
                  return (
                    <button key={thread.threadId} onClick={() => handleOpen(thread)} style={{
                      width: "100%", textAlign: "left", padding: 14, borderRadius: 12, cursor: "pointer",
                      background: isSelected ? "#EFF6FF" : "#fff",
                      border: `1px solid ${isSelected ? "#2563EB" : "#E2E8F0"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          {thread.isRead ? <MailOpen style={{ width: 16, height: 16, color: isSelected ? "#2563EB" : "#9CA3AF" }} /> : <Mail style={{ width: 16, height: 16, color: "#2563EB" }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <p style={{ margin: 0, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isSelected ? "#2563EB" : "#0A0A0A", fontWeight: 700 }}>{thread.name}</p>
                            <span style={{ fontSize: "0.75rem", flexShrink: 0, color: isSelected ? "#2563EB" : "#9CA3AF" }}>{timeAgo(thread.lastMessageAt)}</span>
                          </div>
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#64748B" }}>{thread.subject || thread.lastMessage || "(no subject)"}</p>
                          {thread.sequenceName && <p style={{ margin: "2px 0 0", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#94A3B8" }}>{thread.sequenceName}</p>}
                        </div>
                        {!thread.isRead && <div style={{ width: 8, height: 8, background: "#2563EB", borderRadius: "50%", flexShrink: 0, marginTop: 6 }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right — messages + composer */}
          <div>
            {selected ? (
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 500 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", background: "#F8FAFC" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0A0A0A" }}>{selected.subject || "(no subject)"}</h2>
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>{selected.name}{selected.email && <span style={{ color: "#94A3B8" }}> · {selected.email}</span>}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {selected.category && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 8, fontSize: "0.75rem", color: "#2563EB", fontWeight: 600 }}>
                        <Tag style={{ width: 12, height: 12 }} /> {selected.category}
                      </div>
                    )}
                    <button onClick={() => fetchMessages(selected)} style={{ padding: 6, color: "#9CA3AF", background: "transparent", border: "none", cursor: "pointer", display: "flex" }}>
                      <RefreshCw style={{ width: 14, height: 14 }} className={messagesLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20, background: "#FAFAF9", maxHeight: 420 }}>
                  {messagesLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                      <Loader2 style={{ width: 20, height: 20, color: "#2563EB" }} className="animate-spin" />
                      <span style={{ marginLeft: 8, fontSize: "0.875rem", color: "#64748B" }}>Loading conversation…</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <p style={{ fontSize: "0.875rem", color: "#94A3B8", textAlign: "center", padding: "32px 0", fontStyle: "italic" }}>No messages found</p>
                  ) : (
                    <>
                      {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                <ReplyComposer key={selected.threadId} thread={selected} onSent={() => { fetchMessages(selected); fetchThreads(true); }} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, textAlign: "center", border: "1px solid #E2E8F0", borderRadius: 14, background: "#F8FAFC" }}>
                <InboxIcon style={{ width: 40, height: 40, color: "#CBD5E1", marginBottom: 12 }} />
                <p style={{ color: "#64748B", fontWeight: 600, margin: 0 }}>Select a conversation</p>
                <p style={{ fontSize: "0.875rem", color: "#94A3B8", margin: "4px 0 0" }}>Full sent & received history will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ToastHost />
    </>
  );
}