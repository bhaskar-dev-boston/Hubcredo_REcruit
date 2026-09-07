import { useState, useEffect, useRef, useCallback } from "react";
import {
  Linkedin, CheckCircle2, Loader2, Plus, Play, Pause, X, ShieldAlert,
  Users, Send, MessageSquare, Settings, MessageCircle, Mail, RefreshCcw,
  ArrowLeft, SendHorizonal, Trash2, ExternalLink,
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

// ---- minimal inline toast (same pattern as CandidatesPage) ----
type Toast = { id: number; title: string; description?: string; variant?: "default" | "destructive" };
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500);
  }, []);
  const ToastHost = () => (
    <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 999 }}>
      {toasts.map((t) => (
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

function EmptyState({ icon: Icon, title, message, action }: { icon: any; title?: string; message: string; action?: React.ReactNode }) {
  return (
    <div style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0", borderRadius: 14, padding: "40px 32px", textAlign: "center" }}>
      <Icon style={{ width: 40, height: 40, color: "#CBD5E1", margin: "0 auto 12px", display: "block" }} />
      {title && <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 700, color: "#374151" }}>{title}</h3>}
      <p style={{ color: "#64748B", fontSize: "0.875rem", margin: 0 }}>{message}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ---- types ----

interface LeadList { id: string; label: string; }

interface ReplyLIAccount {
  connected: boolean;
  profile_name?: string | null;
  email?: string | null;
  subscription?: string | null;
  status?: string | null;
  reason?: string;
}

interface ReplySeq {
  id: number;
  name: string;
  status: "active" | "paused" | "stopped" | "new";
  isArchived: boolean;
}

interface ReplyContact {
  email: string;
  firstName: string;
  lastName: string;
  status: { status: string; };
}

interface ReplyLIStats {
  totalPeopleContacted: number;
  connectionsSent: number;
  acceptedAutomatedConnections: number;
  automatedConnectionsConversionRate: number;
  messagesSent: number;
  replies: number;
  repliesConversionRate: number;
}

interface ReplyLIThread {
  threadId: number;
  personId: number | null;
  name: string;
  email?: string | null;
  sequenceId?: number | null;
  channel?: string;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount?: number;
  status?: string | null;
}

interface ReplyLIMessage {
  id?: string | number;
  text: string;
  isOutgoing: boolean;
  sentAt: string;
}

const LINKEDIN_TEMPLATES = [
  { name: "Cold outreach", connection_message: "Hi {{firstName}}, I help B2B companies build reliable sales infrastructure. Thought we'd connect well — open to it?", followup_message: "Hey {{firstName}}, thanks for connecting! I work with founders to set up scalable outbound. Worth a quick 15-min chat?" },
  { name: "Value-first", connection_message: "Hi {{firstName}}, I noticed your profile and wanted to connect — I share insights on outbound strategy relevant to your space.", followup_message: "Hey {{firstName}}, great to connect! Are you exploring ways to scale your pipeline? Happy to share what's been working." },
  { name: "Direct ask", connection_message: "Hi {{firstName}}, I help companies like yours improve outbound results 2-3x. Would love to connect and see if there's a fit.", followup_message: "" },
];

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E8F0", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", background: "#fff" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, border: "none", background: "#2563EB", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.8125rem", whiteSpace: "nowrap" };
const secondaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid #E2E8F0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: "0.8125rem" };

export default function LinkedInPage() {
  const { toast, ToastHost } = useToast();

  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [tab, setTab] = useState<"sequences" | "inbox">("sequences");

  const [replyConnected, setReplyConnected] = useState<boolean | null>(null);
  const [liAccount, setLiAccount] = useState<ReplyLIAccount | null>(null);
  const [liAccountLoading, setLiAccountLoading] = useState(false);

  const [seqs, setSeqs] = useState<ReplySeq[]>([]);
  const [seqsLoading, setSeqsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<ReplyContact[]>([]);
  const [stats, setStats] = useState<ReplyLIStats | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wName, setWName] = useState("");
  const [wConnMsg, setWConnMsg] = useState("");
  const [wFollowup, setWFollowup] = useState("");
  const [wFollowupDelay, setWFollowupDelay] = useState(3);
  const [wListId, setWListId] = useState("");
  const [creating, setCreating] = useState(false);

  // launch modal
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchSeqId, setLaunchSeqId] = useState<number | null>(null);
  const [launchPerDay, setLaunchPerDay] = useState(20);
  const [launchListId, setLaunchListId] = useState("");
  const [launching, setLaunching] = useState(false);
  const [pausingId, setPausingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // enroll
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollSeqId, setEnrollSeqId] = useState<number | null>(null);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollFirst, setEnrollFirst] = useState("");
  const [enrollLast, setEnrollLast] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollListId, setEnrollListId] = useState("");
  const [enrollingList, setEnrollingList] = useState(false);

  // inbox
  const [inbox, setInbox] = useState<ReplyLIThread[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [openThread, setOpenThread] = useState<ReplyLIThread | null>(null);
  const [messages, setMessages] = useState<ReplyLIMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedSeq = seqs.find((s) => s.id === selectedId);

  // ---- load lead lists ----
useEffect(() => {
  authFetch("/api/recruit/lead-lists")
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => setLeadLists(Array.isArray(d) ? d : d.lists ?? []))
    .catch(() => setLeadLists([]));
}, []);

// ---- check reply.io connection ----
useEffect(() => {
  authFetch("/api/replyio/validate")
    .then((r) => r.json())
    .then((d) => {
      setReplyConnected(!!d.valid);
      if (!d.valid) {
        // TEMP: remove once the mismatch is confirmed fixed
        console.warn("[replyio] not connected:", d.reason);
      }
    })
    .catch((err) => {
      console.error("[replyio] validate request failed:", err);
      setReplyConnected(false);
    });
}, []);

  // ── FIXED ──────────────────────────────────────────────────────────
  // Previously called authFetch("/linkedin-accounts") which was missing
  // the "/api" prefix AND pointed at a route that doesn't exist on either
  // router. Correct endpoint is GET /api/replyio-linkedin/account-status,
  // defined in server/routes/replyioLinkedin.ts, which returns
  // { connected: boolean, account: { id, name, status, profileUrl, ... } | null }.
  // Mapped that shape onto the ReplyLIAccount interface this component uses.
  useEffect(() => {
    if (!replyConnected) return;
    setLiAccountLoading(true);
    authFetch("/api/replyio-linkedin/account-status")
      .then((r) => r.json())
      .then((d: { connected: boolean; account: { name?: string; status?: string } | null }) => {
        setLiAccount({
          connected: d.connected,
          profile_name: d.account?.name ?? null,
          status: d.account?.status ?? null,
        });
      })
      .catch(() => setLiAccount({ connected: false }))
      .finally(() => setLiAccountLoading(false));
  }, [replyConnected]);

  const loadSeqs = useCallback(async () => {
    setSeqsLoading(true);
    try {
      const r = await authFetch("/api/replyio/sequences");
      const d = await r.json();
      setSeqs((d.sequences || []).filter((s: ReplySeq) => !s.isArchived));
    } catch {
      toast({ title: "Failed to load sequences", variant: "destructive" });
    } finally {
      setSeqsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (replyConnected) loadSeqs();
  }, [replyConnected, loadSeqs]);

  async function loadDetail(id: number) {
    setSelectedId(id);
    setDetailLoading(true);
    setStats(null);
    try {
      const [cRes, sRes] = await Promise.all([
        authFetch(`/api/replyio/sequences/${id}/contacts`),
        authFetch(`/api/replyio-linkedin/sequences/${id}/li-stats`),
      ]);
      if (cRes.ok) setContacts((await cRes.json()).contacts ?? []);
      if (sRes.ok) setStats(await sRes.json());
    } finally {
      setDetailLoading(false);
    }
  }

  function resetWizard() {
    setWName(""); setWConnMsg(""); setWFollowup(""); setWFollowupDelay(3); setWListId("");
  }

  async function handleCreateSeq() {
    if (!wName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const steps = [
        { type: "linkedin", delay_days: 0, body: wConnMsg.trim() },
        ...(wFollowup.trim() ? [{ type: "linkedin", delay_days: wFollowupDelay, body: wFollowup.trim() }] : []),
      ];
      const r = await authFetch("/api/replyio-linkedin/sequences/create", {
        method: "POST",
        body: JSON.stringify({ name: wName.trim(), steps, ...(wListId ? { lead_list_id: wListId } : {}) }),
      });
      const d = await r.json();
      if (!r.ok && d.code === "STEPS_FAILED") {
        toast({ title: "LinkedIn account not linked in Reply.io", description: "Go to Reply.io → Settings → LinkedIn Accounts and connect your account, then try again.", variant: "destructive" });
        return;
      }
      if (!r.ok) throw new Error(d.error ?? "Failed to create sequence");
      if (r.status === 207 && d.enrollError) {
        toast({ title: `Sequence "${d.name}" created`, description: d.enrollError, variant: "destructive" });
      } else if (d.enrolled > 0) {
        toast({ title: "Sequence created!", description: `Enrolled ${d.enrolled} of ${d.total} leads.` });
      } else {
        toast({ title: "Sequence created!", description: `"${d.name}" is ready in Reply.io.` });
      }
      setWizardOpen(false); resetWizard(); loadSeqs();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not create sequence", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function openLaunch(id: number) {
    setLaunchSeqId(id); setLaunchPerDay(20); setLaunchListId(""); setLaunchOpen(true);
  }

  async function confirmLaunch() {
    if (!launchSeqId) return;
    setLaunching(true);
    try {
      const settingsRes = await authFetch(`/api/replyio-linkedin/sequences/${launchSeqId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ emailsCountPerDay: launchPerDay }),
      });
      if (!settingsRes.ok) { const d = await settingsRes.json(); throw new Error(d.error ?? "Failed to update daily limit"); }

      const r = await authFetch(`/api/replyio-linkedin/sequences/${launchSeqId}/activate`, {
        method: "POST",
        body: JSON.stringify({ lead_list_id: launchListId || undefined }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setSeqs((prev) => prev.map((s) => s.id === launchSeqId ? { ...s, status: "active" } : s));
      toast({ title: "Sequence activated!", description: `${launchPerDay} actions/day` });
      setLaunchOpen(false);
    } catch (err) {
      toast({ title: "Activation failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  }

  async function handlePause(id: number) {
    setPausingId(id);
    try {
      const r = await authFetch(`/api/replyio-linkedin/sequences/${id}/pause-seq`, { method: "POST" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setSeqs((prev) => prev.map((s) => s.id === id ? { ...s, status: "paused" } : s));
      toast({ title: "Sequence paused" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setPausingId(null);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const r = await authFetch(`/api/replyio-linkedin/sequences/${id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      setSeqs((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) { setSelectedId(null); setContacts([]); setStats(null); }
      setDeleteConfirmId(null);
      toast({ title: "Sequence deleted" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleEnrollList(seqId: number, listId: string) {
    if (!listId) { toast({ title: "Select a lead list first", variant: "destructive" }); return; }
    setEnrollingList(true);
    try {
      const r = await authFetch(`/api/replyio-linkedin/sequences/${seqId}/enroll-list`, {
        method: "POST",
        body: JSON.stringify({ lead_list_id: listId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.enrolled === 0) {
        toast({ title: "0 leads enrolled", description: "Leads need a LinkedIn URL to join LinkedIn sequences.", variant: "destructive" });
      } else {
        toast({ title: "Leads enrolled!", description: `${d.enrolled} of ${d.total} contacts added.` });
      }
      if (selectedId === seqId) loadDetail(seqId);
    } catch (err) {
      toast({ title: "Enroll failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setEnrollingList(false);
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollSeqId || !enrollEmail.trim()) return;
    setEnrolling(true);
    try {
      const r = await authFetch("/api/replyio/enroll", {
        method: "POST",
        body: JSON.stringify({
          contact: { email: enrollEmail.trim(), firstName: enrollFirst || undefined, lastName: enrollLast || undefined },
          sequenceId: enrollSeqId,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Contact enrolled!", description: `${enrollEmail} added to sequence.` });
      setEnrollOpen(false); setEnrollEmail(""); setEnrollFirst(""); setEnrollLast("");
      if (selectedId === enrollSeqId) loadDetail(enrollSeqId);
    } catch (err) {
      toast({ title: "Enroll failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setEnrolling(false);
    }
  }

  // ---- inbox ----
  async function loadInbox(seqId?: number) {
    setInboxLoading(true);
    try {
      const qs = seqId ? `?sequenceId=${seqId}` : "";
      const r = await authFetch(`/api/replyio-linkedin/inbox${qs}`);
      if (r.ok) setInbox((await r.json()).threads ?? []);
      else toast({ title: "Failed to load inbox", variant: "destructive" });
    } catch {
      toast({ title: "Failed to load inbox", variant: "destructive" });
    } finally {
      setInboxLoading(false);
    }
  }

  async function openThreadPanel(thread: ReplyLIThread) {
    setOpenThread(thread); setMessages([]); setMessageInput(""); setMessagesLoading(true);
    try {
      const r = await authFetch(`/api/replyio-linkedin/inbox/${thread.threadId}/messages`);
      if (r.ok) setMessages((await r.json()).messages ?? []);
      else toast({ title: "Failed to load messages", variant: "destructive" });
    } catch {
      toast({ title: "Failed to load messages", variant: "destructive" });
    } finally {
      setMessagesLoading(false);
    }
  }

  async function refreshMessages() {
    if (!openThread) return;
    setMessagesLoading(true);
    try {
      const r = await authFetch(`/api/replyio-linkedin/inbox/${openThread.threadId}/messages`);
      if (r.ok) setMessages((await r.json()).messages ?? []);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function handleSend() {
    if (!openThread || !messageInput.trim() || sending) return;
    const text = messageInput.trim();
    setMessageInput(""); setSending(true);
    const optimistic: ReplyLIMessage = { id: `opt-${Date.now()}`, text, isOutgoing: true, sentAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const r = await authFetch(`/api/replyio-linkedin/inbox/${openThread.threadId}/reply`, {
        method: "POST",
        body: JSON.stringify({ channel: openThread.channel ?? "linkedIn", message: text }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Failed to send"); }
      setInbox((prev) => prev.map((t) => t.threadId === openThread.threadId ? { ...t, lastMessage: text, lastMessageAt: new Date().toISOString() } : t));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setMessageInput(text);
      toast({ title: "Failed to send", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  useEffect(() => { if (messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function formatTime(ts?: string | null): string {
    if (!ts) return "";
    try {
      const d = new Date(ts); const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (diff === 1) return "Yesterday";
      if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch { return ""; }
  }

  // ---- render ----

  if (replyConnected === false) {
    return (
      <>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: 0 }}>
              <Linkedin style={{ width: 22, height: 22, color: "#2563EB" }} /> LinkedIn Outreach
            </h1>
            <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: "0.9375rem" }}>Send connection requests and follow-ups via Reply.io.</p>
          </div>
          <EmptyState
            icon={ShieldAlert}
            title="Reply.io not connected"
            message="Add your Reply.io API key in Settings to start sending LinkedIn sequences."
            action={
              <a href="/settings" style={{ ...primaryBtn, textDecoration: "none", display: "inline-flex" }}>
                <Settings style={{ width: 14, height: 14 }} /> Go to Settings
              </a>
            }
          />
        </div>
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: 0 }}>
              <Linkedin style={{ width: 22, height: 22, color: "#2563EB" }} /> LinkedIn Outreach
            </h1>
            <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: "0.9375rem" }}>Send connection requests and follow-ups via Reply.io.</p>
          </div>
          <button onClick={() => { setWizardOpen(true); resetWizard(); }} style={primaryBtn}>
            <Plus style={{ width: 14, height: 14 }} /> New sequence
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <ShieldAlert style={{ width: 18, height: 18, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#92400E" }}>Account safety reminder</p>
            <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "#B45309", lineHeight: 1.5 }}>
              Keep daily limits under 30 and use natural delays to stay below LinkedIn's automation detection threshold.
            </p>
          </div>
        </div>

        {/* Account status */}
        <section style={{ marginBottom: 20 }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
            Your LinkedIn account (via Reply.io)
          </p>
          {liAccountLoading ? (
            <div style={{ ...card, padding: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <Loader2 style={{ width: 16, height: 16, color: "#2563EB" }} className="animate-spin" />
              <span style={{ fontSize: "0.875rem", color: "#64748B" }}>Checking Reply.io…</span>
            </div>
          ) : liAccount?.connected ? (
            <div style={{ ...card, padding: 18, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Linkedin style={{ width: 18, height: 18, color: "#2563EB" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "#0A0A0A" }}>{liAccount.profile_name ?? "LinkedIn account"}</p>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.6875rem", fontWeight: 700, color: "#16A34A", background: "#F0FDF4", padding: "2px 8px", borderRadius: 999 }}>
                    <CheckCircle2 style={{ width: 11, height: 11 }} /> Active
                  </span>
                </div>
                {liAccount.email && <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>{liAccount.email}</p>}
              </div>
              <a href="https://app.reply.io/settings/linkedin-accounts" target="_blank" rel="noopener noreferrer" style={{ ...secondaryBtn, textDecoration: "none" }}>
                <ExternalLink style={{ width: 13, height: 13 }} /> Manage
              </a>
            </div>
          ) : (
            <div style={{ ...card, padding: 18, display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Linkedin style={{ width: 18, height: 18, color: "#D97706" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "#0A0A0A" }}>No LinkedIn account in Reply.io</p>
                <p style={{ margin: "4px 0 12px", fontSize: "0.8125rem", color: "#64748B" }}>Add a LinkedIn account in Reply.io settings before sending sequences.</p>
                <a href="https://app.reply.io/settings/linkedin-accounts" target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, textDecoration: "none", display: "inline-flex" }}>
                  <Settings style={{ width: 13, height: 13 }} /> Add LinkedIn account
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #E2E8F0" }}>
          {([["sequences", "Sequences"], ["inbox", "Inbox"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setOpenThread(null); if (id === "inbox" && inbox.length === 0) loadInbox(selectedId ?? undefined); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: "0.875rem", fontWeight: 600,
                color: tab === id ? "#2563EB" : "#64748B",
                borderBottom: tab === id ? "2px solid #2563EB" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {id === "inbox" && <Mail style={{ width: 13, height: 13 }} />}
              {label}
            </button>
          ))}
        </div>

        {/* ── Sequences tab ── */}
        {tab === "sequences" && (
          seqsLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 className="animate-spin" style={{ width: 20, height: 20, color: "#2563EB" }} /></div>
          ) : seqs.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No sequences yet"
              message="Create your first LinkedIn sequence directly from HubCredo."
              action={<button onClick={() => { setWizardOpen(true); resetWizard(); }} style={primaryBtn}><Plus style={{ width: 14, height: 14 }} /> Create first sequence</button>}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {seqs.map((seq) => (
                  <div key={seq.id} style={{ ...card, borderColor: selectedId === seq.id ? "#93C5FD" : "#E2E8F0", background: selectedId === seq.id ? "#EFF6FF" : "#fff" }}>
                    <button onClick={() => loadDetail(seq.id)} style={{ width: "100%", textAlign: "left", padding: "12px 14px 6px", background: "transparent", border: "none", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: seq.status === "active" ? "#22C55E" : seq.status === "paused" ? "#F59E0B" : "#CBD5E1" }} />
                        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seq.name}</span>
                      </div>
                      <span style={{ display: "inline-block", marginTop: 4, fontSize: "0.6875rem", fontWeight: 700, textTransform: "capitalize", padding: "1px 8px", borderRadius: 999, background: seq.status === "active" ? "#F0FDF4" : seq.status === "paused" ? "#FFFBEB" : "#F1F5F9", color: seq.status === "active" ? "#16A34A" : seq.status === "paused" ? "#D97706" : "#64748B" }}>
                        {seq.status}
                      </span>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px 10px" }}>
                      {seq.status !== "active" ? (
                        <button onClick={() => openLaunch(seq.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 700, color: "#16A34A" }}>
                          <Play style={{ width: 11, height: 11 }} /> Launch
                        </button>
                      ) : (
                        <button onClick={() => handlePause(seq.id)} disabled={pausingId === seq.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 700, color: "#D97706" }}>
                          {pausingId === seq.id ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <Pause style={{ width: 11, height: 11 }} />} Pause
                        </button>
                      )}
                      <button onClick={() => setDeleteConfirmId(seq.id)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8" }}>
                        <Trash2 style={{ width: 11, height: 11 }} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                {!selectedSeq ? (
                  <div style={{ ...card, borderStyle: "dashed", height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ fontSize: "0.875rem", color: "#94A3B8", margin: 0 }}>Select a sequence to view contacts</p>
                  </div>
                ) : detailLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 className="animate-spin" style={{ width: 20, height: 20, color: "#2563EB" }} /></div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {stats && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                        {[
                          { label: "Contacted", value: stats.totalPeopleContacted, color: "#0A0A0A" },
                          { label: "Conn. sent", value: stats.connectionsSent, color: "#2563EB" },
                          { label: `Accepted (${stats.automatedConnectionsConversionRate}%)`, value: stats.acceptedAutomatedConnections, color: "#16A34A" },
                          { label: "Messages sent", value: stats.messagesSent, color: "#2563EB" },
                          { label: `Replies (${stats.repliesConversionRate}%)`, value: stats.replies, color: "#7C3AED" },
                        ].map((s) => (
                          <div key={s.label} style={{ ...card, padding: "12px 8px", textAlign: "center" }}>
                            <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: s.color }}>{s.value}</p>
                            <p style={{ margin: "2px 0 0", fontSize: "0.6875rem", color: "#94A3B8" }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ ...card, padding: 16 }}>
                      <p style={{ margin: "0 0 10px", fontSize: "0.8125rem", fontWeight: 700, color: "#0A0A0A" }}>Enroll from lead list</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <select value={enrollListId} onChange={(e) => setEnrollListId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                          <option value="">Select a lead list…</option>
                          {leadLists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                        <button onClick={() => handleEnrollList(selectedId!, enrollListId)} disabled={!enrollListId || enrollingList} style={primaryBtn}>
                          {enrollingList ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />} Enroll list
                        </button>
                      </div>
                    </div>

                    <div style={{ ...card, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>
                          {selectedSeq.name} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#94A3B8" }}>{contacts.length} contacts</span>
                        </p>
                        <button onClick={() => { setEnrollSeqId(selectedId); setEnrollOpen(true); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, color: "#2563EB" }}>+ Add contact</button>
                      </div>
                      {contacts.length === 0 ? (
                        <p style={{ textAlign: "center", padding: "16px 0", fontSize: "0.875rem", color: "#94A3B8", margin: 0 }}>No contacts yet</p>
                      ) : (
                        <div>
                          {contacts.map((c) => (
                            <div key={c.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #F1F5F9" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", flexShrink: 0 }}>
                                  {(c.firstName?.[0] ?? c.email[0]).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "#0A0A0A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.firstName} {c.lastName}</p>
                                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#94A3B8" }}>{c.email}</p>
                                </div>
                              </div>
                              <span style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "capitalize", padding: "2px 8px", borderRadius: 999, background: "#F1F5F9", color: "#64748B", flexShrink: 0 }}>
                                {c.status?.status?.replace(/_/g, " ") ?? "unknown"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ── Inbox tab ── */}
        {tab === "inbox" && (
          openThread ? (
            <div style={{ ...card, overflow: "hidden", display: "flex", flexDirection: "column", height: 560 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <button onClick={() => setOpenThread(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}><ArrowLeft style={{ width: 16, height: 16 }} /></button>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2563EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8125rem" }}>
                  {(openThread.name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>{openThread.name}</p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#94A3B8" }}>LinkedIn · via Reply.io</p>
                </div>
                <button onClick={refreshMessages} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}>
                  <RefreshCcw className={messagesLoading ? "animate-spin" : ""} style={{ width: 14, height: 14 }} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#FAFAF9" }}>
                {messagesLoading ? (
                  <div style={{ margin: "auto" }}><Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "#2563EB" }} /></div>
                ) : messages.length === 0 ? (
                  <p style={{ margin: "auto", fontSize: "0.875rem", color: "#94A3B8" }}>No messages yet</p>
                ) : (
                  <>
                    {messages.map((m, i) => (
                      <div key={m.id ?? i} style={{ display: "flex", justifyContent: m.isOutgoing ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "72%", padding: "9px 13px", borderRadius: 16, fontSize: "0.875rem", lineHeight: 1.4,
                          background: m.isOutgoing ? "#2563EB" : "#fff",
                          color: m.isOutgoing ? "#fff" : "#0A0A0A",
                          border: m.isOutgoing ? "none" : "1px solid #E2E8F0",
                        }}>
                          {m.text || "📎 Attachment"}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <div style={{ padding: 12, borderTop: "1px solid #E2E8F0", display: "flex", gap: 8 }}>
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message… (Enter to send)"
                  rows={2}
                  style={{ ...inputStyle, flex: 1, resize: "none", background: "#F8FAFC" }}
                />
                <button onClick={handleSend} disabled={!messageInput.trim() || sending} style={{ ...primaryBtn, padding: 12, alignSelf: "flex-end" }}>
                  {sending ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <SendHorizonal style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>
          ) : inboxLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 className="animate-spin" style={{ width: 20, height: 20, color: "#2563EB" }} /></div>
          ) : inbox.length === 0 ? (
            <EmptyState icon={Mail} title="No messages yet" message="LinkedIn replies will appear here once your connections start responding." action={<button onClick={() => loadInbox(selectedId ?? undefined)} style={secondaryBtn}><RefreshCcw style={{ width: 13, height: 13 }} /> Refresh inbox</button>} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94A3B8" }}>{inbox.length} conversation{inbox.length !== 1 ? "s" : ""}</p>
                <button onClick={() => loadInbox(selectedId ?? undefined)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: "0.8125rem", color: "#64748B" }}><RefreshCcw style={{ width: 13, height: 13 }} /> Refresh</button>
              </div>
              {inbox.map((thread) => {
                const unread = (thread.unreadCount ?? 0) > 0;
                return (
                  <button key={thread.threadId} onClick={() => openThreadPanel(thread)} style={{ ...card, textAlign: "left", padding: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, borderColor: unread ? "#93C5FD" : "#E2E8F0", background: unread ? "#EFF6FF" : "#fff" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#2563EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.875rem", flexShrink: 0 }}>
                      {(thread.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: unread ? 700 : 600, color: "#0A0A0A" }}>{thread.name ?? "Unknown contact"}</p>
                        {thread.lastMessageAt && <span style={{ fontSize: "0.6875rem", color: unread ? "#2563EB" : "#94A3B8", flexShrink: 0 }}>{formatTime(thread.lastMessageAt)}</span>}
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: unread ? "#0A0A0A" : "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {thread.lastMessage ?? "Tap to open"}
                      </p>
                    </div>
                    <MessageCircle style={{ width: 16, height: 16, color: "#CBD5E1", flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── New sequence wizard ── */}
      {wizardOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ ...card, width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 800, color: "#0A0A0A" }}>New LinkedIn Sequence</h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>Connection request + optional follow-up, via Reply.io</p>
              </div>
              <button onClick={() => setWizardOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Sequence name *</label>
                <input autoFocus value={wName} onChange={(e) => setWName(e.target.value)} placeholder="e.g. Q3 LinkedIn Outreach" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Apply template (optional)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {LINKEDIN_TEMPLATES.map((t) => (
                    <button key={t.name} onClick={() => { setWConnMsg(t.connection_message); setWFollowup(t.followup_message); }} style={{ textAlign: "left", padding: "8px 10px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: "0.75rem", fontWeight: 600, color: "#2563EB", cursor: "pointer" }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Step 1 — Connection request <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional, max 300 chars)</span></label>
                <textarea value={wConnMsg} onChange={(e) => setWConnMsg(e.target.value)} rows={3} maxLength={300} placeholder="Leave blank for a plain connection request, or write a note…" style={{ ...inputStyle, resize: "none" }} />
                <p style={{ textAlign: "right", margin: "2px 0 0", fontSize: "0.6875rem", color: "#94A3B8" }}>{wConnMsg.length}/300</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Step 2 — Follow-up <span style={{ fontWeight: 400, color: "#94A3B8" }}>(optional)</span></label>
                <textarea value={wFollowup} onChange={(e) => setWFollowup(e.target.value)} rows={3} placeholder="Hey {{firstName}}, thanks for connecting!…" style={{ ...inputStyle, resize: "none" }} />
                {wFollowup && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Send after</span>
                    <input type="number" min={1} max={30} value={wFollowupDelay} onChange={(e) => setWFollowupDelay(Number(e.target.value))} style={{ width: 60, padding: "5px 8px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: "0.75rem", textAlign: "center" }} />
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>days after accepted</span>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Enroll a lead list (optional)</label>
                <select value={wListId} onChange={(e) => setWListId(e.target.value)} style={inputStyle}>
                  <option value="">Skip — enroll manually later</option>
                  {leadLists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, padding: 16, borderTop: "1px solid #E2E8F0" }}>
              <button onClick={() => setWizardOpen(false)} style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancel</button>
              <button onClick={handleCreateSeq} disabled={creating || !wName.trim()} style={{ ...primaryBtn, flex: 1, justifyContent: "center" }}>
                {creating ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Creating…</> : <><CheckCircle2 style={{ width: 14, height: 14 }} /> Create sequence</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Launch modal ── */}
      {launchOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ ...card, width: "100%", maxWidth: 380, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Linkedin style={{ width: 16, height: 16, color: "#2563EB" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "#0A0A0A" }}>Launch sequence</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "#64748B" }}>Set your daily limit, then go live.</p>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>Enroll lead list (if not already enrolled)</label>
              <select value={launchListId} onChange={(e) => setLaunchListId(e.target.value)} style={inputStyle}>
                <option value="">Skip — contacts already enrolled</option>
                {leadLists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>Max actions per day</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" min={1} max={100} value={launchPerDay} onChange={(e) => setLaunchPerDay(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} style={{ ...inputStyle, width: 80, textAlign: "center", fontWeight: 700 }} />
                {[10, 20, 30, 50].map((v) => (
                  <button key={v} onClick={() => setLaunchPerDay(v)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E2E8F0", background: launchPerDay === v ? "#2563EB" : "#fff", color: launchPerDay === v ? "#fff" : "#64748B", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>{v}</button>
                ))}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "0.6875rem", color: "#94A3B8" }}>Keep under 30/day to stay within LinkedIn's safe threshold.</p>
              {launchPerDay > 50 && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, padding: "8px 10px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
                  <ShieldAlert style={{ width: 13, height: 13, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: "0.6875rem", color: "#92400E" }}>High limit — values above 50/day risk account restrictions.</p>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setLaunchOpen(false)} disabled={launching} style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancel</button>
              <button onClick={confirmLaunch} disabled={launching} style={{ ...primaryBtn, flex: 1, justifyContent: "center" }}>
                {launching ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Launching…</> : <><Play style={{ width: 14, height: 14 }} /> Go Live</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Enroll contact modal ── */}
      {enrollOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ ...card, width: "100%", maxWidth: 360, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #E2E8F0" }}>
              <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>Enroll Contact</h3>
              <button onClick={() => setEnrollOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}><X style={{ width: 15, height: 15 }} /></button>
            </div>
            <form onSubmit={handleEnroll} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Sequence</label>
                <select value={enrollSeqId ?? ""} onChange={(e) => setEnrollSeqId(Number(e.target.value))} style={inputStyle}>
                  <option value="">Select sequence…</option>
                  {seqs.filter((s) => s.status === "active").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Email *</label>
                <input type="email" required value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} placeholder="name@company.com" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>First name</label>
                  <input value={enrollFirst} onChange={(e) => setEnrollFirst(e.target.value)} placeholder="Jane" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Last name</label>
                  <input value={enrollLast} onChange={(e) => setEnrollLast(e.target.value)} placeholder="Smith" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" onClick={() => setEnrollOpen(false)} style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancel</button>
                <button type="submit" disabled={enrolling || !enrollEmail || !enrollSeqId} style={{ ...primaryBtn, flex: 1, justifyContent: "center" }}>
                  {enrolling ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Play style={{ width: 14, height: 14 }} />} {enrolling ? "Enrolling…" : "Enroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirmId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ ...card, width: "100%", maxWidth: 360, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ShieldAlert style={{ width: 16, height: 16, color: "#DC2626" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "#0A0A0A" }}>Delete sequence?</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "#64748B" }}>This permanently deletes the sequence and its contacts from Reply.io.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} disabled={deletingId === deleteConfirmId} style={{ ...primaryBtn, flex: 1, justifyContent: "center", background: "#DC2626" }}>
                {deletingId === deleteConfirmId ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Deleting…</> : <><Trash2 style={{ width: 14, height: 14 }} /> Yes, delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastHost />
    </>
  );
}