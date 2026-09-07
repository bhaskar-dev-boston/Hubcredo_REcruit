import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Globe, Loader2, RefreshCw, Wallet, CheckCircle, AlertCircle, Mail, Shield,
  Clock, Zap, ChevronDown, ChevronRight, Server, Tag, Activity, Wifi, WifiOff,
  Calendar, ExternalLink, Copy, Check, Inbox as InboxIcon, BarChart3,
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

// ---- minimal inline toast (same pattern as CandidatesPage/LinkedInPage) ----
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

// ---- types ----

interface InboxKitDomain {
  uid: string;
  name: string;
  status: string;
  tld?: string;
  renewal_date?: string;
  forwarding_url?: string;
  dmarc_email?: string;
  nameservers?: string[];
  nameserver_match_status?: "matched" | "moved" | "pending" | "unknown";
  assigned_mailboxes?: string | number;
  available_mailboxes?: string | number;
  tags?: string[];
  [key: string]: unknown;
}

interface InboxKitMailbox {
  uid: string;
  domain_name: string;
  username: string;
  first_name?: string;
  last_name?: string;
  platform?: string;
  status: string;
  tags?: string[];
  sequencers?: unknown[];
  createdAt?: string;
  sequencer_status?: string;
  dns_propagation_status?: string;
  renewal_cycle?: string;
  renewal_status?: string;
  [key: string]: unknown;
}

interface WalletData {
  balance?: number;
  total?: number;
  used?: number;
  currency?: string;
}

function copyToClipboard(text: string, label: string, setCopied: (k: string) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  });
}

function statusColor(s: string): { bg: string; border: string; text: string } {
  const lower = (s ?? "").toLowerCase();
  if (lower === "active" || lower === "ready" || lower === "matched") return { bg: "#ECFDF5", border: "#A7F3D0", text: "#059669" };
  if (lower.includes("warm") || lower === "moved") return { bg: "#FFFBEB", border: "#FDE68A", text: "#D97706" };
  if (lower === "pending" || lower === "processing" || lower === "queued") return { bg: "#EEF2FF", border: "#C7D2FE", text: "#6366F1" };
  return { bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" };
}

function nsStatusIcon(s: string) {
  const l = (s ?? "").toLowerCase();
  if (l === "matched") return <Wifi style={{ width: 12, height: 12, color: "#059669" }} />;
  if (l === "moved") return <WifiOff style={{ width: 12, height: 12, color: "#D97706" }} />;
  return <WifiOff style={{ width: 12, height: 12, color: "#94A3B8" }} />;
}

function platformBadge(platform: string) {
  if (!platform) return null;
  const isGoogle = platform.toUpperCase().includes("GOOGLE");
  const isMicrosoft = platform.toUpperCase().includes("MICROSOFT") || platform.toUpperCase().includes("365");
  const c = isGoogle
    ? { bg: "#EFF6FF", border: "#DBEAFE", text: "#2563EB" }
    : isMicrosoft
      ? { bg: "#FFF7ED", border: "#FED7AA", text: "#EA580C" }
      : { bg: "#F8FAFC", border: "#E2E8F0", text: "#64748B" };
  return (
    <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "1px 6px", borderRadius: 6, border: `1px solid ${c.border}`, background: c.bg, color: c.text }}>
      {isGoogle ? "Google" : isMicrosoft ? "M365" : platform}
    </span>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14 };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, border: "none", background: "#2563EB", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.8125rem", whiteSpace: "nowrap" };
const secondaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid #E2E8F0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: "0.8125rem" };

