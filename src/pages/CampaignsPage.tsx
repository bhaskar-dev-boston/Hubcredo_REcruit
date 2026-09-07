import { useState, useEffect, useCallback } from "react";
import {
  Mail, Plus, Loader2, Send, Play, Pause, CheckCircle2, AlertCircle,
  X, Trash2, RefreshCw, Eye, MessageSquare, Users, ChevronDown,
  BookmarkPlus, BookOpen, Pencil, Save,
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

interface LeadList { id: string; label: string; }
type StepType = "email";
interface CampaignSequence { id?: string; step_number: number; subject: string; body: string; delay_days: number; type?: StepType; }

const REPLY_STANDARD_FIELDS = [
  { value: "firstName", label: "First Name" }, { value: "lastName", label: "Last Name" },
  { value: "fullName", label: "Full Name" }, { value: "email", label: "Email" },
  { value: "companyName", label: "Company Name" }, { value: "title", label: "Job Title" },
  { value: "industry", label: "Industry" }, { value: "hqCountry", label: "Country" },
  { value: "hqCity", label: "City" }, { value: "department", label: "Department" },
  { value: "seniority", label: "Seniority" }, { value: "companySize", label: "Company Size" },
  { value: "companyDomain", label: "Company Domain" }, { value: "researchBlurb", label: "Research Blurb" },
  { value: "linkedInUrl", label: "LinkedIn URL" },
];

function toCamelCaseVar(raw: string): string {
  const base = raw.split(":")[0].trim();
  const hasSeparators = /[^a-zA-Z0-9]/.test(base);
  const isAllUpper = base === base.toUpperCase();
  const isAllLower = base === base.toLowerCase();
  if (!hasSeparators && !isAllUpper && !isAllLower) return base.charAt(0).toLowerCase() + base.slice(1);
  const words = base.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return "";
  return words.map((w, i) => { const lower = w.toLowerCase(); return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1); }).join("");
}

function extractTemplateVars(steps: { subject: string; body: string }[]): string[] {
  const vars = new Set<string>();
  for (const s of steps) for (const text of [s.subject, s.body]) {
    for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) vars.add(m[1].trim());
  }
  return [...vars].sort((a, b) => a.localeCompare(b));
}

const FIELD_SYNONYMS: Record<string, string> = {
  sector: "industry", vertical: "industry", niche: "industry", space: "industry",
  role: "title", jobtitle: "title", position: "title",
  business: "companyName", company: "companyName", org: "companyName", organization: "companyName",
  location: "hqCity", region: "hqCountry",
};

function varResolvesStandard(rawVar: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nv = norm(toCamelCaseVar(rawVar));
  const direct = REPLY_STANDARD_FIELDS.find(f => norm(f.value) === nv || norm(f.label) === nv)?.value;
  if (direct) return direct;
  return FIELD_SYNONYMS[nv] ?? null;
}

interface ReplySeq { id: number; name: string; status: "active" | "paused" | "stopped"; isArchived: boolean; channel?: "email" | "linkedin"; }
interface ReplyContact { email: string; firstName: string; lastName: string; status: { status: string; replied: boolean; opened: boolean; bounced: boolean }; }
interface ReplyStats {
  sequenceId: number; total: number; active: number; delivered: number; replied: number; opened: number; bounced: number;
  deliveredPercentage: number; openedPercentage: number; repliedPercentage: number; bouncedPercentage: number;
}

const EMAIL_TEMPLATES: { id: string; name: string; sequences: CampaignSequence[] }[] = [
  { id: "cold", name: "Cold Outreach (2-step)", sequences: [
    { step_number: 1, delay_days: 0, subject: "Quick question", body: "Hi {{firstName}},\n\nI work with B2B companies to improve their outbound sales infrastructure. I thought you might be a great fit.\n\nWould love to connect — are you open to a quick 15-min call?\n\nBest,\n{{senderName}}" },
    { step_number: 2, delay_days: 3, subject: "Re: Quick question", body: "Hi {{firstName}},\n\nJust following up in case this slipped through. Would you be open to a quick chat about improving your outbound?\n\nBest,\n{{senderName}}" },
  ]},
  { id: "value", name: "Value-First (3-step)", sequences: [
    { step_number: 1, delay_days: 0, subject: "Idea for {{companyName}}", body: "Hi {{firstName}},\n\nI noticed {{companyName}} is growing fast. I have a few ideas on how to scale your pipeline — mind if I share?\n\n{{senderName}}" },
    { step_number: 2, delay_days: 4, subject: "One more thought", body: "Hey {{firstName}}, just wanted to drop one more note. Happy to show you how we've helped similar companies 2x their reply rates.\n\n{{senderName}}" },
    { step_number: 3, delay_days: 7, subject: "Last note", body: "Hi {{firstName}}, I'll leave you alone after this — but if you ever want to talk outbound, I'm here. {{senderName}}" },
  ]},
];

interface SavedTemplate { id: string; name: string; steps: CampaignSequence[]; created_at: string; }

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#2563EB" }}>{sub}</p>}
      <p style={{ margin: "2px 0 0", fontSize: "0.625rem", color: "#94A3B8" }}>{label}</p>
    </div>
  );
}

