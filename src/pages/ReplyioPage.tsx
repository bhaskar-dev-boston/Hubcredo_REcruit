import { useState, useEffect, useCallback } from "react";
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

interface ReplySequence { id: number; name: string; status: "active" | "paused" | "stopped"; isArchived: boolean; channel?: "email" | "linkedin"; }
interface ReplyContactStatus { status?: string; replied?: boolean; opened?: boolean; clicked?: boolean; bounced?: boolean; delivered?: boolean; }
interface ReplySequenceContact { id?: number; email: string; firstName?: string; lastName?: string; status?: ReplyContactStatus; }
interface ReplyStats {
  sequenceId: number; total: number; active: number; delivered: number; opened: number; clicked: number;
  replied: number; bounced: number; deliveredPercentage: number; openedPercentage: number; repliedPercentage: number; bouncedPercentage: number;
}
interface LiStats {
  totalPeopleContacted: number; connectionsSent: number; acceptedAutomatedConnections: number;
  automatedConnectionsConversionRate: number; messagesSent: number; replies: number; repliesConversionRate: number;
}
interface ReplyWebhook { id: number; eventType: string; url: string; }

// ---- minimal inline toast ----
type Toast = { id: number; title: string; variant?: "default" | "destructive" };
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000);
  }, []);
  const ToastHost = () => (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: "10px 16px", borderRadius: 10, fontSize: "0.875rem", fontWeight: 600, color: "#fff",
          background: t.variant === "destructive" ? "#DC2626" : "#059669", boxShadow: "0 8px 24px rgba(0,0,0,.15)",
        }}>{t.title}</div>
      ))}
    </div>
  );
  return { toast, ToastHost };
}

function Spinner({ size = 18, color = "#2563EB" }: { size?: number; color?: string }) {
  return <div className="animate-spin" style={{ width: size, height: size, border: `2px solid ${color}33`, borderTopColor: color, borderRadius: "50%" }} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    active: { bg: "#F0FDF4", fg: "#15803D" }, paused: { bg: "#FFFBEB", fg: "#B45309" },
    stopped: { bg: "#F3F4F6", fg: "#6B7280" }, replied: { bg: "#EFF6FF", fg: "#2563EB" },
    bounced: { bg: "#FEF2F2", fg: "#DC2626" }, finished: { bg: "#F5F3FF", fg: "#7C3AED" },
    in_progress: { bg: "#EFF6FF", fg: "#2563EB" },
  };
  const c = map[status] ?? { bg: "#F3F4F6", fg: "#6B7280" };
  return <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: "0.6875rem", fontWeight: 700, textTransform: "capitalize", background: c.bg, color: c.fg }}>{status.replace(/_/g, " ")}</span>;
}