export default function InboxKitPage() {
  const { toast, ToastHost } = useToast();
  const [, setLocation] = useLocation();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletData | null>(null);

  const [domains, setDomains] = useState<InboxKitDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);

  const [domainMailboxes, setDomainMailboxes] = useState<Record<string, InboxKitMailbox[] | "loading" | "error">>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState("");

  const checkConnection = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/inboxkit/validate");
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected && data.wallet) setWallet(data.wallet);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    setDomainsLoading(true);
    try {
      const res = await authFetch("/api/inboxkit/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains ?? []);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Failed to load domains", description: err.error ?? "Could not fetch domains.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach InboxKit API.", variant: "destructive" });
    } finally {
      setDomainsLoading(false);
    }
  }, [toast]);

  const fetchMailboxesForDomain = useCallback(async (domainName: string, uid: string) => {
    setDomainMailboxes((prev) => ({ ...prev, [uid]: "loading" }));
    try {
      const res = await authFetch(`/api/inboxkit/mailboxes/by-domain?domain=${encodeURIComponent(domainName)}`);
      if (res.ok) {
        const data = await res.json();
        setDomainMailboxes((prev) => ({ ...prev, [uid]: data.mailboxes ?? [] }));
      } else {
        setDomainMailboxes((prev) => ({ ...prev, [uid]: "error" }));
      }
    } catch {
      setDomainMailboxes((prev) => ({ ...prev, [uid]: "error" }));
    }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);
  useEffect(() => { if (connected) fetchDomains(); }, [connected, fetchDomains]);

  function handleRefresh() {
    setDomainMailboxes({});
    setExpanded(new Set());
    checkConnection();
    fetchDomains();
  }

  function toggleExpand(d: InboxKitDomain) {
    const uid = d.uid;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
        if (!domainMailboxes[uid]) fetchMailboxesForDomain(d.name, uid);
      }
      return next;
    });
  }

  const totalAssigned = domains.reduce((acc, d) => {
    const n = Number(d.assigned_mailboxes ?? 0);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
  const allMailboxesList = Object.values(domainMailboxes).flatMap((v) => (Array.isArray(v) ? v : []));
  const totalMailboxCount = totalAssigned > 0 ? totalAssigned : allMailboxesList.length;

  return (
    <>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: 0 }}>InboxKit</h1>
            <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: "0.9375rem" }}>Purchased domains and mailbox infrastructure</p>
          </div>
          {connected && (
            <button onClick={handleRefresh} disabled={domainsLoading} style={secondaryBtn}>
              <RefreshCw style={{ width: 14, height: 14 }} className={domainsLoading ? "animate-spin" : ""} /> Refresh
            </button>
          )}
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 className="animate-spin" style={{ width: 22, height: 22, color: "#2563EB" }} />
          </div>
        )}

        {!loading && connected === false && (
          <div style={{ ...card, padding: 40, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Globe style={{ width: 26, height: 26, color: "#2563EB" }} />
            </div>
            <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>InboxKit not connected</h2>
            <p style={{ fontSize: "0.875rem", color: "#64748B", maxWidth: 380, margin: "0 auto 20px" }}>
              Add your InboxKit API key and Workspace ID in Settings to view your purchased domains and mailboxes.
            </p>
            <button onClick={() => setLocation("/settings")} style={{ ...primaryBtn, margin: "0 auto" }}>
              <Zap style={{ width: 14, height: 14 }} /> Connect InboxKit
            </button>
          </div>
        )}

        {!loading && connected === true && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { icon: <CheckCircle style={{ width: 18, height: 18, color: "#059669" }} />, label: "Status", value: "Connected", valueColor: "#059669" },
                { icon: <Globe style={{ width: 18, height: 18, color: "#2563EB" }} />, label: "Domains", value: domainsLoading ? null : `${domains.length}` },
                { icon: <InboxIcon style={{ width: 18, height: 18, color: "#2563EB" }} />, label: "Mailboxes", value: domainsLoading ? null : `${totalMailboxCount}` },
                ...(wallet
                  ? [{
                      icon: <Wallet style={{ width: 18, height: 18, color: "#2563EB" }} />, label: "Wallet Balance",
                      value: wallet.balance != null ? `${wallet.currency ?? ""} ${Number(wallet.balance).toFixed(2)}`.trim() : "—",
                    }]
                  : []),
              ].map(({ icon, label, value, valueColor }) => (
                <div key={label} style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flexShrink: 0 }}>{icon}</div>
                  <div>
                    <p style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", margin: 0 }}>{label}</p>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: valueColor ?? "#0A0A0A", margin: "2px 0 0" }}>
                      {value === null ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, color: "#2563EB" }} /> : value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...card, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
                <h2 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Globe style={{ width: 15, height: 15, color: "#2563EB" }} /> Domains &amp; Mailboxes
                </h2>
                <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                  {domains.length} domain{domains.length !== 1 ? "s" : ""} · {totalMailboxCount} mailbox{totalMailboxCount !== 1 ? "es" : ""}
                </span>
              </div>

              {domainsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 50 }}>
                  <Loader2 className="animate-spin" style={{ width: 20, height: 20, color: "#2563EB" }} />
                </div>
              ) : domains.length === 0 ? (
                <div style={{ padding: "50px 0", textAlign: "center" }}>
                  <Globe style={{ width: 32, height: 32, color: "#CBD5E1", margin: "0 auto 12px" }} />
                  <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0 }}>No purchased domains yet</p>
                  <p style={{ fontSize: "0.75rem", color: "#94A3B8", margin: "4px 0 0" }}>Purchase domains through the Domain Finder.</p>
                </div>
              ) : (
                <div>
                  {domains.map((d) => {
                    const isOpen = expanded.has(d.uid);
                    const sc = statusColor(d.status);
                    const nsMatch = d.nameserver_match_status;
                    const assignedCount = Number(d.assigned_mailboxes ?? 0);
                    const availableCount = Number(d.available_mailboxes ?? 0);
                    const mboxState = domainMailboxes[d.uid];
                    const mboxes = Array.isArray(mboxState) ? mboxState : [];
                    const isActive = (d.status ?? "").toLowerCase() === "active";

                    return (
                      <div key={d.uid} style={{ borderTop: "1px solid #F1F5F9" }}>
                        <button onClick={() => toggleExpand(d)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Globe style={{ width: 16, height: 16, color: "#2563EB" }} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>{d.name}</p>
                              {d.tld && <span style={{ fontSize: "0.625rem", fontFamily: "monospace", color: "#94A3B8", background: "#F8FAFC", border: "1px solid #F1F5F9", padding: "1px 6px", borderRadius: 6 }}>.{d.tld}</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                              {(["SPF", "DKIM", "DMARC"] as const).map((rec) => {
                                const configured = isActive || (nsMatch ?? "").toLowerCase() === "matched";
                                return (
                                  <span key={rec} style={{ fontSize: "0.625rem", fontWeight: 700, padding: "1px 6px", borderRadius: 6, border: `1px solid ${configured ? "#A7F3D0" : "#FDE68A"}`, background: configured ? "#ECFDF5" : "#FFFBEB", color: configured ? "#059669" : "#D97706", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    {configured ? <CheckCircle style={{ width: 9, height: 9 }} /> : <Clock style={{ width: 9, height: 9 }} />} {rec}
                                  </span>
                                );
                              })}
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#94A3B8" }}>
                                <Mail style={{ width: 11, height: 11 }} /> {assignedCount} assigned · {availableCount} available
                              </span>
                              {d.renewal_date && (
                                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#94A3B8" }}>
                                  <Calendar style={{ width: 11, height: 11 }} /> Renews {new Date(d.renewal_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            {(() => {
                              const effectiveNs = isActive ? "matched" : (nsMatch ?? "");
                              if (!effectiveNs) return null;
                              const c = statusColor(effectiveNs);
                              return (
                                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.625rem", fontWeight: 600, color: c.text }}>
                                  {nsStatusIcon(effectiveNs)} NS {isActive ? "matched" : effectiveNs}
                                </span>
                              );
                            })()}
                            <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "2px 10px", borderRadius: 999, border: `1px solid ${sc.border}`, background: sc.bg, color: sc.text, textTransform: "capitalize" }}>
                              {d.status}
                            </span>
                            {isOpen ? <ChevronDown style={{ width: 15, height: 15, color: "#94A3AF" }} /> : <ChevronRight style={{ width: 15, height: 15, color: "#94A3AF" }} />}
                          </div>
                        </button>

                        {isOpen && (
                          <div style={{ background: "#FAFAF9", borderTop: "1px solid #F1F5F9" }}>
                            <div style={{ padding: "12px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, borderBottom: "1px solid #F1F5F9" }}>
                              {d.dmarc_email && (
                                <div>
                                  <p style={{ fontSize: "0.625rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", margin: "0 0 2px", display: "flex", alignItems: "center", gap: 4 }}><Shield style={{ width: 10, height: 10 }} /> DMARC Email</p>
                                  <p style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#0A0A0A", margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{d.dmarc_email}</p>
                                </div>
                              )}
                              {d.forwarding_url && (
                                <div>
                                  <p style={{ fontSize: "0.625rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", margin: "0 0 2px", display: "flex", alignItems: "center", gap: 4 }}><ExternalLink style={{ width: 10, height: 10 }} /> Forwarding URL</p>
                                  <p style={{ fontSize: "0.75rem", color: "#0A0A0A", margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{d.forwarding_url}</p>
                                </div>
                              )}
                              {d.nameservers && d.nameservers.length > 0 && (
                                <div style={{ gridColumn: "span 2" }}>
                                  <p style={{ fontSize: "0.625rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}><Server style={{ width: 10, height: 10 }} /> Nameservers</p>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {d.nameservers.map((ns) => <span key={ns} style={{ fontSize: "0.625rem", fontFamily: "monospace", background: "#fff", border: "1px solid #F1F5F9", color: "#64748B", padding: "1px 6px", borderRadius: 6 }}>{ns}</span>)}
                                  </div>
                                </div>
                              )}
                              {d.tags && d.tags.length > 0 && (
                                <div>
                                  <p style={{ fontSize: "0.625rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}><Tag style={{ width: 10, height: 10 }} /> Tags</p>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {d.tags.map((t) => <span key={t} style={{ fontSize: "0.625rem", background: "#EFF6FF", color: "#2563EB", padding: "1px 6px", borderRadius: 6 }}>{t}</span>)}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div style={{ padding: "14px 20px" }}>
                              {mboxState === "loading" && (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", fontSize: "0.875rem", color: "#94A3B8" }}>
                                  <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> Loading mailboxes…
                                </div>
                              )}
                              {mboxState === "error" && (
                                <div style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "#DC2626" }}>
                                  <AlertCircle style={{ width: 14, height: 14 }} /> Failed to load mailboxes.
                                </div>
                              )}
                              {Array.isArray(mboxState) && mboxes.length === 0 && (
                                <div style={{ padding: "16px 0", textAlign: "center" }}>
                                  <InboxIcon style={{ width: 20, height: 20, color: "#CBD5E1", margin: "0 auto 6px" }} />
                                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>No mailboxes found for this domain.</p>
                                </div>
                              )}
                              {Array.isArray(mboxState) && mboxes.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                  <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", margin: 0 }}>
                                    {mboxes.length} Mailbox{mboxes.length !== 1 ? "es" : ""}
                                  </p>
                                  {mboxes.map((m, mi) => {
                                    const email = `${m.username}@${m.domain_name}`;
                                    const displayName = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username;
                                    const mStatus = m.status ?? "active";
                                    const mc = statusColor(mStatus);
                                    const normalize = (v?: string) => {
                                      if (!v) return null;
                                      const l = v.toLowerCase().trim();
                                      if (l === "na" || l === "n/a" || l === "none" || l === "null") return null;
                                      return v;
                                    };
                                    const seqStatus = normalize(m.sequencer_status);
                                    const rawDns = normalize(m.dns_propagation_status);
                                    const dnsStatus = rawDns ?? ((mStatus ?? "").toLowerCase() === "active" ? "propagated" : null);
                                    const mKey = m.uid ?? `${d.uid}-${mi}`;

                                    return (
                                      <div key={mKey} style={{ ...card, overflow: "hidden" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #F1F5F9" }}>
                                          <div style={{ width: 30, height: 30, borderRadius: 9, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <Mail style={{ width: 14, height: 14, color: "#059669" }} />
                                          </div>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                              <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</p>
                                              <button onClick={() => copyToClipboard(email, mKey, setCopied)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }} title="Copy email">
                                                {copied === mKey ? <Check style={{ width: 13, height: 13, color: "#059669" }} /> : <Copy style={{ width: 13, height: 13 }} />}
                                              </button>
                                              {m.platform && platformBadge(m.platform)}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                                              {displayName && <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{displayName}</span>}
                                            </div>
                                          </div>
                                          <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "1px 8px", borderRadius: 999, border: `1px solid ${mc.border}`, background: mc.bg, color: mc.text, textTransform: "capitalize", flexShrink: 0 }}>{mStatus}</span>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" }}>
                                          <div style={{ padding: "10px 14px", borderRight: "1px solid #F1F5F9", borderTop: "1px solid #F1F5F9" }}>
                                            <p style={{ fontSize: "0.625rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}><Activity style={{ width: 10, height: 10 }} /> Sequencer</p>
                                            {seqStatus ? <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "1px 6px", borderRadius: 6, textTransform: "capitalize", ...statusColor(seqStatus), border: `1px solid ${statusColor(seqStatus).border}` }}>{seqStatus}</span> : <p style={{ fontSize: "0.75rem", color: "#94A3B8", margin: 0 }}>—</p>}
                                          </div>
                                          <div style={{ padding: "10px 14px", borderRight: "1px solid #F1F5F9", borderTop: "1px solid #F1F5F9" }}>
                                            <p style={{ fontSize: "0.625rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}><Wifi style={{ width: 10, height: 10 }} /> DNS</p>
                                            {dnsStatus ? <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "1px 6px", borderRadius: 6, textTransform: "capitalize", ...statusColor(dnsStatus), border: `1px solid ${statusColor(dnsStatus).border}` }}>{dnsStatus}</span> : <p style={{ fontSize: "0.75rem", color: "#94A3B8", margin: 0 }}>—</p>}
                                          </div>
                                          <div style={{ padding: "10px 14px", borderRight: "1px solid #F1F5F9", borderTop: "1px solid #F1F5F9" }}>
                                            <p style={{ fontSize: "0.625rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}><Calendar style={{ width: 10, height: 10 }} /> Renewal</p>
                                            <p style={{ fontSize: "0.75rem", color: "#0A0A0A", margin: 0, textTransform: "capitalize" }}>
                                              {m.renewal_cycle ?? "—"}{m.renewal_status && m.renewal_status !== "na" && <span style={{ color: "#94A3B8" }}> ({m.renewal_status})</span>}
                                            </p>
                                          </div>
                                          <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9" }}>
                                            <p style={{ fontSize: "0.625rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}><Clock style={{ width: 10, height: 10 }} /> Created</p>
                                            <p style={{ fontSize: "0.75rem", color: "#0A0A0A", margin: 0 }}>{m.createdAt ? new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</p>
                                          </div>
                                        </div>

                                        {m.tags && m.tags.length > 0 && (
                                          <div style={{ padding: "8px 14px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                            <Tag style={{ width: 11, height: 11, color: "#94A3B8" }} />
                                            {m.tags.map((t: string) => <span key={t} style={{ fontSize: "0.625rem", background: "#EFF6FF", color: "#2563EB", padding: "1px 6px", borderRadius: 6 }}>{t}</span>)}
                                          </div>
                                        )}

                                        {m.sequencers && (m.sequencers as unknown[]).length > 0 && (
                                          <div style={{ padding: "8px 14px", borderTop: "1px solid #F1F5F9" }}>
                                            <p style={{ fontSize: "0.625rem", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", margin: "0 0 4px" }}>Sequencers ({(m.sequencers as unknown[]).length})</p>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                              {(m.sequencers as any[]).map((s: any, si: number) => (
                                                <span key={si} style={{ fontSize: "0.625rem", background: "#F8FAFC", border: "1px solid #F1F5F9", color: "#64748B", padding: "1px 6px", borderRadius: 6, fontFamily: "monospace" }}>
                                                  {typeof s === "string" ? s : s?.name ?? s?.uid ?? JSON.stringify(s)}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 20 }}>
              {[
                { icon: Shield, title: "DMARC configured", desc: "All purchased domains have DMARC email forwarding automatically set up for deliverability protection." },
                { icon: BarChart3, title: "Email warm-up", desc: "Mailboxes created via InboxKit are pre-warmed for better inbox placement across ESP providers." },
                { icon: AlertCircle, title: "DNS propagation", desc: "New domains may take 24–48 hours to fully propagate. Check nameserver status in each domain row." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} style={{ background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 12, padding: 14 }}>
                  <Icon style={{ width: 15, height: 15, color: "#2563EB", marginBottom: 8 }} />
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</p>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "4px 0 0", lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <ToastHost />
    </>
  );
}