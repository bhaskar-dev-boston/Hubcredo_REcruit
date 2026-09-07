import { useState, useEffect, useCallback } from "react";
import { ArrowRight, Users, Briefcase, Building2, CalendarDays, Loader2, Mail, Linkedin } from "lucide-react";
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

interface DashboardStats {
  open_roles: number;
  candidates_in_play: number;
  awaiting_client: number;
  interviews_this_week: number;
}

interface LeadList {
  id: string;
  label?: string | null;
  total_count?: number;
}

interface ReplySeq { id: number; name: string; status: string; isArchived: boolean; channel?: "email" | "linkedin"; }
interface ReplyStats { total: number; opened: number; replied: number; bounced: number; }
interface LiStats { connectionsSent: number; acceptedAutomatedConnections: number; messagesSent: number; replies: number; }

export default function OverviewPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── NEW: counts derived from lead lists (candidates/clients) ──
  const [leadCounts, setLeadCounts] = useState<{ candidatesInPlay: number; awaitingClient: number }>({
    candidatesInPlay: 0,
    awaitingClient: 0,
  });
  const [leadCountsLoading, setLeadCountsLoading] = useState(true);

  const [emailStats, setEmailStats] = useState<{ active: number; total: number; sent: number; opened: number; replied: number; bounced: number } | null>(null);
  const [liStats, setLiStats] = useState<{ active: number; total: number; connectionsSent: number; acceptedConnections: number; messagesSent: number; replies: number } | null>(null);
  const [replyStatsLoading, setReplyStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await authFetch("/api/recruit/dashboard");
      if (r.ok) setStats(await r.json());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── NEW: pull lead lists and sum counts for "candidate" vs "client" lists ──
  const loadLeadCounts = useCallback(async () => {
    setLeadCountsLoading(true);
    try {
      const r = await authFetch("/api/recruit/lead-lists");
      if (r.ok) {
        const lists: LeadList[] = await r.json();
        let candidatesInPlay = 0;
        let awaitingClient = 0;
        for (const list of lists) {
          const label = (list.label ?? "").toLowerCase();
          const count = list.total_count ?? 0;
          if (label.includes("candidate")) candidatesInPlay += count;
          else if (label.includes("client")) awaitingClient += count;
        }
        setLeadCounts({ candidatesInPlay, awaitingClient });
      }
    } finally {
      setLeadCountsLoading(false);
    }
  }, []);

  useEffect(() => { loadLeadCounts(); }, [loadLeadCounts]);

  useEffect(() => {
    let cancelled = false;
    async function loadReplyStats() {
      setReplyStatsLoading(true);
      try {
        const [emailRes, liRes] = await Promise.all([
          authFetch("/api/replyio/sequences"),
          authFetch("/api/replyio-linkedin/sequences"),
        ]);
        if (cancelled) return;

        if (emailRes.ok) {
          const emailData = await emailRes.json();
          const seqs: ReplySeq[] = emailData.sequences ?? [];
          const emailSeqs = seqs.filter(s => !s.isArchived && s.channel !== "linkedin");
          const active = emailSeqs.filter(s => s.status === "active").length;
          let sent = 0, opened = 0, replied = 0, bounced = 0;
          await Promise.all(emailSeqs.slice(0, 5).map(async seq => {
            try {
              const sRes = await authFetch(`/api/replyio/sequences/${seq.id}/stats`);
              if (sRes.ok) {
                const s: ReplyStats = await sRes.json();
                sent += s.total ?? 0; opened += s.opened ?? 0; replied += s.replied ?? 0; bounced += s.bounced ?? 0;
              }
            } catch { /* ignore */ }
          }));
          setEmailStats({ active, total: emailSeqs.length, sent, opened, replied, bounced });
        }

        if (liRes.ok) {
          const liData = await liRes.json();
          const liSeqs: ReplySeq[] = liData.sequences ?? [];
          const active = liSeqs.filter(s => s.status === "active").length;
          let connectionsSent = 0, acceptedConnections = 0, messagesSent = 0, replies = 0;
          await Promise.all(liSeqs.slice(0, 5).map(async seq => {
            try {
              const sRes = await authFetch(`/api/replyio-linkedin/sequences/${seq.id}/li-stats`);
              if (sRes.ok) {
                const s: LiStats = await sRes.json();
                connectionsSent += s.connectionsSent ?? 0; acceptedConnections += s.acceptedAutomatedConnections ?? 0;
                messagesSent += s.messagesSent ?? 0; replies += s.replies ?? 0;
              }
            } catch { /* ignore */ }
          }));
          setLiStats({ active, total: liSeqs.length, connectionsSent, acceptedConnections, messagesSent, replies });
        }
      } catch { /* Reply.io may not be connected */ }
      finally { if (!cancelled) setReplyStatsLoading(false); }
    }
    loadReplyStats();
    return () => { cancelled = true; };
  }, []);

  // ── UPDATED: Candidates in Play / Awaiting Client now come from leadCounts, with their own loading flag ──
  const statCards = [
    { label: "Open Roles", value: stats?.open_roles, loading: statsLoading, icon: Briefcase, page: "roles", color: "#2563EB", bg: "#EFF6FF" },
    { label: "Candidates in Play", value: leadCounts.candidatesInPlay, loading: leadCountsLoading, icon: Users, page: "candidates", color: "#059669", bg: "#F0FDF4" },
    { label: "Awaiting Client", value: leadCounts.awaitingClient, loading: leadCountsLoading, icon: Building2, page: "clients", color: "#7C3AED", bg: "#F5F3FF" },
    { label: "Interviews This Week", value: stats?.interviews_this_week, loading: statsLoading, icon: CalendarDays, page: "roles", color: "#D97706", bg: "#FFFBEB" },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Dashboard</h1>
        <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: "0.9375rem" }}>Your recruiting pipeline at a glance</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {statCards.map(({ label, value, loading, icon: Icon, page, color, bg }) => (
          <button
            key={label}
            onClick={() => onNavigate?.(page)}
            style={{
              background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 20, textAlign: "left",
              cursor: onNavigate ? "pointer" : "default", transition: "border-color .15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon style={{ width: 16, height: 16, color }} />
              </div>
              {onNavigate && <ArrowRight style={{ width: 15, height: 15, color: "#CBD5E1" }} />}
            </div>
            <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px" }}>
              {loading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : value ?? 0}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>{label}</p>
          </button>
        ))}
      </div>

      {(emailStats || liStats) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {emailStats && (
            <button onClick={() => onNavigate?.("campaigns")} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 20, textAlign: "left", cursor: onNavigate ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: "#F0F9FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Mail style={{ width: 15, height: 15, color: "#0EA5E9" }} />
                  </div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0A0A0A" }}>Email Outreach</span>
                  <span style={{ fontSize: "0.625rem", color: "#9CA3AF" }}>via Reply.io</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {emailStats.active > 0 && <span style={{ fontSize: "0.625rem", fontWeight: 700, background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0", padding: "2px 6px", borderRadius: 999 }}>{emailStats.active} active</span>}
                  {onNavigate && <ArrowRight style={{ width: 15, height: 15, color: "#CBD5E1" }} />}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {[
                  { label: "Sequences", value: emailStats.total, color: "#0A0A0A" },
                  { label: "Sent", value: emailStats.sent, color: "#64748B" },
                  { label: "Opened", value: emailStats.opened, color: "#0EA5E9" },
                  { label: "Replied", value: emailStats.replied, color: "#059669" },
                  { label: "Bounced", value: emailStats.bounced, color: "#DC2626" },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: "1.125rem", fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: "0.625rem", color: "#9CA3AF", margin: "2px 0 0" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </button>
          )}

          {liStats && (
            <button onClick={() => onNavigate?.("linkedin")} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 20, textAlign: "left", cursor: onNavigate ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Linkedin style={{ width: 15, height: 15, color: "#2563EB" }} />
                  </div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0A0A0A" }}>LinkedIn Outreach</span>
                  <span style={{ fontSize: "0.625rem", color: "#9CA3AF" }}>via Reply.io</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {liStats.active > 0 && <span style={{ fontSize: "0.625rem", fontWeight: 700, background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0", padding: "2px 6px", borderRadius: 999 }}>{liStats.active} active</span>}
                  {onNavigate && <ArrowRight style={{ width: 15, height: 15, color: "#CBD5E1" }} />}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {[
                  { label: "Sequences", value: liStats.total, color: "#0A0A0A" },
                  { label: "Conn. Sent", value: liStats.connectionsSent, color: "#0A0A0A" },
                  { label: "Conn. Accepted", value: liStats.acceptedConnections, color: "#059669" },
                  { label: "Msg. Sent", value: liStats.messagesSent, color: "#2563EB" },
                  { label: "Msg. Replied", value: liStats.replies, color: "#7C3AED" },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: "1.125rem", fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: "0.625rem", color: "#9CA3AF", margin: "2px 0 0" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </button>
          )}
        </div>
      )}

      {replyStatsLoading && !emailStats && !liStats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 20 }}>
              <div style={{ height: 16, background: "#F1F5F9", borderRadius: 6, width: 128, marginBottom: 16 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[0, 1, 2].map(j => <div key={j} style={{ height: 24, background: "#F1F5F9", borderRadius: 6 }} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0A0A0A", margin: "0 0 14px" }}>Quick actions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { page: "candidates", icon: Users, title: "Source candidates", sub: "Search LinkedIn for talent" },
            { page: "clients", icon: Building2, title: "Add a client", sub: "Manage hiring companies" },
            { page: "roles", icon: Briefcase, title: "Open a role", sub: "Track a new search" },
          ].map(({ page, icon: Icon, title, sub }) => (
            <button
              key={page}
              onClick={() => onNavigate?.(page)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10,
                border: "1px solid #E2E8F0", background: "#fff", cursor: onNavigate ? "pointer" : "default", textAlign: "left",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon style={{ width: 15, height: 15, color: "#6B4EFF" }} />
              </div>
              <div>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{title}</p>
                <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}