import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Loader2, ThumbsUp, ThumbsDown, ExternalLink, Trash2, AlertTriangle, X } from "lucide-react";
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

interface LeadList {
  id: string;
  label?: string | null;
  status?: string | null;
  total_count?: number;
}

interface Lead {
  id: string;
  lead_list_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  job_title?: string | null;
  company_name?: string | null;
  linkedin_url?: string | null;
  review_status?: string | null;
  created_at?: string | null;
}

function statusTone(status?: string | null): { bg: string; fg: string } {
  if (status === "approved") return { bg: "#F0FDF4", fg: "#16A34A" };
  if (status === "rejected") return { bg: "#FEF2F2", fg: "#DC2626" };
  return { bg: "#F5F3FF", fg: "#6B4EFF" };
}

export default function Leads() {
  const { toast, ToastHost } = useToast();

  const [lists, setLists] = useState<LeadList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [listLabel, setListLabel] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [deleteConfirmList, setDeleteConfirmList] = useState<LeadList | null>(null);
  const [deletingList, setDeletingList] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({
    first_name: "", last_name: "", email: "", job_title: "", company_name: "", linkedin_url: "",
  });
  const [savingLead, setSavingLead] = useState(false);

  const activeListId = selectedListId ?? lists[0]?.id ?? null;
  const selectedList = lists.find(l => l.id === activeListId);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const r = await authFetch("/api/recruit/lead-lists");
      if (r.ok) setLists(await r.json());
    } finally {
      setListsLoading(false);
    }
  }, []);

  const loadLeads = useCallback(async (listId: string | null) => {
    if (!listId) {
      setLeads([]);
      return;
    }
    setLeadsLoading(true);
    try {
      const r = await authFetch(`/api/recruit/leads?lead_list_id=${listId}`);
      if (r.ok) setLeads(await r.json());
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { loadLeads(activeListId); }, [activeListId, loadLeads]);

  async function handleCreateList() {
    if (!listLabel.trim()) return;
    setCreatingList(true);
    try {
      const r = await authFetch("/api/recruit/lead-lists", {
        method: "POST",
        body: JSON.stringify({ label: listLabel.trim() }),
      });
      if (r.ok) {
        const list = await r.json();
        setListLabel("");
        setShowNewList(false);
        await loadLists();
        setSelectedListId(list.id);
      } else {
        toast({ title: "Error", description: "Could not create list", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not create list", variant: "destructive" });
    } finally {
      setCreatingList(false);
    }
  }

  async function handleDeleteList(list: LeadList) {
    setDeletingList(true);
    try {
      const r = await authFetch(`/api/recruit/lead-lists/${list.id}`, { method: "DELETE" });
      if (r.ok) {
        setDeleteConfirmList(null);
        if (selectedListId === list.id) setSelectedListId(null);
        await loadLists();
        toast({ title: "List deleted" });
      } else {
        toast({ title: "Error", description: "Could not delete list", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not delete list", variant: "destructive" });
    } finally {
      setDeletingList(false);
    }
  }

  async function handleAddLead() {
    if (!activeListId) return;
    if (!newLead.first_name.trim() && !newLead.company_name.trim()) {
      toast({ title: "Name or company required", variant: "destructive" });
      return;
    }
    setSavingLead(true);
    try {
      const r = await authFetch("/api/recruit/leads", {
        method: "POST",
        body: JSON.stringify({ lead_list_id: activeListId, ...newLead }),
      });
      if (r.ok) {
        toast({ title: "Lead added" });
        setShowAddLead(false);
        setNewLead({ first_name: "", last_name: "", email: "", job_title: "", company_name: "", linkedin_url: "" });
        await loadLeads(activeListId);
        await loadLists();
      } else {
        toast({ title: "Error", description: "Could not add lead", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not add lead", variant: "destructive" });
    } finally {
      setSavingLead(false);
    }
  }

  async function handleReview(leadId: string, status: string) {
    try {
      const r = await authFetch(`/api/recruit/leads/${leadId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ review_status: status }),
      });
      if (r.ok) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, review_status: status } : l));
      } else {
        toast({ title: "Error", description: "Could not update lead", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not update lead", variant: "destructive" });
    }
  }

  async function handleDeleteLead(leadId: string) {
    try {
      const r = await authFetch(`/api/recruit/leads/${leadId}`, { method: "DELETE" });
      if (r.ok) {
        setLeads(prev => prev.filter(l => l.id !== leadId));
        toast({ title: "Lead removed" });
      } else {
        toast({ title: "Error", description: "Could not remove lead", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not remove lead", variant: "destructive" });
    }
  }

  return (
    <>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: 0 }}>My Leads</h1>
          <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: "0.9375rem" }}>Manage your lead lists and prospects</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
          {/* Left — lists */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em", margin: 0 }}>Lead lists</p>
              <button onClick={() => setShowNewList(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8125rem", color: "#6B4EFF", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>
                <Plus style={{ width: 14, height: 14 }} /> New
              </button>
            </div>

            {listsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                <Loader2 style={{ width: 20, height: 20, color: "#6B4EFF" }} className="animate-spin" />
              </div>
            ) : lists.length === 0 ? (
              <div style={{ background: "#F8F7FF", border: "1px dashed rgba(107,78,255,.2)", borderRadius: 14, padding: 24, textAlign: "center" }}>
                <Users style={{ width: 32, height: 32, color: "#C4B5FD", margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0 }}>No lists yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lists.map(list => (
                  <div key={list.id} style={{
                    display: "flex", alignItems: "center", borderRadius: 10,
                    background: activeListId === list.id ? "#F5F3FF" : "#fff",
                    border: `1px solid ${activeListId === list.id ? "#6B4EFF" : "rgba(107,78,255,.12)"}`,
                  }}>
                    <button onClick={() => setSelectedListId(list.id)} style={{
                      flex: 1, textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer",
                    }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: activeListId === list.id ? "#6B4EFF" : "#0A0A0A" }}>
                        {list.label || "Untitled list"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#9CA3AF" }}>{list.total_count ?? 0} leads</p>
                    </button>
                    <button onClick={() => setDeleteConfirmList(list)} title="Delete list" style={{
                      padding: 8, marginRight: 6, background: "transparent", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex",
                    }}>
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showNewList && (
              <div style={{ marginTop: 12, background: "#fff", border: "1px solid rgba(107,78,255,.2)", borderRadius: 12, padding: 14 }}>
                <input
                  autoFocus
                  value={listLabel}
                  onChange={e => setListLabel(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreateList()}
                  placeholder="List name"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E8F0", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreateList} disabled={creatingList} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "none", background: "#6B4EFF", color: "#fff", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer" }}>
                    {creatingList ? "Creating…" : "Create"}
                  </button>
                  <button onClick={() => setShowNewList(false)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: "0.8125rem", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right — leads */}
          <div>
            {activeListId && selectedList && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em", margin: 0 }}>
                  {leadsLoading ? "Loading…" : `${leads.length} leads in "${selectedList.label}"`}
                </p>
                <button onClick={() => setShowAddLead(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, border: "none", background: "#6B4EFF", color: "#fff", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer" }}>
                  <Plus style={{ width: 14, height: 14 }} /> Add lead
                </button>
              </div>
            )}

            {!activeListId ? (
              <div style={{ background: "#F8F7FF", border: "1px dashed rgba(107,78,255,.2)", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <Users style={{ width: 32, height: 32, color: "#C4B5FD", margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: "0.875rem", color: "#64748B", margin: 0 }}>Create a list to start adding leads</p>
              </div>
            ) : leadsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <Loader2 style={{ width: 24, height: 24, color: "#6B4EFF" }} className="animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <div style={{ background: "#F8F7FF", border: "1px dashed rgba(107,78,255,.2)", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <Users style={{ width: 32, height: 32, color: "#C4B5FD", margin: "0 auto 8px", display: "block" }} />
                <p style={{ fontSize: "0.9375rem", color: "#0A0A0A", fontWeight: 600, margin: "0 0 4px" }}>No leads yet</p>
                <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>Add your first lead to this list.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leads.map(lead => {
                  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
                  const tone = statusTone(lead.review_status);
                  return (
                    <div key={lead.id} style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                      background: "#fff", border: "1px solid rgba(107,78,255,.12)", borderRadius: 12,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", background: "#F5F3FF",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        fontWeight: 700, color: "#6B4EFF", fontSize: "0.8125rem",
                      }}>
                        {name[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <p style={{ margin: 0, fontWeight: 700, color: "#0A0A0A", fontSize: "0.875rem" }}>{name}</p>
                          <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: tone.fg, background: tone.bg, padding: "1px 7px", borderRadius: 6 }}>
                            {lead.review_status ?? "pending"}
                          </span>
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "#64748B" }}>
                          {[lead.job_title, lead.company_name].filter(Boolean).join(" · ")}
                        </p>
                        {lead.email && <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#94A3B8" }}>{lead.email}</p>}
                        {lead.linkedin_url && (
                          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#6B4EFF", marginTop: 4, textDecoration: "none" }}>
                            LinkedIn <ExternalLink style={{ width: 11, height: 11 }} />
                          </a>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {(!lead.review_status || lead.review_status === "pending") && (
                          <>
                            <button onClick={() => handleReview(lead.id, "approved")} title="Approve" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid rgba(107,78,255,.15)", background: "#fff", color: "#9CA3AF", cursor: "pointer" }}>
                              <ThumbsUp style={{ width: 14, height: 14 }} />
                            </button>
                            <button onClick={() => handleReview(lead.id, "rejected")} title="Reject" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid rgba(107,78,255,.15)", background: "#fff", color: "#9CA3AF", cursor: "pointer" }}>
                              <ThumbsDown style={{ width: 14, height: 14 }} />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteLead(lead.id)} title="Remove" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid rgba(107,78,255,.15)", background: "#fff", color: "#9CA3AF", cursor: "pointer" }}>
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddLead && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "1.0625rem", fontWeight: 700 }}>Add lead</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "first_name", placeholder: "First name" },
                { key: "last_name", placeholder: "Last name" },
                { key: "email", placeholder: "Email" },
                { key: "job_title", placeholder: "Job title" },
                { key: "company_name", placeholder: "Company name" },
                { key: "linkedin_url", placeholder: "LinkedIn URL" },
              ].map(({ key, placeholder }) => (
                <input
                  key={key}
                  value={(newLead as any)[key]}
                  onChange={e => setNewLead(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E8F0", fontSize: "0.875rem", outline: "none" }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddLead(false)} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddLead} disabled={savingLead} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: "#6B4EFF", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                {savingLead ? "Saving…" : "Add lead"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmList && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle style={{ width: 18, height: 18, color: "#DC2626" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "#0A0A0A" }}>Delete this list?</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "#64748B" }}>
                  "{deleteConfirmList.label || "Untitled list"}" and all its leads will be permanently deleted.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirmList(null)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDeleteList(deleteConfirmList)} disabled={deletingList} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "#DC2626", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                {deletingList ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastHost />
    </>
  );
}