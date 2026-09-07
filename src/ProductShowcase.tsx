import { useEffect, useState } from 'react';
import { BarChart3, CalendarDays, Check, CheckCircle2, Mail, MessageCircle, Mic, Phone, Search, Users } from 'lucide-react';

const tabs = [
  { label: 'Source', icon: Search },
  { label: 'Screen', icon: Phone },
  { label: 'Schedule', icon: CalendarDays },
  { label: 'Evaluate', icon: BarChart3 },
];

const candidates = [
  { name: 'Lin Wei', role: 'Sr. React · Singapore', score: 87 },
  { name: 'Ahmet Okur', role: 'Frontend Lead · Berlin', score: 81 },
  { name: 'Lea Nguyen', role: 'Product Engineer · Toronto', score: 76 },
];

function SceneLabel({ children }: { children: string }) {
  return <div className="scene-label"><i /> {children}</div>;
}

function SourceScene() {
  return (
    <div className="scene source-scene">
      <div className="source-search"><Search size={15} /><span>Senior React Engineer</span><b>SEARCH</b></div>
      <div className="source-summary"><span><strong>148</strong> matched</span><span><strong>87%</strong> avg match</span><span><strong>32</strong> new today</span></div>
      <div className="source-list">
        {candidates.map((candidate, index) => (
          <div className="source-candidate" key={candidate.name}>
            <span className="candidate-avatar">{candidate.name.slice(0, 2)}</span>
            <span className="candidate-info"><b>{candidate.name}</b><small>{candidate.role}</small><em>{index === 0 ? '5y at Stripe, Airbnb' : index === 1 ? '6y at Webflow, Vercel' : '4y at Figma, Shopify'}</em></span>
            <strong>{candidate.score}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenScene() {
  return (
    <div className="scene screen-scene">
      <div className="scene-header"><SceneLabel>REACHING CANDIDATES ACROSS CHANNELS</SceneLabel><span className="scene-counter">3 / 3 live</span></div>
      <div className="screen-cards">
        <div className="screen-card"><span className="channel-icon email"><Mail size={15} /></span><div><b>Email</b><small>Opened · 2m ago</small><p>“Ethan, we'd love to walk you through it.”</p></div><CheckCircle2 size={16} /></div>
        <div className="screen-card"><span className="channel-icon whatsapp"><MessageCircle size={15} /></span><div><b>WhatsApp</b><small>Delivered · Read</small><p>“New AI Engineer role — matches your profile.”</p></div><CheckCircle2 size={16} /></div>
        <div className="screen-card active-screen"><span className="channel-icon voice"><Phone size={15} /></span><div><b>Voice AI</b><small>Connected · 0:48</small><p>AI screening call — 5 qualifying questions</p></div><span className="waveform">▂▅▃▆▅▇</span></div>
      </div>
      <div className="screen-footer"><span><i /> Reply expected within the hour</span><span>Adaptive Q&amp;A · realtime transcript</span></div>
    </div>
  );
}

function ScheduleScene() {
  return (
    <div className="scene schedule-scene">
      <div className="scene-header"><SceneLabel>PICK INTERVIEW DATE</SceneLabel><span className="scene-counter">April 2026</span></div>
      <div className="schedule-layout">
        <div className="calendar-card">
          <div className="calendar-week">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={`${day}-${i}`}>{day}</span>)}</div>
          <div className="calendar-days">{Array.from({ length: 30 }, (_, i) => <span key={i} className={i === 9 ? 'selected-day' : i === 15 || i === 22 ? 'available-day' : ''}>{i + 1}</span>)}</div>
        </div>
        <div className="meeting-card"><span className="meeting-date">FRI, APR 10</span><h3>Interview — Ethan Carter</h3><p>11:00 AM · Google Meet</p><span className="meeting-tag"><Check size={12} /> Assessment Round</span><button>Confirm interview <CalendarDays size={14} /></button></div>
      </div>
    </div>
  );
}

function EvaluateScene() {
  return (
    <div className="scene evaluate-scene">
      <div className="scene-header"><SceneLabel>LIVE · SCORECARD</SceneLabel><span className="scene-counter">Confidence 94%</span></div>
      <div className="scorecard-top"><div className="score-ring"><strong>87</strong><small>/ 100</small></div><div><span className="score-overline">OVERALL</span><h3>Strong Hire</h3><p>Confident on system trade-offs; advance with a scale probe.</p></div></div>
      <div className="scorecard-bars">{[['Tech', 92], ['Comms', 84], ['Culture', 88], ['Motiv.', 90], ['Exp.', 81]].map(([label, value]) => <div key={label as string}><span className="scorebar-track"><i style={{ width: `${value}%` }} /></span><small>{label}<b>{value}</b></small></div>)}</div>
      <div className="evaluation-grid"><div><span className="score-overline teal-label">STRENGTHS</span><p><Check size={13} /> System-design depth</p><p><Check size={13} /> Strong React fundamentals</p><span className="score-overline amber-label">WATCH</span><p className="watch"><i /> Leadership scope unproven</p><p className="watch"><i /> Probe scale experience</p></div><div className="evidence"><span className="score-overline">EVIDENCE</span><p>▧ Transcript <Check size={12} /></p><p>♩ Recording <Check size={12} /></p><p>⌄ Full report</p><b>✓ Defensible</b></div></div>
      <div className="report-row"><span className="candidate-avatar">LW</span><span><b>Lin Wei</b><small>Sr. React · Singapore · Report delivered to hiring manager</small></span><button>Report</button></div>
    </div>
  );
}

function Scene({ activeTab }: { activeTab: number }) {
  if (activeTab === 0) return <SourceScene />;
  if (activeTab === 1) return <ScreenScene />;
  if (activeTab === 2) return <ScheduleScene />;
  return <EvaluateScene />;
}

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => setActiveTab((current) => (current + 1) % tabs.length), 5200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hirebound-showcase">
      <div className="showcase-sidebar">
        <div className="showcase-pill">AI THAT ACTUALLY RECRUITS</div>
        <h2>End-to-end intelligence for better hiring outcomes.</h2>
        <div className="showcase-tabs">
          {tabs.map((tab, index) => (
            <button key={tab.label} className={`showcase-tab ${activeTab === index ? 'active' : ''}`} onClick={() => setActiveTab(index)}>
              <tab.icon size={18} /><span>{tab.label}</span>{activeTab === index && <i />}
            </button>
          ))}
        </div>
        <div className="showcase-message" key={activeTab}>
          <h3>{activeTab === 0 ? 'Find the right people.' : activeTab === 1 ? 'Every candidate contacted. Instantly.' : activeTab === 2 ? 'Interviews without the back-and-forth.' : 'A shortlist you can actually trust.'}</h3>
          <p><CheckCircle2 size={18} /> {activeTab === 3 ? 'Scored on 5 dimensions' : 'Reaches every candidate on 4 channels'} <span>{activeTab === 3 ? 'structured signals, not gut feel.' : 'email, voice, WhatsApp, and LinkedIn.'}</span></p>
        </div>
      </div>
      <div className="showcase-canvas"><div className="scene-orbit" /><div className="scene-shell" key={activeTab}><Scene activeTab={activeTab} /></div><div className="showcase-status"><Users size={13} /> 12 candidates moving now <Mail size={13} /></div></div>
    </div>
  );
}