function EnrollModal({ open, onClose, sequences, enrolling, onEnroll }: {
  open: boolean; onClose: () => void; sequences: ReplySequence[]; enrolling: boolean;
  onEnroll: (payload: { email: string; firstName?: string; lastName?: string; title?: string; company?: string; linkedInProfile?: string; phone?: string; sequenceId: number }) => Promise<void>;
}) {
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", title: "", company: "", linkedInProfile: "", phone: "", sequenceId: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit() {
    setFormError(null);
    if (!form.email) { setFormError("Email is required"); return; }
    if (!form.sequenceId) { setFormError("Please select a sequence"); return; }
    try {
      await onEnroll({
        email: form.email, firstName: form.firstName || undefined, lastName: form.lastName || undefined,
        title: form.title || undefined, company: form.company || undefined,
        linkedInProfile: form.linkedInProfile || undefined, phone: form.phone || undefined,
        sequenceId: parseInt(form.sequenceId),
      });
      onClose();
    } catch { /* toast shown by caller */ }
  }

  if (!open) return null;
  const available = sequences.filter(s => !s.isArchived && s.status === "active");
  const inputCls: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E8F0", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 800, color: "#0A0A0A" }}>Enroll in Sequence</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "1.125rem" }}>✕</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Sequence <span style={{ color: "#F87171" }}>*</span></label>
            {available.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "#B45309", background: "#FFFBEB", padding: "8px 12px", borderRadius: 9, margin: 0 }}>No active sequences found.</p>
            ) : (
              <select value={form.sequenceId} onChange={set("sequenceId")} style={inputCls}>
                <option value="">Select a sequence…</option>
                {available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 10px" }}>Contact Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { k: "email", label: "Email", type: "email", ph: "name@company.com", req: true },
                { k: "phone", label: "Phone", type: "tel", ph: "+1 555 000 0000" },
                { k: "firstName", label: "First Name", ph: "Jane" },
                { k: "lastName", label: "Last Name", ph: "Smith" },
                { k: "title", label: "Job Title", ph: "Head of Marketing" },
                { k: "company", label: "Company", ph: "Acme Inc." },
              ].map(({ k, label, type, ph, req }) => (
                <div key={k}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>{label} {req && <span style={{ color: "#F87171" }}>*</span>}</label>
                  <input type={type ?? "text"} value={(form as Record<string, string>)[k]} onChange={set(k)} placeholder={ph} style={inputCls} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>LinkedIn URL</label>
              <input value={form.linkedInProfile} onChange={set("linkedInProfile")} placeholder="https://linkedin.com/in/janesmith" style={inputCls} />
            </div>
          </div>
          {formError && <p style={{ fontSize: "0.8125rem", color: "#DC2626", background: "#FEF2F2", padding: "8px 12px", borderRadius: 9, margin: 0 }}>{formError}</p>}
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", fontSize: "0.875rem", fontWeight: 600, color: "#64748B", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={enrolling || available.length === 0} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", fontSize: "0.875rem", fontWeight: 700, color: "#fff", background: "#2563EB", border: "none", borderRadius: 9, cursor: "pointer", opacity: enrolling || available.length === 0 ? 0.5 : 1 }}>
            {enrolling && <Spinner size={14} color="#fff" />} {enrolling ? "Enrolling…" : "Enroll Contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WebhookPanel({ webhooks, loading, registering, onFetch, onRegister }: {
  webhooks: ReplyWebhook[]; loading: boolean; registering: boolean; onFetch: () => void; onRegister: (event: string, url: string) => void;
}) {
  const [event, setEvent] = useState("email_replied");
  const [url, setUrl] = useState("");
  const EVENTS = ["email_replied", "email_opened", "email_link_clicked", "email_bounced", "email_sent", "contact_finished"];
  const inputCls: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E8F0", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>Webhook Config</h3>
        <button onClick={onFetch} style={{ fontSize: "0.75rem", color: "#2563EB", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>{loading ? "Loading…" : "Refresh"}</button>
      </div>
      {webhooks.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "#9CA3AF", margin: 0 }}>No webhooks registered yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {webhooks.map(w => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #F8FAFC" }}>
              <span style={{ fontSize: "0.75rem", fontFamily: "monospace", background: "#F1F5F9", color: "#374151", padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>{w.eventType}</span>
              <span style={{ fontSize: "0.75rem", color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.url}>{w.url}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em", margin: 0 }}>Register New Webhook</p>
        <select value={event} onChange={e => setEvent(e.target.value)} style={inputCls}>
          {EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourdomain.com/api/replyio/webhook-receiver" style={inputCls} />
        <button onClick={() => { if (url) onRegister(event, url); }} disabled={registering || !url} style={{ padding: "9px 0", fontSize: "0.875rem", fontWeight: 700, color: "#fff", background: "#2563EB", border: "none", borderRadius: 9, cursor: "pointer", opacity: registering || !url ? 0.5 : 1 }}>
          {registering ? "Registering…" : "Register Webhook"}
        </button>
      </div>
    </div>
  );
}

export default function ReplyioPage() {
  const { toast, ToastHost } = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectedUser, setConnectedUser] = useState<{ email: string; name: string } | null>(null);

  const [sequences, setSequences] = useState<ReplySequence[]>([]);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState<number | null>(null);
  const [sequenceContacts, setSequenceContacts] = useState<ReplySequenceContact[]>([]);
  const [sequenceStats, setSequenceStats] = useState<ReplyStats | null>(null);
  const [liStats, setLiStats] = useState<LiStats | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [enrolling, setEnrolling] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [pausingContactId, setPausingContactId] = useState<number | null>(null);

  const [webhooks, setWebhooks] = useState<ReplyWebhook[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [showWebhooks, setShowWebhooks] = useState(false);

  const checkConnection = useCallback(async () => {
    setConnectionLoading(true);
    try {
      const r = await authFetch("/api/replyio/validate");
      const d = await r.json();
      setIsConnected(!!d.valid);
      setConnectedUser(d.user ?? null);
    } catch {
      setIsConnected(false);
      setConnectedUser(null);
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const fetchSequences = useCallback(async () => {
    setSequencesLoading(true);
    try {
      const r = await authFetch("/api/replyio/sequences");
      const d = await r.json();
      setSequences(d.sequences ?? []);
    } catch {
      toast({ title: "Failed to load sequences", variant: "destructive" });
    } finally {
      setSequencesLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (isConnected) fetchSequences(); }, [isConnected, fetchSequences]);

  const fetchSequenceData = useCallback(async (id: number) => {
    setContactsLoading(true);
    try {
      const [cRes, sRes, lRes] = await Promise.all([
        authFetch(`/api/replyio/sequences/${id}/contacts`),
        authFetch(`/api/replyio/sequences/${id}/stats`).catch(() => null),
        authFetch(`/api/replyio-linkedin/sequences/${id}/li-stats`).catch(() => null),
      ]);
      if (cRes.ok) setSequenceContacts((await cRes.json()).contacts ?? []);
      setSequenceStats(sRes && sRes.ok ? await sRes.json() : null);
      setLiStats(lRes && lRes.ok ? await lRes.json() : null);
    } catch {
      toast({ title: "Failed to load sequence data", variant: "destructive" });
    } finally {
      setContactsLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (selectedSequenceId !== null) fetchSequenceData(selectedSequenceId); }, [selectedSequenceId, fetchSequenceData]);

  async function enrollContact(payload: { email: string; firstName?: string; lastName?: string; title?: string; company?: string; linkedInProfile?: string; phone?: string; sequenceId: number }) {
    setEnrolling(true);
    try {
      const { sequenceId, ...contact } = payload;
      const r = await authFetch("/api/replyio/enroll", { method: "POST", body: JSON.stringify({ contact, sequenceId }) });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: `${payload.email} enrolled successfully` });
      if (selectedSequenceId === payload.sequenceId) await fetchSequenceData(payload.sequenceId);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to enroll contact", variant: "destructive" });
      throw err;
    } finally {
      setEnrolling(false);
    }
  }

  async function pauseContact(sequenceId: number, contactId: number) {
    setPausingContactId(contactId);
    try {
      const r = await authFetch(`/api/replyio/sequences/${sequenceId}/contacts/${contactId}/pause`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Contact paused" });
      await fetchSequenceData(sequenceId);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to pause contact", variant: "destructive" });
    } finally {
      setPausingContactId(null);
    }
  }

  const fetchWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    try {
      const r = await authFetch("/api/replyio/webhooks");
      const d = await r.json();
      setWebhooks(d.webhooks ?? []);
    } catch {
      toast({ title: "Failed to load webhooks", variant: "destructive" });
    } finally {
      setWebhooksLoading(false);
    }
  }, [toast]);

  async function registerWebhook(event: string, callbackUrl: string) {
    setRegisteringWebhook(true);
    try {
      const r = await authFetch("/api/replyio/webhooks", { method: "POST", body: JSON.stringify({ event, callbackUrl }) });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Webhook registered" });
      await fetchWebhooks();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to register webhook", variant: "destructive" });
    } finally {
      setRegisteringWebhook(false);
    }
  }

  const selectedSequence = sequences.find(s => s.id === selectedSequenceId) ?? null;

  if (connectionLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, gap: 12, color: "#64748B" }}>
        <Spinner /> <span style={{ fontSize: "0.875rem" }}>Checking Reply.io connection…</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 32, textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "1.5rem" }}>⚠️</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 700, color: "#0A0A0A" }}>Reply.io Not Connected</h2>
          <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0 }}>Add your Reply.io API key in Settings to enable outreach and webhooks.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A" }}>Reply.io Outreach</h1>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", fontWeight: 700, background: "#F0FDF4", color: "#15803D", padding: "3px 10px", borderRadius: 999 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} /> Connected
            </span>
          </div>
          {connectedUser && <p style={{ fontSize: "0.8125rem", color: "#9CA3AF", margin: "4px 0 0" }}>{connectedUser.email}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { setShowWebhooks(v => !v); if (!showWebhooks) fetchWebhooks(); }} style={{ padding: "9px 16px", fontSize: "0.875rem", fontWeight: 600, color: "#64748B", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 9, cursor: "pointer" }}>Webhooks</button>
          <button onClick={fetchSequences} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", fontSize: "0.875rem", fontWeight: 600, color: "#64748B", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 9, cursor: "pointer" }}>
            {sequencesLoading && <Spinner size={13} color="#64748B" />} Refresh
          </button>
          <button onClick={() => setEnrollOpen(true)} style={{ padding: "9px 18px", fontSize: "0.875rem", fontWeight: 700, color: "#fff", background: "#2563EB", border: "none", borderRadius: 9, cursor: "pointer" }}>+ Enroll Contact</button>
        </div>
      </div>

      {showWebhooks && (
        <WebhookPanel webhooks={webhooks} loading={webhooksLoading} registering={registeringWebhook} onFetch={fetchWebhooks} onRegister={registerWebhook} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#374151" }}>Sequences</h2>
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>{sequences.length} total</span>
          </div>
          {sequencesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}><Spinner /></div>
          ) : sequences.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: "0.875rem", color: "#9CA3AF", margin: 0 }}>No sequences found.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sequences.map(seq => (
                <button key={seq.id} onClick={() => setSelectedSequenceId(seq.id)} style={{
                  textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${selectedSequenceId === seq.id ? "#93C5FD" : "#E2E8F0"}`, background: selectedSequenceId === seq.id ? "#EFF6FF" : "#fff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: seq.status === "active" ? "#4ADE80" : seq.status === "paused" ? "#FBBF24" : "#D1D5DB" }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seq.name}</span>
                  </div>
                  <StatusBadge status={seq.status} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!selectedSequence ? (
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: "0.875rem", color: "#9CA3AF" }}>Select a sequence to view contacts</p>
            </div>
          ) : (
            <>
              {liStats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                  {[
                    { label: "Total contacted", value: liStats.totalPeopleContacted, color: "#374151" },
                    { label: "Connections sent", value: liStats.connectionsSent, color: "#2563EB" },
                    { label: "Accepted", value: liStats.acceptedAutomatedConnections, sub: `${liStats.automatedConnectionsConversionRate.toFixed(1)}%`, color: "#2563EB" },
                    { label: "Messages sent", value: liStats.messagesSent, color: "#374151" },
                    { label: "Replies", value: liStats.replies, sub: `${liStats.repliesConversionRate.toFixed(1)}%`, color: "#7C3AED" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: s.color }}>{s.value}</p>
                      {s.sub && <p style={{ margin: "2px 0 0", fontSize: "0.6875rem", fontWeight: 700, color: s.color }}>{s.sub}</p>}
                      <p style={{ margin: "2px 0 0", fontSize: "0.6875rem", color: "#9CA3AF" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {sequenceStats && !liStats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                  {[
                    { label: "Contacted", value: sequenceStats.total, color: "#374151" },
                    { label: "Delivered", value: sequenceStats.delivered, sub: `${sequenceStats.deliveredPercentage}%`, color: "#2563EB" },
                    { label: "Opened", value: sequenceStats.opened, sub: `${sequenceStats.openedPercentage}%`, color: "#4F46E5" },
                    { label: "Replied", value: sequenceStats.replied, sub: `${sequenceStats.repliedPercentage}%`, color: "#059669" },
                    { label: "Bounced", value: sequenceStats.bounced, sub: `${sequenceStats.bouncedPercentage}%`, color: "#DC2626" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: s.color }}>{s.value}</p>
                      {s.sub && <p style={{ margin: "2px 0 0", fontSize: "0.6875rem", fontWeight: 700, color: s.color }}>{s.sub}</p>}
                      <p style={{ margin: "2px 0 0", fontSize: "0.6875rem", color: "#9CA3AF" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>
                    {selectedSequence.name} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#9CA3AF" }}>{sequenceContacts.length} contact{sequenceContacts.length !== 1 ? "s" : ""}</span>
                  </h3>
                  <button onClick={() => setEnrollOpen(true)} style={{ fontSize: "0.75rem", color: "#2563EB", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>+ Add contact</button>
                </div>
                {contactsLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>
                ) : sequenceContacts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <p style={{ fontSize: "0.875rem", color: "#9CA3AF", margin: "0 0 8px" }}>No contacts in this sequence yet.</p>
                    <button onClick={() => setEnrollOpen(true)} style={{ fontSize: "0.8125rem", color: "#2563EB", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Enroll your first contact →</button>
                  </div>
                ) : (
                  <div>
                    {sequenceContacts.map(c => {
                      const s = c.status ?? {};
                      const flags = [
                        s.replied && { label: "Replied", color: "#2563EB" },
                        s.opened && { label: "Opened", color: "#7C3AED" },
                        s.clicked && { label: "Clicked", color: "#4F46E5" },
                        s.bounced && { label: "Bounced", color: "#DC2626" },
                      ].filter(Boolean) as { label: string; color: string }[];
                      return (
                        <div key={c.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #F8FAFC", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", flexShrink: 0 }}>
                              {(c.firstName?.[0] ?? c.email[0]).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.firstName} {c.lastName}</p>
                              <p style={{ margin: 0, fontSize: "0.75rem", color: "#9CA3AF" }}>{c.email}</p>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            {flags.map(f => <span key={f.label} style={{ fontSize: "0.6875rem", fontWeight: 700, color: f.color }}>{f.label}</span>)}
                            <StatusBadge status={s.status ?? "unknown"} />
                            {c.id && s.status !== "paused" && (
                              <button onClick={() => pauseContact(selectedSequenceId!, c.id!)} disabled={pausingContactId === c.id} title="Pause this contact" style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", display: "flex" }}>
                                {pausingContactId === c.id ? <Spinner size={13} color="#D97706" /> : "⏸"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <EnrollModal open={enrollOpen} onClose={() => setEnrollOpen(false)} sequences={sequences} enrolling={enrolling} onEnroll={enrollContact} />
      <ToastHost />
    </div>
  );
}