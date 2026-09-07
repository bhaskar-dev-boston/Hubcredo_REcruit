import { useEffect, useState } from 'react';
import { Mail, Linkedin, Zap, Check, X, Loader2, KeyRound, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function authFetch(path: string, opts?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  });
}

// IMPORTANT: these keys must match the `service` value your backend looks
// up (e.g. server/routes/replyioLinkedin.ts does .eq("service", "replyio"))
// — no underscore, matching that exactly.
type ProviderKey = 'replyio' | 'linkedin' | 'email' | 'inboxkit';

interface UserIntegration {
  id: string;
  user_id: string;
  service: string;
  api_key: string | null;
  workspace_id?: string | null;
  account_label?: string | null;
  is_connected: boolean;
  last_checked_at?: string | null;
  created_at: string;
  updated_at: string;
}

const providers: {
  key: ProviderKey;
  label: string;
  desc: string;
  icon: typeof Mail;
  placeholder: string;
  fieldLabel: string;
  liveVerified: boolean; // true = we actually call the provider's API to confirm the key works
  // optional second field (e.g. InboxKit's Workspace ID)
  extraField?: { name: 'workspace_id'; label: string; placeholder: string };
}[] = [
  { key: 'replyio', label: 'Reply.io', desc: 'Connect your Reply.io account to send and track email campaigns automatically.', icon: Zap, placeholder: 'sk-...', fieldLabel: 'API Key', liveVerified: true },
  { key: 'linkedin', label: 'LinkedIn', desc: 'Connect LinkedIn to automate connection requests and InMail outreach.', icon: Linkedin, placeholder: 'LinkedIn session cookie / API token', fieldLabel: 'Access Token', liveVerified: false },
  { key: 'email', label: 'Email (SMTP)', desc: 'Connect a custom email mailbox to send outreach from your own domain.', icon: Mail, placeholder: 'smtp://user:pass@smtp.example.com:587', fieldLabel: 'SMTP Connection String', liveVerified: false },
  {
    key: 'inboxkit',
    label: 'InboxKit',
    desc: 'Connect InboxKit to view your purchased domains and mailbox infrastructure.',
    icon: Globe,
    placeholder: 'ik-...',
    fieldLabel: 'API Key',
    liveVerified: true,
    extraField: { name: 'workspace_id', label: 'Workspace ID', placeholder: 'e.g. ws_12345' },
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ProviderKey | null>(null);
  const [forms, setForms] = useState<Record<string, { api_key: string; account_label: string; workspace_id: string }>>({});
  const [messages, setMessages] = useState<Record<string, string | null>>({});

  const load = async () => {
    // Reading is fine straight from Supabase (RLS should already scope this
    // to the logged-in user) — it's WRITES that need to go through the
    // backend so keys get verified before is_connected is set.
    const { data, error } = await supabase.from('user_integrations').select('*');
    if (error) {
      console.error('Failed to load integrations:', error.message);
    }
    const rows = (data as UserIntegration[]) ?? [];
    setIntegrations(rows);
    const formState: Record<string, { api_key: string; account_label: string; workspace_id: string }> = {};
    rows.forEach((r) => {
      formState[r.service] = {
        api_key: r.api_key ?? '',
        account_label: r.account_label ?? '',
        workspace_id: r.workspace_id ?? '',
      };
    });
    setForms(formState);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const getIntegration = (service: ProviderKey) => integrations.find((i) => i.service === service);

  const getFormData = (service: ProviderKey) =>
    forms[service] ?? { api_key: '', account_label: '', workspace_id: '' };

  const save = async (service: ProviderKey) => {
    if (!user) return;
    setSavingKey(service);
    setMessages((m) => ({ ...m, [service]: null }));
    const formData = getFormData(service);
    const provider = providers.find((p) => p.key === service)!;

    if (!formData.api_key.trim()) {
      setMessages((m) => ({ ...m, [service]: 'Enter a key before saving.' }));
      setSavingKey(null);
      return;
    }

    if (provider.extraField && !formData.workspace_id.trim()) {
      setMessages((m) => ({ ...m, [service]: `Enter your ${provider.extraField!.label} before saving.` }));
      setSavingKey(null);
      return;
    }

    try {
      // replyio and inboxkit have real backend routes with live verification.
      // linkedin/email are saved as-entered with no live check, per the
      // liveVerified flag above.
      const endpoint =
        service === 'replyio' ? '/api/replyio/save'
        : service === 'inboxkit' ? '/api/inboxkit/save'
        : '/api/integrations/save-manual';

      const payload =
        service === 'replyio'
          ? { apiKey: formData.api_key, accountLabel: formData.account_label }
          : service === 'inboxkit'
          ? { apiKey: formData.api_key, workspaceId: formData.workspace_id, accountLabel: formData.account_label }
          : { service, api_key: formData.api_key, account_label: formData.account_label };

      const r = await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const d = await r.json();

      if (!r.ok) {
        setMessages((m) => ({ ...m, [service]: d.error ?? 'Could not save. Please try again.' }));
        return;
      }

      setMessages((m) => ({
        ...m,
        [service]: d.connected ? 'Connected successfully.' : 'Saved, but not yet verified.',
      }));
      await load();
    } catch (err) {
      console.error(`Failed to save ${service} integration:`, err instanceof Error ? err.message : err);
      setMessages((m) => ({ ...m, [service]: 'Could not save. Please try again.' }));
    } finally {
      setSavingKey(null);
    }
  };

  const disconnect = async (service: ProviderKey) => {
    const existing = getIntegration(service);
    if (!existing) return;
    const endpoint =
      service === 'replyio' ? '/api/replyio/disconnect'
      : service === 'inboxkit' ? '/api/inboxkit/disconnect'
      : '/api/integrations/disconnect-manual';
    await authFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ service }),
    });
    setForms((f) => ({
      ...f,
      [service]: { api_key: '', workspace_id: '', account_label: f[service]?.account_label ?? '' },
    }));
    await load();
  };

  if (loading) return <div className="dash-loading">Loading settings…</div>;

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Connect your outreach channels and integrations.</p>
        </div>
      </div>

      <div className="integration-list">
        {providers.map((p) => {
          const integration = getIntegration(p.key);
          const isConnected = !!integration?.is_connected;
          const formData = getFormData(p.key);
          const msg = messages[p.key];

          return (
            <div key={p.key} className={`integration-card ${isConnected ? 'connected' : ''}`}>
              <div className="integration-header">
                <div className="integration-icon-wrap">
                  <p.icon size={22} />
                </div>
                <div className="integration-title-block">
                  <h3>{p.label}</h3>
                  <p>{p.desc}</p>
                  {!p.liveVerified && (
                    <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '2px 0 0' }}>
                      Saved as entered — we can't verify this key automatically yet.
                    </p>
                  )}
                </div>
                <span className={`connection-badge ${isConnected ? 'is-connected' : 'is-disconnected'}`}>
                  {isConnected ? <><Check size={13} /> Connected</> : <><X size={13} /> Disconnected</>}
                </span>
              </div>

              <div className="integration-form">
                <label className="integration-field">
                  <span><KeyRound size={13} /> {p.fieldLabel}</span>
                  <input
                    type="password"
                    placeholder={p.placeholder}
                    value={formData.api_key}
                    onChange={(e) => setForms((f) => ({ ...f, [p.key]: { ...formData, api_key: e.target.value } }))}
                  />
                </label>

                {p.extraField && (
                  <label className="integration-field">
                    <span><KeyRound size={13} /> {p.extraField.label}</span>
                    <input
                      type="text"
                      placeholder={p.extraField.placeholder}
                      value={formData.workspace_id}
                      onChange={(e) => setForms((f) => ({ ...f, [p.key]: { ...formData, workspace_id: e.target.value } }))}
                    />
                  </label>
                )}

                <label className="integration-field">
                  <span>Account label (optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. Work inbox"
                    value={formData.account_label}
                    onChange={(e) => setForms((f) => ({ ...f, [p.key]: { ...formData, account_label: e.target.value } }))}
                  />
                </label>

                {msg && <div className={`integration-msg ${/could|not saved|error/i.test(msg) ? 'error' : 'success'}`}>{msg}</div>}

                <div className="integration-actions">
                  <button className="dash-primary-btn" onClick={() => save(p.key)} disabled={savingKey === p.key}>
                    {savingKey === p.key ? <><Loader2 size={15} className="spin" /> {p.liveVerified ? 'Verifying…' : 'Saving…'}</> : <>Save connection</>}
                  </button>
                  {isConnected && (
                    <button className="dash-secondary-btn" onClick={() => disconnect(p.key)}>Disconnect</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}