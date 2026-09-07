import { useEffect, useState } from 'react';
import { Plus, X, Send, Mail, Linkedin, Trash2, Check, Clock } from 'lucide-react';
import { supabase, type OutreachSequence, type Candidate } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function OutreachPage() {
  const { user } = useAuth();
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    candidate_id: '', channel: 'email' as 'email' | 'linkedin', subject: '', message: '',
  });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [{ data: seq }, { data: cand }] = await Promise.all([
      supabase.from('outreach_sequences').select('*').order('created_at', { ascending: false }),
      supabase.from('candidates').select('*').order('created_at', { ascending: false }),
    ]);
    setSequences((seq as OutreachSequence[]) ?? []);
    setCandidates((cand as Candidate[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const createSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase.from('outreach_sequences').insert({
      candidate_id: form.candidate_id || null,
      channel: form.channel,
      subject: form.subject || null,
      message: form.message || null,
      status: 'draft',
    });
    if (err) { setError('Could not create sequence.'); return; }
    setForm({ candidate_id: '', channel: 'email', subject: '', message: '' });
    setShowModal(false);
    load();
  };

  const sendSequence = async (seq: OutreachSequence) => {
    await supabase.from('outreach_sequences')
      .update({ status: 'active', sent_at: new Date().toISOString() })
      .eq('id', seq.id);
    if (seq.candidate_id) {
      await supabase.from('candidates').update({ status: 'contacted' }).eq('id', seq.candidate_id);
    }
    load();
  };

  const deleteSequence = async (id: string) => {
    await supabase.from('outreach_sequences').delete().eq('id', id);
    load();
  };

  const candidateName = (id: string | null) => candidates.find((c) => c.id === id)?.full_name ?? 'Unassigned';

  if (loading) return <div className="dash-loading">Loading outreach…</div>;

  return (
    <div className="outreach-page">
      <div className="page-header">
        <div>
          <h1>Outreach</h1>
          <p>Email and LinkedIn sequences for your candidates.</p>
        </div>
        <button className="dash-primary-btn" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Sequence
        </button>
      </div>

      {sequences.length === 0 ? (
        <div className="empty-state-large">
          <Send size={40} />
          <h3>No sequences yet</h3>
          <p>Create your first outreach sequence to start contacting candidates.</p>
          <button className="dash-primary-btn" onClick={() => setShowModal(true)}><Plus size={16} /> New Sequence</button>
        </div>
      ) : (
        <div className="sequence-list">
          {sequences.map((seq) => (
            <div key={seq.id} className="sequence-card">
              <div className="seq-channel-icon">
                {seq.channel === 'email' ? <Mail size={18} /> : <Linkedin size={18} />}
              </div>
              <div className="seq-body">
                <div className="seq-top">
                  <b>{seq.subject || `LinkedIn message to ${candidateName(seq.candidate_id)}`}</b>
                  <span className={`status-badge status-${seq.status}`}>{seq.status}</span>
                </div>
                <p className="seq-candidate">{candidateName(seq.candidate_id)}</p>
                {seq.message && <p className="seq-preview">{seq.message.slice(0, 120)}{seq.message.length > 120 ? '…' : ''}</p>}
                <div className="seq-meta">
                  {seq.sent_at && <span><Clock size={11} /> Sent {new Date(seq.sent_at).toLocaleDateString()}</span>}
                  {seq.reply_at && <span><Check size={11} /> Replied {new Date(seq.reply_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="seq-actions">
                {seq.status === 'draft' && (
                  <button className="dash-send-btn" onClick={() => sendSequence(seq)}>
                    <Send size={14} /> Send
                  </button>
                )}
                <button onClick={() => deleteSequence(seq.id)} className="icon-btn-danger"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal dash-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            <h2>New Outreach Sequence</h2>
            <p>Draft an email or LinkedIn message for a candidate.</p>
            {error && <div className="auth-error"><X size={15} /> {error}</div>}
            <form onSubmit={createSequence} className="dash-form">
              <label>Candidate
                <select value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })}>
                  <option value="">Select a candidate</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </label>
              <label>Channel
                <div className="channel-toggle">
                  <button type="button" className={form.channel === 'email' ? 'active' : ''} onClick={() => setForm({ ...form, channel: 'email' })}><Mail size={15} /> Email</button>
                  <button type="button" className={form.channel === 'linkedin' ? 'active' : ''} onClick={() => setForm({ ...form, channel: 'linkedin' })}><Linkedin size={15} /> LinkedIn</button>
                </div>
              </label>
              {form.channel === 'email' && (
                <label>Subject<input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. New role matching your profile" /></label>
              )}
              <label>Message<textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} placeholder="Write your message…" /></label>
              <button type="submit" className="dash-primary-btn">Create Sequence</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