export default function Campaigns() {
  const { toast, ToastHost } = useToast();

  const [lists, setLists] = useState<LeadList[]>([]);
  const [replyConnected, setReplyConnected] = useState(false);
  const [replySeqs, setReplySeqs] = useState<ReplySeq[]>([]);
  const [replySeqsLoading, setReplySeqsLoading] = useState(false);
  const [replySelectedId, setReplySelectedId] = useState<number | null>(null);
  const [replyContacts, setReplyContacts] = useState<ReplyContact[]>([]);
  const [replyStats, setReplyStats] = useState<ReplyStats | null>(null);
  const [replyDetailLoading, setReplyDetailLoading] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollSeqId, setEnrollSeqId] = useState<number | null>(null);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollFirst, setEnrollFirst] = useState("");
  const [enrollLast, setEnrollLast] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const [emailAccounts, setEmailAccounts] = useState<Array<{ id: number; email: string; connectionStatus: string; alias?: string }>>([]);
  const [emailAccountsLoading, setEmailAccountsLoading] = useState(false);

  const [replyWizard, setReplyWizard] = useState(false);
  const [replyWizStep, setReplyWizStep] = useState<1 | 2 | 3 | 4>(1);
  const [replyWizCustomKeys, setReplyWizCustomKeys] = useState<string[]>([]);
  const [customKeysLoading, setCustomKeysLoading] = useState(false);
  const [replyWizName, setReplyWizName] = useState("");
  const [replyWizSteps, setReplyWizSteps] = useState<CampaignSequence[]>([]);
  const [replyWizListId, setReplyWizListId] = useState("");
  const [replyWizVarMap, setReplyWizVarMap] = useState<Record<string, string>>({});
  const [replyCreating, setReplyCreating] = useState(false);
  const [replyPausingId, setReplyPausingId] = useState<number | null>(null);
  const [replyDeletingId, setReplyDeletingId] = useState<number | null>(null);
  const [replyDeleteConfirmId, setReplyDeleteConfirmId] = useState<number | null>(null);
  const [replyEnrollListId, setReplyEnrollListId] = useState("");
  const [replyEnrollingList, setReplyEnrollingList] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStepIdx, setPreviewStepIdx] = useState(0);
  const [previewLead, setPreviewLead] = useState<Record<string, string> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [launchSeqId, setLaunchSeqId] = useState<number | null>(null);
  const [launchEmailAccounts, setLaunchEmailAccounts] = useState<Array<{ id: number; email: string; connectionStatus: string; alias?: string }>>([]);
  const [launchEmailAccountsLoading, setLaunchEmailAccountsLoading] = useState(false);
  const [launchSelectedEmailId, setLaunchSelectedEmailId] = useState<number | null>(null);
  const [launchConfirming, setLaunchConfirming] = useState(false);
  const [launchEmailsPerDay, setLaunchEmailsPerDay] = useState<number>(200);
  const [launchListId, setLaunchListId] = useState<string>("");

  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<SavedTemplate | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");

  useEffect(() => {
    authFetch("/api/recruit/lead-lists")
      .then(r => r.ok ? r.json() : [])
      .then(d => setLists((Array.isArray(d) ? d : []).map((l: any) => ({ id: l.id, label: l.label || "Untitled list" }))))
      .catch(() => setLists([]));
  }, []);

  useEffect(() => {
    authFetch("/api/replyio/validate")
      .then(r => r.json())
      .then(d => setReplyConnected(d.valid))
      .catch(() => setReplyConnected(false));
  }, []);

  useEffect(() => {
    if (replyConnected) { loadReplySeqs(); loadEmailAccounts(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyConnected]);

  async function loadReplySeqs() {
    setReplySeqsLoading(true);
    try {
      const res = await authFetch("/api/replyio/sequences");
      const data = await res.json();
      setReplySeqs((data.sequences || []).filter((s: ReplySeq) => !s.isArchived && s.channel !== "linkedin"));
    } catch {
      toast({ title: "Failed to load Reply.io sequences", variant: "destructive" });
    } finally {
      setReplySeqsLoading(false);
    }
  }

  async function loadEmailAccounts() {
    setEmailAccountsLoading(true);
    try {
      const res = await authFetch("/api/replyio/email-accounts");
      const data = await res.json();
      setEmailAccounts(data.accounts ?? []);
    } catch { /* ignore */ }
    finally { setEmailAccountsLoading(false); }
  }

  async function loadReplyDetail(id: number) {
    setReplySelectedId(id);
    setReplyDetailLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        authFetch(`/api/replyio/sequences/${id}/contacts`),
        authFetch(`/api/replyio/sequences/${id}/stats`),
      ]);
      if (cRes.ok) setReplyContacts((await cRes.json()).contacts ?? []);
      if (sRes.ok) setReplyStats(await sRes.json());
    } finally {
      setReplyDetailLoading(false);
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollSeqId || !enrollEmail.trim()) return;
    setEnrolling(true);
    try {
      const res = await authFetch("/api/replyio/enroll", {
        method: "POST",
        body: JSON.stringify({ contact: { email: enrollEmail.trim(), firstName: enrollFirst || undefined, lastName: enrollLast || undefined }, sequenceId: enrollSeqId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Contact enrolled!", description: `${enrollEmail} added to Reply.io sequence.` });
      setEnrollOpen(false); setEnrollEmail(""); setEnrollFirst(""); setEnrollLast("");
      if (replySelectedId === enrollSeqId) loadReplyDetail(enrollSeqId);
    } catch (err: unknown) {
      toast({ title: "Enroll failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setEnrolling(false);
    }
  }

  function resetReplyWizard() { setReplyWizStep(1); setReplyWizName(""); setReplyWizSteps([]); setReplyWizListId(""); setReplyWizVarMap({}); setReplyWizCustomKeys([]); setCustomKeysLoading(false); }

  async function loadCustomFieldKeys(listId: string) {
    if (!listId) { setReplyWizCustomKeys([]); return; }
    setCustomKeysLoading(true);
    try {
      const res = await authFetch(`/api/recruit/leads?lead_list_id=${listId}`);
      if (!res.ok) { setReplyWizCustomKeys([]); return; }
      const data = await res.json();
      const leadsArr = Array.isArray(data) ? data : data.leads ?? data.items ?? data;
      const lead = leadsArr?.[0];
      if (lead?.custom_fields && typeof lead.custom_fields === "object") setReplyWizCustomKeys(Object.keys(lead.custom_fields as Record<string, string>));
      else setReplyWizCustomKeys([]);
    } catch {
      setReplyWizCustomKeys([]);
    } finally {
      setCustomKeysLoading(false);
    }
  }

  function addReplyWizStep() {
    setReplyWizSteps(p => [...p, { step_number: p.length + 1, subject: "", body: "", delay_days: p.length === 0 ? 0 : 3, type: "email" }]);
  }

  function applyReplyTemplate(t: { name: string; sequences: CampaignSequence[] }) {
    setReplyWizSteps(t.sequences.map((s, i) => ({ ...s, step_number: i + 1, type: "email" as StepType })));
    toast({ title: "Template applied" });
  }

  async function loadSavedTemplates() {
    if (templatesLoaded) return;
    try {
      const res = await authFetch("/api/campaign-templates");
      if (res.ok) setSavedTemplates((await res.json()) ?? []);
    } catch { /* ignore */ }
    setTemplatesLoaded(true);
  }

  async function handleSaveTemplate() {
    if (!saveTemplateName.trim()) { toast({ title: "Template name required", variant: "destructive" }); return; }
    if (replyWizSteps.length === 0) { toast({ title: "Add at least one step first", variant: "destructive" }); return; }
    setSavingTemplate(true);
    try {
      const res = await authFetch("/api/campaign-templates", { method: "POST", body: JSON.stringify({ name: saveTemplateName.trim(), steps: replyWizSteps }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSavedTemplates(prev => [data, ...prev]);
      setSaveTemplateOpen(false); setSaveTemplateName("");
      toast({ title: "Template saved!", description: `"${data.name}" is ready to reuse.` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not save template", variant: "destructive" });
    } finally { setSavingTemplate(false); }
  }

  async function handleDeleteTemplate(id: string) {
    setDeletingTemplateId(id);
    try {
      const res = await authFetch(`/api/campaign-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setSavedTemplates(prev => prev.filter(t => t.id !== id));
      toast({ title: "Template deleted" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not delete", variant: "destructive" });
    } finally { setDeletingTemplateId(null); }
  }

  async function handleRenameTemplate() {
    if (!editingTemplate || !editTemplateName.trim()) return;
    try {
      const res = await authFetch(`/api/campaign-templates/${editingTemplate.id}`, { method: "PATCH", body: JSON.stringify({ name: editTemplateName.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, name: data.name } : t));
      setEditingTemplate(null);
      toast({ title: "Template renamed" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not rename", variant: "destructive" });
    }
  }

  function applySavedTemplate(tpl: { name: string; steps: CampaignSequence[] }) {
    setReplyWizSteps(tpl.steps.map((s, i) => ({ ...s, step_number: i + 1, type: "email" as StepType })));
    toast({ title: "Template applied", description: `"${tpl.name}" loaded into sequence.` });
  }

  async function handleGeneratePreview(listId?: string) {
    const lid = listId || replyWizListId;
    if (!lid) { toast({ title: "Select a lead list first", variant: "destructive" }); return; }
    if (replyWizSteps.length === 0) { toast({ title: "No steps to preview", variant: "destructive" }); return; }
    setPreviewLoading(true);
    try {
      const res = await authFetch(`/api/recruit/leads?lead_list_id=${lid}`);
      const data = await res.json();
      const leadsArr = Array.isArray(data) ? data : data.leads ?? data.items ?? data;
      const lead = leadsArr[0] ?? null;
      if (!lead) { toast({ title: "No leads in list", description: "Add leads first.", variant: "destructive" }); return; }
      const customFields = (lead.custom_fields && typeof lead.custom_fields === "object") ? (lead.custom_fields as Record<string, string>) : {};
      const baseLead: Record<string, string> = {
        firstName: (lead.first_name || "Jane").split(" ")[0], lastName: lead.last_name || "Smith",
        fullName: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Jane Smith",
        email: lead.email || "jane@company.com", title: lead.job_title || "VP Sales",
        companyName: lead.company_name || "Acme Corp", linkedInUrl: lead.linkedin_url || "",
        industry: lead.industry || "", country: lead.hq_country || "", city: lead.hq_city || "",
        seniority: lead.seniority || "", department: lead.department || "", companySize: lead.company_size || "",
        hqCity: lead.hq_city || "", hqCountry: lead.hq_country || "", companyDomain: lead.company_domain || "",
        researchBlurb: lead.research_blurb || "", ...customFields,
      };
      for (const [templateVar, fieldKey] of Object.entries(replyWizVarMap)) {
        if (!fieldKey) continue;
        if (fieldKey.startsWith("__csv__")) {
          const csvKey = fieldKey.slice("__csv__".length);
          if (baseLead[csvKey] !== undefined) baseLead[templateVar] = baseLead[csvKey];
        } else if (baseLead[fieldKey] !== undefined) baseLead[templateVar] = baseLead[fieldKey];
      }
      setPreviewLead(baseLead); setPreviewStepIdx(0); setPreviewOpen(true);
    } catch {
      toast({ title: "Preview failed", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }

  function fillTemplate(text: string, lead: Record<string, string>): string {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normMap = new Map<string, string>();
    for (const [k, v] of Object.entries(lead)) { const nk = norm(k); if (!normMap.has(nk)) normMap.set(nk, v ?? ""); }
    const resolve = (key: string): string | null => {
      if (lead[key] !== undefined) return lead[key] ?? "";
      const nk = norm(key);
      if (normMap.has(nk)) return normMap.get(nk)!;
      const canonical = toCamelCaseVar(key);
      if (canonical) {
        if (lead[canonical] !== undefined) return lead[canonical] ?? "";
        const nc = norm(canonical);
        if (normMap.has(nc)) return normMap.get(nc)!;
      }
      return null;
    };
    return text
      .replace(/\[First Name\]/gi, lead.firstName || "").replace(/\[Last Name\]/gi, lead.lastName || "")
      .replace(/\[Full Name\]/gi, lead.fullName || "").replace(/\[Company\]/gi, lead.companyName || "")
      .replace(/\[Job Title\]/gi, lead.title || "").replace(/\[Industry\]/gi, lead.industry || "")
      .replace(/\[Country\]/gi, lead.country || "")
      .replace(/\{\{([^}]+)\}\}/g, (match, raw: string) => { const val = resolve(raw.trim()); return val !== null ? val : match; });
  }

  async function handleCreateReplySeq() {
    if (!replyWizName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setReplyCreating(true);
    try {
      const res = await authFetch("/api/replyio/sequences", {
        method: "POST",
        body: JSON.stringify({ name: replyWizName.trim(), steps: replyWizSteps.map(s => ({ type: "email", delay_days: s.delay_days, subject: s.subject, body: s.body })) }),
      });
      const seq = await res.json();
      if (!res.ok) throw new Error(seq.error ?? "Failed to create campaign");
      const stepWarning = seq.stepErrors?.length ? ` (${seq.stepErrors.length} step(s) failed — check Reply.io)` : "";
      if (replyWizListId) {
        const eRes = await authFetch(`/api/replyio/sequences/${seq.id}/enroll-list`, { method: "POST", body: JSON.stringify({ lead_list_id: replyWizListId, var_map: replyWizVarMap }) });
        const eData = await eRes.json();
        toast({ title: "Campaign created!" + stepWarning, description: eRes.ok ? `Enrolled ${eData.enrolled} of ${eData.total} leads.` : `Created — enroll failed: ${eData.error}` });
      } else {
        toast({ title: "Campaign created!" + stepWarning, description: `"${seq.name}" is ready in Reply.io.` });
      }
      setReplyWizard(false); resetReplyWizard(); loadReplySeqs();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not create campaign", variant: "destructive" });
    } finally { setReplyCreating(false); }
  }

  async function openLaunchModal(seqId: number) {
    setLaunchSeqId(seqId); setLaunchSelectedEmailId(null); setLaunchListId(""); setLaunchEmailsPerDay(200);
    setLaunchModalOpen(true); setLaunchEmailAccountsLoading(true);
    try {
      const res = await authFetch("/api/replyio/email-accounts");
      const data = await res.json();
      setLaunchEmailAccounts(data.accounts ?? []);
    } catch {
      toast({ title: "Could not load email accounts", variant: "destructive" });
    } finally { setLaunchEmailAccountsLoading(false); }
  }

  async function handleConfirmLaunch() {
    if (!launchSeqId) return;
    setLaunchConfirming(true);
    try {
      const settingsRes = await authFetch(`/api/replyio/sequences/${launchSeqId}/settings`, { method: "PATCH", body: JSON.stringify({ emailsCountPerDay: launchEmailsPerDay }) });
      if (!settingsRes.ok) throw new Error((await settingsRes.json()).error ?? "Failed to update email limit");
      const res = await authFetch(`/api/replyio/sequences/${launchSeqId}/activate`, {
        method: "POST",
        body: JSON.stringify({ emailAccountId: launchSelectedEmailId ?? undefined, lead_list_id: launchListId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReplySeqs(prev => prev.map(s => s.id === launchSeqId ? { ...s, status: "active" } : s));
      toast({
        title: "Sequence launched! 🚀",
        description: data.enrolled ? `Sending via ${data.emailAccount} · ${data.enrolled}/${data.total} leads enrolled · ${launchEmailsPerDay} emails/day` : `Sending via ${data.emailAccount} · ${launchEmailsPerDay} emails/day`,
      });
      setLaunchModalOpen(false);
    } catch (err) {
      toast({ title: "Launch failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setLaunchConfirming(false); }
  }

  async function handlePauseReply(id: number) {
    setReplyPausingId(id);
    try {
      const res = await authFetch(`/api/replyio/sequences/${id}/pause-seq`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      setReplySeqs(prev => prev.map(s => s.id === id ? { ...s, status: "paused" } : s));
      toast({ title: "Sequence paused." });
    } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" }); }
    finally { setReplyPausingId(null); }
  }

  async function handleDeleteReplySeq(id: number) {
    setReplyDeletingId(id);
    try {
      const res = await authFetch(`/api/replyio/sequences/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setReplySeqs(prev => prev.filter(s => s.id !== id));
      if (replySelectedId === id) { setReplySelectedId(null); setReplyContacts([]); setReplyStats(null); }
      setReplyDeleteConfirmId(null);
      toast({ title: "Sequence deleted." });
    } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" }); }
    finally { setReplyDeletingId(null); }
  }

  async function handleEnrollListToSeq(seqId: number, listId: string) {
    if (!listId) { toast({ title: "Select a lead list first", variant: "destructive" }); return; }
    setReplyEnrollingList(true);
    try {
      const res = await authFetch(`/api/replyio/sequences/${seqId}/enroll-list`, { method: "POST", body: JSON.stringify({ lead_list_id: listId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Leads enrolled!", description: `${data.enrolled} of ${data.total} contacts added to sequence.` });
      if (replySelectedId === seqId) loadReplyDetail(seqId);
    } catch (err) { toast({ title: "Enroll failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" }); }
    finally { setReplyEnrollingList(false); }
  }

  const replySelectedSeq = replySeqs.find(s => s.id === replySelectedId);

  const inputCls: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E8F0", fontSize: "0.875rem", color: "#0A0A0A", outline: "none", boxSizing: "border-box", background: "#fff" };
  const selectCls = inputCls;
  const btnPrimary: React.CSSProperties = { background: "#2563EB", color: "#fff", fontSize: "0.875rem", fontWeight: 700, borderRadius: 9, border: "none", cursor: "pointer" };
  const btnBack: React.CSSProperties = { padding: "9px 16px", border: "1px solid #E2E8F0", color: "#64748B", fontSize: "0.875rem", fontWeight: 700, borderRadius: 9, background: "#fff", cursor: "pointer" };

  return (
    <>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0A0A0A", margin: 0 }}>Campaigns</h1>
            <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: "0.9375rem" }}>Email outreach via Reply.io sequences</p>
          </div>
        </div>

        {!replyConnected ? (
          <div style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0", borderRadius: 14, padding: 40, textAlign: "center" }}>
            <Mail style={{ width: 32, height: 32, color: "#CBD5E1", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>Reply.io not connected</p>
            <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>Add your Reply.io API key in Settings to start sending campaigns.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(emailAccounts.length > 0 || emailAccountsLoading) && (
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Mail style={{ width: 16, height: 16, color: "#2563EB" }} />
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Connected Mailboxes</p>
                  {emailAccountsLoading && <Loader2 style={{ width: 12, height: 12, color: "#9CA3AF" }} className="animate-spin" />}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {emailAccounts.map(acc => (
                    <div key={acc.id} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 600,
                      background: acc.connectionStatus === "connected" ? "#F0FDF4" : "#F9FAFB",
                      border: `1px solid ${acc.connectionStatus === "connected" ? "#BBF7D0" : "#E5E7EB"}`,
                      color: acc.connectionStatus === "connected" ? "#15803D" : "#6B7280",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: acc.connectionStatus === "connected" ? "#22C55E" : "#9CA3AF" }} />
                      {acc.alias || acc.email}
                      {acc.connectionStatus !== "connected" && <span style={{ fontSize: "0.625rem", color: "#9CA3AF", marginLeft: 2 }}>({acc.connectionStatus})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".04em", margin: 0 }}>Reply.io Email Sequences</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={loadReplySeqs} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#2563EB", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
                </button>
                <button onClick={() => { setEnrollSeqId(replySelectedId); setEnrollOpen(true); }} disabled={!replySelectedId} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: "0.75rem", fontWeight: 700, border: "1px solid #2563EB", color: "#2563EB", borderRadius: 9, background: "#fff", cursor: "pointer", opacity: !replySelectedId ? 0.4 : 1 }}>
                  <Users style={{ width: 12, height: 12 }} /> Enroll Contact
                </button>
                <button onClick={() => { setReplyWizard(true); resetReplyWizard(); loadSavedTemplates(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", ...btnPrimary }}>
                  <Plus style={{ width: 14, height: 14 }} /> New Campaign
                </button>
              </div>
            </div>

            {replySeqsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Loader2 style={{ width: 20, height: 20, color: "#2563EB" }} className="animate-spin" /></div>
            ) : replySeqs.length === 0 ? (
              <div style={{ background: "#fff", border: "1px dashed #E2E8F0", borderRadius: 14, padding: 40, textAlign: "center" }}>
                <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Mail style={{ width: 24, height: 24, color: "#2563EB" }} />
                </div>
                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>No email sequences yet</p>
                <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "4px 0 0" }}>Create your first email campaign directly from HubCredo.</p>
                <button onClick={() => { setReplyWizard(true); resetReplyWizard(); loadSavedTemplates(); }} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", margin: "16px auto 0", ...btnPrimary }}>
                  <Plus style={{ width: 14, height: 14 }} /> Create first campaign
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {replySeqs.map(seq => (
                    <div key={seq.id} style={{
                      borderRadius: 12, border: `1px solid ${replySelectedId === seq.id ? "rgba(37,99,235,.4)" : "#E2E8F0"}`,
                      background: replySelectedId === seq.id ? "#EFF6FF" : "#fff",
                    }}>
                      <button onClick={() => loadReplyDetail(seq.id)} style={{ width: "100%", textAlign: "left", padding: "12px 14px 6px", background: "transparent", border: "none", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: seq.status === "active" ? "#4ADE80" : seq.status === "paused" ? "#FBBF24" : "#D1D5DB" }} />
                          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seq.name}</span>
                        </div>
                        <span style={{ marginTop: 4, display: "inline-flex", fontSize: "0.6875rem", padding: "2px 6px", borderRadius: 999, textTransform: "capitalize", fontWeight: 600, background: seq.status === "active" ? "#F0FDF4" : seq.status === "paused" ? "#FFFBEB" : "#F3F4F6", color: seq.status === "active" ? "#15803D" : seq.status === "paused" ? "#B45309" : "#6B7280" }}>{seq.status}</span>
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 14px 10px" }}>
                        {seq.status !== "active" ? (
                          <button onClick={(e) => { e.stopPropagation(); openLaunchModal(seq.id); }} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.625rem", fontWeight: 700, color: "#059669", background: "none", border: "none", cursor: "pointer" }}>
                            <Play style={{ width: 10, height: 10 }} /> Launch
                          </button>
                        ) : (
                          <button onClick={() => handlePauseReply(seq.id)} disabled={replyPausingId === seq.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.625rem", fontWeight: 700, color: "#B45309", background: "none", border: "none", cursor: "pointer" }}>
                            {replyPausingId === seq.id ? <Loader2 style={{ width: 10, height: 10 }} className="animate-spin" /> : <Pause style={{ width: 10, height: 10 }} />} Pause
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setReplyDeleteConfirmId(seq.id); }} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: "0.625rem", fontWeight: 700, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
                          <Trash2 style={{ width: 10, height: 10 }} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  {!replySelectedSeq ? (
                    <div style={{ border: "1px dashed #E2E8F0", borderRadius: 12, height: 192, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ fontSize: "0.875rem", color: "#9CA3AF" }}>Select a sequence to view details</p>
                    </div>
                  ) : replyDetailLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 64 }}><Loader2 style={{ width: 20, height: 20, color: "#2563EB" }} className="animate-spin" /></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {replyStats && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                          <StatCard icon={null} label="Contacted" value={replyStats.total} color="#0A0A0A" />
                          <StatCard icon={null} label="Delivered" value={replyStats.delivered} sub={`${(replyStats.deliveredPercentage ?? 0).toFixed(0)}%`} color="#2563EB" />
                          <StatCard icon={null} label="Opened" value={replyStats.opened} sub={`${(replyStats.openedPercentage ?? 0).toFixed(0)}%`} color="#4F46E5" />
                          <StatCard icon={null} label="Replied" value={replyStats.replied} sub={`${(replyStats.repliedPercentage ?? 0).toFixed(0)}%`} color="#2563EB" />
                          <StatCard icon={null} label="Bounced" value={replyStats.bounced} sub={`${(replyStats.bouncedPercentage ?? 0).toFixed(0)}%`} color="#DC2626" />
                        </div>
                      )}

                      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 16 }}>
                        <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Enroll from lead list</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <select value={replyEnrollListId} onChange={e => setReplyEnrollListId(e.target.value)} style={{ ...selectCls, flex: 1 }}>
                            <option value="">Select a lead list…</option>
                            {lists.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                          </select>
                          <button onClick={() => handleEnrollListToSeq(replySelectedId!, replyEnrollListId)} disabled={!replyEnrollListId || replyEnrollingList} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", ...btnPrimary, opacity: !replyEnrollListId || replyEnrollingList ? 0.5 : 1 }}>
                            {replyEnrollingList ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />} Enroll list
                          </button>
                        </div>
                      </div>

                      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>
                            {replySelectedSeq.name} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#9CA3AF" }}>{replyContacts.length} contacts</span>
                          </p>
                          <button onClick={() => { setEnrollSeqId(replySelectedId); setEnrollOpen(true); }} style={{ fontSize: "0.75rem", color: "#2563EB", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>+ Add contact</button>
                        </div>
                        {replyContacts.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "24px 0" }}>
                            <p style={{ fontSize: "0.875rem", color: "#9CA3AF", margin: 0 }}>No contacts yet</p>
                          </div>
                        ) : (
                          <div>
                            {replyContacts.map(c => (
                              <div key={c.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #F1F5F9", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", flexShrink: 0 }}>
                                    {(c.firstName?.[0] ?? c.email[0]).toUpperCase()}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.firstName} {c.lastName}</p>
                                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#9CA3AF" }}>{c.email}</p>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                  <span style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "capitalize", padding: "2px 8px", borderRadius: 999, background: c.status?.status === "active" ? "#F0FDF4" : c.status?.status === "finished" ? "#F5F3FF" : "#F3F4F6", color: c.status?.status === "active" ? "#15803D" : c.status?.status === "finished" ? "#7C3AED" : "#6B7280" }}>
                                    {c.status?.status?.replace(/_/g, " ") ?? "unknown"}
                                  </span>
                                  {c.status?.opened && <Eye style={{ width: 12, height: 12, color: "#60A5FA" }} />}
                                  {c.status?.replied && <MessageSquare style={{ width: 12, height: 12, color: "#4ADE80" }} />}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Campaign wizard */}
      {replyWizard && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 800, color: "#0A0A0A" }}>New Reply.io Email Campaign</h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>Step {replyWizStep} of 4</p>
              </div>
              <button onClick={() => setReplyWizard(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>

            <div style={{ display: "flex", alignItems: "center", padding: "12px 24px 0", flexShrink: 0 }}>
              {[1, 2, 3, 4].map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, background: replyWizStep >= s ? "#2563EB" : "#F3F4F6", color: replyWizStep >= s ? "#fff" : "#9CA3AF" }}>{s}</div>
                  {s < 4 && <div style={{ width: 40, height: 2, margin: "0 4px", background: replyWizStep >= s + 1 ? "#2563EB" : "#E2E8F0" }} />}
                </div>
              ))}
              <div style={{ marginLeft: 12, fontSize: "0.75rem", color: "#9CA3AF" }}>
                {replyWizStep === 1 ? "Name & email steps" : replyWizStep === 2 ? "Select lead list" : replyWizStep === 3 ? "Map variables" : "Create campaign"}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              {replyWizStep === 1 && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Campaign name <span style={{ color: "#F87171" }}>*</span></label>
                    <input autoFocus value={replyWizName} onChange={e => setReplyWizName(e.target.value)} placeholder="e.g. Q3 SaaS Outreach" style={inputCls} />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>Apply template (optional)</label>
                      <button onClick={() => setManageTemplatesOpen(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#64748B", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                        <BookOpen style={{ width: 12, height: 12 }} /> Manage
                      </button>
                    </div>
                    {savedTemplates.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                        {savedTemplates.map(tpl => (
                          <button key={tpl.id} onClick={() => applySavedTemplate(tpl)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE", padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>
                            <BookmarkPlus style={{ width: 12, height: 12 }} /> {tpl.name}
                            <span style={{ fontSize: "0.625rem", color: "#9CA3AF", fontWeight: 400 }}>{tpl.steps.length}s</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <select onChange={e => { const val = e.target.value; if (val) { const t = EMAIL_TEMPLATES.find(x => x.id === val); if (t) applyReplyTemplate(t); } e.target.value = ""; }} style={{ ...selectCls, marginTop: 8 }}>
                      <option value="">Pick a built-in template…</option>
                      {EMAIL_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>Email steps</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {replyWizSteps.length > 0 && (
                          <button onClick={() => { setSaveTemplateName(""); setSaveTemplateOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#059669", fontWeight: 600, border: "1px solid #A7F3D0", background: "#F0FDF4", padding: "4px 8px", borderRadius: 9, cursor: "pointer" }}>
                            <BookmarkPlus style={{ width: 12, height: 12 }} /> Save as template
                          </button>
                        )}
                        <button onClick={addReplyWizStep} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#2563EB", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                          <Mail style={{ width: 12, height: 12 }} /> Add email step
                        </button>
                      </div>
                    </div>
                    {replyWizSteps.length === 0 ? (
                      <div style={{ background: "#F9FAFB", border: "1px dashed #E2E8F0", borderRadius: 12, padding: 24, textAlign: "center" }}>
                        <Mail style={{ width: 32, height: 32, color: "#9CA3AF", margin: "0 auto 8px" }} />
                        <p style={{ fontSize: "0.875rem", color: "#9CA3AF", margin: "0 0 8px" }}>No email steps yet</p>
                        <button onClick={addReplyWizStep} style={{ fontSize: "0.75rem", color: "#2563EB", fontWeight: 600, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, margin: "0 auto" }}>
                          <Mail style={{ width: 12, height: 12 }} /> Add first email step
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {replyWizSteps.map((s, i) => (
                          <div key={i} style={{ background: "#F9FAFB", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563EB" }}>Step {i + 1}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {i > 0 ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: "0.625rem", color: "#9CA3AF" }}>Delay:</span>
                                    <input type="number" min={1} value={s.delay_days} onChange={e => setReplyWizSteps(prev => prev.map((st, j) => j === i ? { ...st, delay_days: Number(e.target.value) } : st))} style={{ width: 56, padding: "3px 6px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: "0.75rem", textAlign: "center" }} />
                                    <span style={{ fontSize: "0.625rem", color: "#9CA3AF" }}>days</span>
                                  </div>
                                ) : <span style={{ fontSize: "0.625rem", color: "#9CA3AF" }}>Sends immediately</span>}
                                <button onClick={() => setReplyWizSteps(p => p.filter((_, j) => j !== i))} style={{ color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}><X style={{ width: 12, height: 12 }} /></button>
                              </div>
                            </div>
                            <input value={s.subject} onChange={e => setReplyWizSteps(p => p.map((st, j) => j === i ? { ...st, subject: e.target.value } : st))} placeholder="Email subject" style={{ ...inputCls, fontSize: "0.75rem" }} />
                            <textarea value={s.body} onChange={e => setReplyWizSteps(p => p.map((st, j) => j === i ? { ...st, body: e.target.value } : st))} placeholder="Email body… use {{firstName}}, {{companyName}}, {{title}}" rows={4} style={{ ...inputCls, fontSize: "0.75rem", resize: "none" }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {replyWizStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 12, padding: 12 }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", margin: "0 0 4px" }}>Choose your lead list</p>
                    <p style={{ fontSize: "0.6875rem", color: "#64748B", margin: 0 }}>Select the list you'll be sending to. HubCredo will read its custom field keys so you can map them to your template variables next.</p>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Lead list <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional — can enroll later)</span></label>
                    <select value={replyWizListId} onChange={e => setReplyWizListId(e.target.value)} style={selectCls}>
                      <option value="">Skip — enroll manually later</option>
                      {lists.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {replyWizStep === 3 && (() => {
                const detectedVars = extractTemplateVars(replyWizSteps);
                if (detectedVars.length === 0) {
                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", textAlign: "center" }}>
                      <CheckCircle2 style={{ width: 32, height: 32, color: "#2563EB", marginBottom: 8 }} />
                      <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>No template variables found</p>
                      <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: "4px 0 0", maxWidth: 280 }}>Continue to create the campaign.</p>
                    </div>
                  );
                }
                const selectedListName = lists.find(l => l.id === replyWizListId)?.label;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 12, padding: 12 }}>
                      <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", margin: "0 0 4px" }}>Map your template variables</p>
                      <p style={{ fontSize: "0.6875rem", color: "#64748B", margin: 0 }}>{selectedListName ? `Custom field keys are loaded from ${selectedListName}.` : "Tell HubCredo which lead field each variable should pull from."}</p>
                    </div>
                    {detectedVars.map(v => {
                      const current = replyWizVarMap[v] ?? (varResolvesStandard(v) || "");
                      return (
                        <div key={v} style={{ display: "flex", alignItems: "center", gap: 10, background: "#F9FAFB", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 14px" }}>
                          <code style={{ fontSize: "0.6875rem", fontFamily: "monospace", color: "#2563EB", background: "#DBEAFE", padding: "3px 8px", borderRadius: 8, flexShrink: 0 }}>{`{{${v}}}`}</code>
                          <span style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>→</span>
                          <select value={current} onChange={e => setReplyWizVarMap(prev => ({ ...prev, [v]: e.target.value }))} style={{ ...selectCls, flex: 1, fontSize: "0.75rem" }}>
                            <option value="">— Custom field (from list) —</option>
                            <optgroup label="Standard lead fields">
                              {REPLY_STANDARD_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </optgroup>
                            {replyWizCustomKeys.length > 0 && (
                              <optgroup label="Custom fields">
                                {replyWizCustomKeys.map(k => <option key={`csv:${k}`} value={`__csv__${k}`}>{k}</option>)}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {replyWizStep === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", margin: "0 0 4px" }}>Campaign ready to create</p>
                    <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{replyWizName}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.625rem", background: "#DBEAFE", color: "#2563EB", padding: "3px 8px", borderRadius: 999, fontWeight: 600 }}>
                        <Mail style={{ width: 10, height: 10 }} /> {replyWizSteps.length} email step{replyWizSteps.length !== 1 ? "s" : ""}
                      </span>
                      {replyWizListId && <span style={{ fontSize: "0.625rem", background: "#F0FDF4", color: "#059669", border: "1px solid #A7F3D0", padding: "3px 8px", borderRadius: 999, fontWeight: 600 }}>{lists.find(l => l.id === replyWizListId)?.label ?? "List selected"}</span>}
                    </div>
                  </div>

                  <div style={{ background: "#F9FAFB", border: "1px solid #E2E8F0", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", margin: 0 }}>Preview with real lead data</p>
                      <button onClick={() => handleGeneratePreview()} disabled={previewLoading || !replyWizListId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", fontWeight: 700, color: "#fff", background: "#2563EB", padding: "6px 12px", borderRadius: 9, border: "none", cursor: "pointer", opacity: previewLoading || !replyWizListId ? 0.5 : 1 }}>
                        {previewLoading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Eye style={{ width: 12, height: 12 }} />} Generate Preview
                      </button>
                    </div>
                    {!replyWizListId && <p style={{ fontSize: "0.6875rem", color: "#D97706", margin: 0 }}>No list selected — go back to Step 2 to choose one.</p>}
                  </div>

                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 12 }}>
                    <p style={{ fontSize: "0.75rem", color: "#B45309", margin: 0 }}>After creation, activate the sequence in Reply.io (or use the Launch button here) to start sending.</p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, padding: "16px 24px", borderTop: "1px solid #E2E8F0", flexShrink: 0 }}>
              {replyWizStep === 1 && (
                <>
                  <button onClick={() => setReplyWizard(false)} style={{ flex: 1, ...btnBack }}>Cancel</button>
                  <button onClick={() => {
                    if (!replyWizName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
                    if (replyWizSteps.length === 0) { toast({ title: "Add at least one email step", variant: "destructive" }); return; }
                    const vars = extractTemplateVars(replyWizSteps);
                    setReplyWizVarMap(prev => { const next = { ...prev }; for (const v of vars) if (!(v in next)) next[v] = varResolvesStandard(v) ?? ""; return next; });
                    setReplyWizStep(2);
                  }} style={{ flex: 1, padding: "9px 0", ...btnPrimary }}>Next → Select lead list</button>
                </>
              )}
              {replyWizStep === 2 && (
                <>
                  <button onClick={() => setReplyWizStep(1)} style={{ flex: 1, ...btnBack }}>← Back</button>
                  <button onClick={async () => { await loadCustomFieldKeys(replyWizListId); setReplyWizStep(3); }} disabled={customKeysLoading} style={{ flex: 1, padding: "9px 0", ...btnPrimary, opacity: customKeysLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {customKeysLoading ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Loading fields…</> : "Next → Map variables"}
                  </button>
                </>
              )}
              {replyWizStep === 3 && (
                <>
                  <button onClick={() => setReplyWizStep(2)} style={{ flex: 1, ...btnBack }}>← Back</button>
                  <button onClick={() => setReplyWizStep(4)} style={{ flex: 1, padding: "9px 0", ...btnPrimary }}>Next → Review &amp; create</button>
                </>
              )}
              {replyWizStep === 4 && (
                <>
                  <button onClick={() => setReplyWizStep(3)} style={{ flex: 1, ...btnBack }}>← Back</button>
                  <button onClick={handleCreateReplySeq} disabled={replyCreating} style={{ flex: 1, padding: "9px 0", ...btnPrimary, opacity: replyCreating ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {replyCreating ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Creating…</> : <><CheckCircle2 style={{ width: 14, height: 14 }} /> Create campaign</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enroll contact modal */}
      {enrollOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 360, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A" }}>Enroll Contact in Reply.io</h3>
              <button onClick={() => setEnrollOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><X style={{ width: 15, height: 15 }} /></button>
            </div>
            <form onSubmit={handleEnroll} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Sequence</label>
                <select value={enrollSeqId ?? ""} onChange={e => setEnrollSeqId(Number(e.target.value))} style={selectCls}>
                  <option value="">Select sequence…</option>
                  {replySeqs.filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Email <span style={{ color: "#F87171" }}>*</span></label>
                <input type="email" required value={enrollEmail} onChange={e => setEnrollEmail(e.target.value)} placeholder="name@company.com" style={inputCls} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>First name</label>
                  <input value={enrollFirst} onChange={e => setEnrollFirst(e.target.value)} placeholder="Jane" style={inputCls} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Last name</label>
                  <input value={enrollLast} onChange={e => setEnrollLast(e.target.value)} placeholder="Smith" style={inputCls} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" onClick={() => setEnrollOpen(false)} style={{ flex: 1, padding: "9px 0", ...btnBack }}>Cancel</button>
                <button type="submit" disabled={enrolling || !enrollEmail || !enrollSeqId} style={{ flex: 1, padding: "9px 0", ...btnPrimary, opacity: enrolling || !enrollEmail || !enrollSeqId ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {enrolling ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Send style={{ width: 14, height: 14 }} />} {enrolling ? "Enrolling…" : "Enroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Template modal */}
      {saveTemplateOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 360, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, background: "#F0FDF4", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><BookmarkPlus style={{ width: 16, height: 16, color: "#059669" }} /></div>
                <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 800, color: "#0A0A0A" }}>Save as Template</h3>
              </div>
              <button onClick={() => setSaveTemplateOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Template name <span style={{ color: "#F87171" }}>*</span></label>
                <input autoFocus value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSaveTemplate(); }} placeholder="e.g. Cold Email 3-Step" style={inputCls} />
              </div>
              <div style={{ background: "#F9FAFB", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 600, color: "#9CA3AF", margin: "0 0 4px" }}>Steps to save</p>
                {replyWizSteps.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5625rem", fontWeight: 700, color: "#fff", background: "#2563EB", flexShrink: 0 }}>{i + 1}</span>
                    <Mail style={{ width: 12, height: 12, color: "#2563EB", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.75rem", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.subject || s.body?.slice(0, 40) || "No content"}</span>
                    <span style={{ fontSize: "0.625rem", color: "#9CA3AF", marginLeft: "auto", flexShrink: 0 }}>Day {s.delay_days}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSaveTemplateOpen(false)} style={{ flex: 1, padding: "9px 0", ...btnBack }}>Cancel</button>
                <button onClick={handleSaveTemplate} disabled={savingTemplate || !saveTemplateName.trim()} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", background: "#059669", color: "#fff", fontSize: "0.875rem", fontWeight: 700, borderRadius: 9, border: "none", cursor: "pointer", opacity: savingTemplate || !saveTemplateName.trim() ? 0.5 : 1 }}>
                  {savingTemplate ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Save style={{ width: 14, height: 14 }} />} {savingTemplate ? "Saving…" : "Save template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Templates modal */}
      {manageTemplatesOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, background: "#EFF6FF", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}><BookOpen style={{ width: 16, height: 16, color: "#2563EB" }} /></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 800, color: "#0A0A0A" }}>My Templates</h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#9CA3AF" }}>{savedTemplates.length} saved template{savedTemplates.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button onClick={() => setManageTemplatesOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {savedTemplates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div style={{ width: 48, height: 48, background: "#EFF6FF", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><BookmarkPlus style={{ width: 24, height: 24, color: "#2563EB" }} /></div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>No templates yet</p>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "4px 0 0" }}>Build a sequence and click "Save as template" to reuse it later.</p>
                </div>
              ) : savedTemplates.map(tpl => (
                <div key={tpl.id} style={{ background: "#F9FAFB", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #E2E8F0" }}>
                    {editingTemplate?.id === tpl.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, marginRight: 8 }}>
                        <input autoFocus value={editTemplateName} onChange={e => setEditTemplateName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleRenameTemplate(); if (e.key === "Escape") setEditingTemplate(null); }} style={{ flex: 1, padding: "4px 8px", fontSize: "0.875rem", border: "1px solid #2563EB", borderRadius: 8, outline: "none" }} />
                        <button onClick={handleRenameTemplate} style={{ color: "#2563EB", background: "none", border: "none", cursor: "pointer" }}><Save style={{ width: 14, height: 14 }} /></button>
                        <button onClick={() => setEditingTemplate(null)} style={{ color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}><X style={{ width: 14, height: 14 }} /></button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                        <BookmarkPlus style={{ width: 14, height: 14, color: "#2563EB", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</span>
                        <span style={{ fontSize: "0.625rem", color: "#9CA3AF", background: "#fff", border: "1px solid #E2E8F0", padding: "2px 6px", borderRadius: 999, flexShrink: 0 }}>{tpl.steps.length} step{tpl.steps.length !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {editingTemplate?.id !== tpl.id && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => { applySavedTemplate(tpl); setManageTemplatesOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#2563EB", fontWeight: 600, background: "#EFF6FF", border: "1px solid #DBEAFE", padding: "4px 8px", borderRadius: 8, cursor: "pointer" }}>Use</button>
                        <button onClick={() => { setEditingTemplate(tpl); setEditTemplateName(tpl.name); }} style={{ padding: 6, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}><Pencil style={{ width: 14, height: 14 }} /></button>
                        <button onClick={() => handleDeleteTemplate(tpl.id)} disabled={deletingTemplateId === tpl.id} style={{ padding: 6, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
                          {deletingTemplateId === tpl.id ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Trash2 style={{ width: 14, height: 14 }} />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {tpl.steps.map((s, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.625rem", padding: "2px 8px", borderRadius: 999, background: "#DBEAFE", color: "#2563EB", fontWeight: 600 }}>
                        <Mail style={{ width: 10, height: 10 }} /> {s.subject || "Step"} · Day {s.delay_days}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid #E2E8F0", flexShrink: 0 }}>
              <button onClick={() => setManageTemplatesOpen(false)} style={{ width: "100%", padding: "9px 0", ...btnPrimary }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && previewLead && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 800, color: "#0A0A0A" }}>Template Preview</h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>Filled with data from: <span style={{ fontWeight: 600, color: "#0A0A0A" }}>{previewLead.fullName}</span> · {previewLead.companyName}</p>
              </div>
              <button onClick={() => setPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            {replyWizSteps.length > 1 && (
              <div style={{ display: "flex", gap: 4, padding: "12px 20px 0", flexWrap: "wrap", flexShrink: 0 }}>
                {replyWizSteps.map((s, i) => (
                  <button key={i} onClick={() => setPreviewStepIdx(i)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", padding: "6px 12px", borderRadius: 9, fontWeight: 600, border: "none", cursor: "pointer", background: previewStepIdx === i ? "#2563EB" : "#F3F4F6", color: previewStepIdx === i ? "#fff" : "#64748B" }}>
                    <Mail style={{ width: 12, height: 12 }} /> Step {i + 1}
                  </button>
                ))}
              </div>
            )}
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {(() => {
                const s = replyWizSteps[previewStepIdx];
                if (!s) return null;
                const filledSubject = fillTemplate(s.subject, previewLead);
                const filledBody = fillTemplate(s.body, previewLead);
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", background: "#DBEAFE", color: "#2563EB", padding: "4px 10px", borderRadius: 9, fontWeight: 600 }}><Mail style={{ width: 12, height: 12 }} /> Email</span>
                      <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>Day {s.delay_days}</span>
                    </div>
                    {filledSubject && (
                      <div style={{ background: "#F9FAFB", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12 }}>
                        <p style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 600, color: "#9CA3AF", margin: "0 0 4px" }}>Subject</p>
                        <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{filledSubject}</p>
                      </div>
                    )}
                    <div style={{ background: "#F9FAFB", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12 }}>
                      <p style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 600, color: "#9CA3AF", margin: "0 0 4px" }}>Message</p>
                      <pre style={{ fontSize: "0.875rem", color: "#0A0A0A", whiteSpace: "pre-wrap", lineHeight: 1.6, fontFamily: "inherit", margin: 0 }}>{filledBody || <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>No message body</span>}</pre>
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid #E2E8F0", flexShrink: 0 }}>
              {replyWizSteps.length > 1 && (
                <>
                  <button onClick={() => setPreviewStepIdx(p => Math.max(0, p - 1))} disabled={previewStepIdx === 0} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", fontSize: "0.75rem", fontWeight: 600, border: "1px solid #E2E8F0", borderRadius: 9, color: "#64748B", background: "#fff", cursor: "pointer", opacity: previewStepIdx === 0 ? 0.4 : 1 }}>← Prev</button>
                  <button onClick={() => setPreviewStepIdx(p => Math.min(replyWizSteps.length - 1, p + 1))} disabled={previewStepIdx === replyWizSteps.length - 1} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", fontSize: "0.75rem", fontWeight: 600, border: "1px solid #E2E8F0", borderRadius: 9, color: "#64748B", background: "#fff", cursor: "pointer", opacity: previewStepIdx === replyWizSteps.length - 1 ? 0.4 : 1 }}>Next →</button>
                </>
              )}
              <button onClick={() => setPreviewOpen(false)} style={{ flex: 1, padding: "8px 0", ...btnPrimary }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete sequence confirm */}
      {replyDeleteConfirmId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, background: "#FEF2F2", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><AlertCircle style={{ width: 18, height: 18, color: "#DC2626" }} /></div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "#0A0A0A" }}>Delete sequence?</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "#64748B" }}>This permanently deletes the sequence and all its contacts from Reply.io.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setReplyDeleteConfirmId(null)} style={{ flex: 1, padding: "9px 0", ...btnBack }}>Cancel</button>
              <button onClick={() => handleDeleteReplySeq(replyDeleteConfirmId)} disabled={replyDeletingId === replyDeleteConfirmId} style={{ flex: 1, padding: "9px 0", background: "#DC2626", color: "#fff", fontWeight: 700, fontSize: "0.875rem", borderRadius: 9, border: "none", cursor: "pointer", opacity: replyDeletingId === replyDeleteConfirmId ? 0.6 : 1 }}>
                {replyDeletingId === replyDeleteConfirmId ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Launch modal */}
      {launchModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 40, height: 40, background: "#EFF6FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send style={{ width: 18, height: 18, color: "#2563EB" }} /></div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "#0A0A0A" }}>Launch Sequence</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "#64748B" }}>Choose the mailbox to send from, then go live.</p>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>Sending mailbox</label>
              {launchEmailAccountsLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}><Loader2 style={{ width: 16, height: 16, color: "#2563EB" }} className="animate-spin" /><span style={{ fontSize: "0.875rem", color: "#64748B" }}>Loading connected mailboxes…</span></div>
              ) : launchEmailAccounts.length === 0 ? (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 12 }}>
                  <p style={{ fontSize: "0.75rem", color: "#B45309", fontWeight: 600, margin: 0 }}>No connected email accounts found in Reply.io.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {launchEmailAccounts.map(acc => (
                    <button key={acc.id} onClick={() => setLaunchSelectedEmailId(acc.id)} style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, textAlign: "left", cursor: "pointer",
                      border: `1px solid ${launchSelectedEmailId === acc.id ? "#2563EB" : "#E2E8F0"}`,
                      background: launchSelectedEmailId === acc.id ? "#EFF6FF" : "#fff",
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#2563EB", flexShrink: 0 }}>{acc.email[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.alias || acc.email}</p>
                      </div>
                      {launchSelectedEmailId === acc.id && <CheckCircle2 style={{ width: 16, height: 16, color: "#2563EB", flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>Enroll lead list <span style={{ fontWeight: 400, textTransform: "none" }}>(required if no contacts yet)</span></label>
              <select value={launchListId} onChange={e => setLaunchListId(e.target.value)} style={selectCls}>
                <option value="">Skip — contacts already enrolled</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>Max emails per day</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input type="number" min={1} max={2000} value={launchEmailsPerDay} onChange={e => setLaunchEmailsPerDay(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))} style={{ width: 90, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 9, fontSize: "0.875rem", textAlign: "center", fontFamily: "monospace" }} />
                {[50, 100, 200, 400].map(v => (
                  <button key={v} onClick={() => setLaunchEmailsPerDay(v)} style={{ padding: "6px 10px", fontSize: "0.75rem", fontWeight: 700, borderRadius: 8, border: `1px solid ${launchEmailsPerDay === v ? "#2563EB" : "#E2E8F0"}`, background: launchEmailsPerDay === v ? "#2563EB" : "#fff", color: launchEmailsPerDay === v ? "#fff" : "#64748B", cursor: "pointer" }}>{v}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setLaunchModalOpen(false)} disabled={launchConfirming} style={{ flex: 1, padding: "9px 0", ...btnBack }}>Cancel</button>
              <button onClick={handleConfirmLaunch} disabled={launchConfirming || launchEmailAccountsLoading || launchEmailAccounts.length === 0} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 0", ...btnPrimary, opacity: launchConfirming || launchEmailAccountsLoading || launchEmailAccounts.length === 0 ? 0.5 : 1 }}>
                {launchConfirming ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Launching…</> : <><Play style={{ width: 14, height: 14 }} /> Go Live</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastHost />
    </>
  );
}