import { useEffect, useRef, useState, type ReactNode, type ElementType } from 'react';
import { ArrowDown, ArrowUpRight, BadgeCheck, Bell, BriefcaseBusiness, CalendarDays, Check, Menu, Pause, Play, ScanLine, Search, Send, UserCheck, X } from 'lucide-react';
import { PipelinePanel, stageIcons, stageLabels } from '@/pipelineStages';
import ProductShowcase from '@/ProductShowcase';
import { useAuth } from '@/lib/auth';
import AuthPage from '@/pages/AuthPage';
import DashboardLayout, { type DashboardPage } from '@/pages/DashboardLayout';
import OverviewPage from '@/pages/OverviewPage';
import ClientsPage from '@/pages/ClientsPage';
import CandidatesPage from '@/pages/CandidatesPage';
import OutreachPage from '@/pages/OutreachPage';
import SettingsPage from '@/pages/SettingsPage';
import RolesPage from '@/pages/RolesPage';
import InboxPage from '@/pages/InboxPage';
import LeadsPage from '@/pages/LeadsPage';
import LinkedInPage from '@/pages/LinkedInPage';
import CampaignsPage from '@/pages/CampaignsPage';
import InboxKitPage from './pages/InboxkitPage';
import ReplyioPage from './pages/ReplyioPage';

type ModalType = 'demo' | 'access' | null;

type Signal = {
  label: string;
  title: string;
  body: string;
  tone: 'teal' | 'amber' | 'blue' | 'slate';
};

const signals: Signal[] = [
  { label: 'NEW', title: 'First time seen', body: "A posting that hasn't appeared in any previous scan — the earliest possible signal that a role has opened.", tone: 'teal' },
  { label: 'REPOST', title: 'Posted again', body: 'The same role re-published after being taken down, usually a sign the first search stalled.', tone: 'amber' },
  { label: 'REOPENED', title: 'Back after closing', body: 'A posting that was closed and has now returned — often a failed offer or a backfill.', tone: 'blue' },
  { label: 'AGING', title: 'Open too long', body: "A role that's crossed your days-open threshold without a repost — a search that's quietly stuck.", tone: 'slate' },
];

const pipeline = [
  { number: '01', label: 'SCAN', title: 'Scan LinkedIn and Indeed', body: 'Scheduled scrapers pull fresh listings across both boards, store the raw postings, and dedupe them against everything already seen.' },
  { number: '02', label: 'SCORE', title: 'Resolve and score each signal', body: "Postings are matched to the right company, then scored by what changed: a brand-new opening, a repost, a reopened role, or one that's been sitting open too long." },
  { number: '03', label: 'REACH', title: 'Source and reach out', body: 'Every signal comes with matching candidates and a ready outreach sequence across email and LinkedIn, so you can act on the same day.' },
];

const scanStates = ['Scanning LinkedIn…', 'Scanning Indeed…', 'Cross-referencing 500M profiles…', '12 new signals found'];
const trustedLogos = ['NORTHWIND', 'Cobalt', 'Veridian', 'Brightwell', 'Northstar', 'Helix', 'Meridian', 'Apex Labs'];

/* ── Hooks ── */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let startTime: number | null = null;
    let frame: number;
    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
      else setValue(target);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);
  return value;
}

function useTypewriter(texts: string[], typeSpeed = 55, pauseMs = 1600) {
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

  useEffect(() => {
    const fullText = texts[index];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (text.length < fullText.length) {
        timeout = setTimeout(() => setText(fullText.slice(0, text.length + 1)), typeSpeed);
      } else {
        timeout = setTimeout(() => setPhase('pausing'), pauseMs);
      }
    } else if (phase === 'pausing') {
      timeout = setTimeout(() => setPhase('deleting'), 200);
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => setText(fullText.slice(0, text.length - 1)), typeSpeed / 2);
      } else {
        setIndex((prev) => (prev + 1) % texts.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timeout);
  }, [text, phase, index, texts, typeSpeed, pauseMs]);

  return text;
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? scrollTop / docHeight : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progress;
}

function useParallax(strength = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame: number;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const offset = (center - window.innerHeight / 2) * strength;
        el.style.transform = `translateY(${offset}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [strength]);
  return ref;
}

/* ── Components ── */

function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: ElementType }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

function MetricCounter({ target, suffix, active }: { target: number; suffix: string; active: boolean }) {
  const value = useCountUp(target, active);
  return <strong>{value}{suffix}</strong>;
}

type LiveStat = { value: number; suffix: string; label: string };
type LiveRow = { name: string; sub: string; badge: 'LinkedIn' | 'Web' | 'Rediscovery' | 'Email'; score: string; scoreValue: number };
type LiveStage = {
  status: string;
  context: string;
  notification: string;
  stats: LiveStat[];
  rows: LiveRow[];
  detailTitle: string;
  detailSub: string;
  metrics: { label: string; value: string }[];
  insight: string;
  icon: typeof Search;
  tone: string;
};

const liveStages: LiveStage[] = [
  {
    status: 'SIGNAL DETECTED',
    context: 'Monitoring: Acme Corp — Series B raise · $40M',
    notification: 'NEW JOB ALERT — Acme Corp just posted',
    stats: [
      { value: 500, suffix: 'M', label: 'profiles cross-referenced' },
      { value: 12, suffix: '', label: 'signals matched' },
      { value: 3, suffix: '', label: 'shortlisted' },
    ],
    rows: [
      { name: 'Senior Data Scientist', sub: 'Acme Corp · Remote', badge: 'LinkedIn', score: '+94%', scoreValue: 94 },
      { name: 'Staff ML Engineer', sub: 'Acme Corp · NYC', badge: 'Web', score: '+87%', scoreValue: 87 },
      { name: 'Data Eng Lead', sub: 'Acme Corp · Reopened', badge: 'Rediscovery', score: '+71%', scoreValue: 71 },
      { name: 'Analytics Manager', sub: 'Acme Corp · Aging', badge: 'Web', score: '+63%', scoreValue: 63 },
    ],
    detailTitle: 'Senior Data Scientist',
    detailSub: 'Acme Corp · Remote · Posted 2h ago',
    metrics: [
      { label: 'Signal confidence', value: '94%' },
      { label: 'Days to fill (est.)', value: '38d' },
      { label: 'Hiring velocity', value: 'High' },
      { label: 'Competitor count', value: '4' },
    ],
    insight: 'First-time posting from a company that just raised — the earliest possible signal.',
    icon: Search,
    tone: 'teal',
  },
  {
    status: 'CANDIDATES SOURCED',
    context: 'Role opened: Senior Data Scientist, Remote',
    notification: '1,240 candidates sourced in 4.2s',
    stats: [
      { value: 1240, suffix: '', label: 'candidates found' },
      { value: 312, suffix: '', label: 'matching skills' },
      { value: 47, suffix: '', label: 'in active search' },
    ],
    rows: [
      { name: 'Maya Chen', sub: 'ML Engineer · 6y exp', badge: 'LinkedIn', score: '96%', scoreValue: 96 },
      { name: 'Arjun Patel', sub: 'Data Scientist · 5y exp', badge: 'LinkedIn', score: '92%', scoreValue: 92 },
      { name: 'Sofia Reyes', sub: 'ML Lead · 8y exp', badge: 'Web', score: '88%', scoreValue: 88 },
      { name: 'David Kim', sub: 'Sr Analyst · 4y exp', badge: 'Rediscovery', score: '81%', scoreValue: 81 },
    ],
    detailTitle: 'Maya Chen',
    detailSub: 'ML Engineer · 6y exp · Open to work',
    metrics: [
      { label: 'Skills matched', value: '9 / 12' },
      { label: 'Years experience', value: '6y' },
      { label: 'Last active', value: '2d ago' },
      { label: 'Match score', value: '96%' },
    ],
    insight: 'Top match: 9 of 12 required skills, recently active, and open to new roles.',
    icon: UserCheck,
    tone: 'teal',
  },
  {
    status: 'MATCHED & SCORED',
    context: 'Scoring: Senior Data Scientist vs 312 profiles',
    notification: '3 candidates scored above threshold',
    stats: [
      { value: 312, suffix: '', label: 'profiles scored' },
      { value: 8, suffix: '', label: 'above threshold' },
      { value: 3, suffix: '', label: 'shortlisted' },
    ],
    rows: [
      { name: 'Maya Chen', sub: 'ML Engineer · 96% match', badge: 'LinkedIn', score: '96%', scoreValue: 96 },
      { name: 'Arjun Patel', sub: 'Data Scientist · 92% match', badge: 'LinkedIn', score: '92%', scoreValue: 92 },
      { name: 'Sofia Reyes', sub: 'ML Lead · 88% match', badge: 'Web', score: '88%', scoreValue: 88 },
      { name: 'David Kim', sub: 'Sr Analyst · 81% match', badge: 'Rediscovery', score: '81%', scoreValue: 81 },
    ],
    detailTitle: 'Maya Chen',
    detailSub: 'ML Engineer · 96% match · Ranked #1',
    metrics: [
      { label: 'Skills matched', value: '9 / 12' },
      { label: 'Days-to-fill (est.)', value: '38d' },
      { label: 'Signal confidence', value: '94%' },
      { label: 'Culture fit', value: 'High' },
    ],
    insight: 'Ranked #1 because she matches 9 of 12 skills and came from a similar-stage company.',
    icon: BriefcaseBusiness,
    tone: 'amber',
  },
  {
    status: 'OUTREACH SENT',
    context: 'Campaign: Senior Data Scientist — 3 candidates',
    notification: '3 outreach messages sent',
    stats: [
      { value: 3, suffix: '', label: 'messages sent' },
      { value: 2, suffix: '', label: 'opened' },
      { value: 1, suffix: '', label: 'replied' },
    ],
    rows: [
      { name: 'Maya Chen', sub: 'Email #1 · Opened', badge: 'Email', score: 'Replied', scoreValue: 100 },
      { name: 'Arjun Patel', sub: 'LinkedIn DM · Opened', badge: 'LinkedIn', score: 'Opened', scoreValue: 67 },
      { name: 'Sofia Reyes', sub: 'Email #1 · Sent', badge: 'Email', score: 'Sent', scoreValue: 33 },
      { name: 'David Kim', sub: 'LinkedIn DM · Queued', badge: 'LinkedIn', score: 'Queued', scoreValue: 10 },
    ],
    detailTitle: 'Maya Chen',
    detailSub: 'Email #1 · Replied in 4 hours',
    metrics: [
      { label: 'Response time', value: '4h' },
      { label: 'Open rate', value: '100%' },
      { label: 'Reply rate', value: '33%' },
      { label: 'Sentiment', value: 'Positive' },
    ],
    insight: 'Replied within 4 hours with a positive tone — move to interview immediately.',
    icon: Send,
    tone: 'amber',
  },
  {
    status: 'INTERVIEW SCHEDULED',
    context: 'Candidate: Maya Chen · Senior Data Scientist',
    notification: 'Interview booked — Tomorrow 11:00 AM',
    stats: [
      { value: 1, suffix: '', label: 'interview booked' },
      { value: 2, suffix: '', label: 'panel confirmed' },
      { value: 0, suffix: '', label: 'conflicts' },
    ],
    rows: [
      { name: 'Maya Chen', sub: 'Tech Screen · Tomorrow 11:00', badge: 'Email', score: 'Booked', scoreValue: 100 },
      { name: 'Arjun Patel', sub: 'Phone Screen · Pending', badge: 'LinkedIn', score: 'Pending', scoreValue: 50 },
      { name: 'Sofia Reyes', sub: 'Not yet contacted', badge: 'Web', score: '—', scoreValue: 5 },
      { name: 'David Kim', sub: 'Not yet contacted', badge: 'Rediscovery', score: '—', scoreValue: 5 },
    ],
    detailTitle: 'Maya Chen',
    detailSub: 'Tech Screen · Tomorrow 11:00 AM · 45 min',
    metrics: [
      { label: 'Panel confirmed', value: '2 / 3' },
      { label: 'Duration', value: '45m' },
      { label: 'Format', value: 'Video' },
      { label: 'Signal confidence', value: '94%' },
    ],
    insight: 'Hiring manager and 2 panel members confirmed — no scheduling conflicts detected.',
    icon: CalendarDays,
    tone: 'blue',
  },
  {
    status: 'HIRE CONFIRMED',
    context: 'Placement: Maya Chen → Acme Corp · Senior Data Scientist',
    notification: 'CANDIDATE HIRED — Maya Chen accepted offer',
    stats: [
      { value: 1, suffix: '', label: 'offer accepted' },
      { value: 38, suffix: 'd', label: 'signal-to-hire' },
      { value: 0, suffix: '', label: 'drop-offs' },
    ],
    rows: [
      { name: 'Maya Chen', sub: 'Offer accepted · $185K', badge: 'Email', score: 'Hired', scoreValue: 100 },
      { name: 'Arjun Patel', sub: 'Still in pipeline', badge: 'LinkedIn', score: 'Active', scoreValue: 50 },
      { name: 'Sofia Reyes', sub: 'Still in pipeline', badge: 'Web', score: 'Active', scoreValue: 50 },
      { name: 'David Kim', sub: 'Archived', badge: 'Rediscovery', score: 'Archived', scoreValue: 10 },
    ],
    detailTitle: 'Maya Chen',
    detailSub: 'Offer accepted · $185K · Start in 3 weeks',
    metrics: [
      { label: 'Signal-to-hire', value: '38d' },
      { label: 'Offer acceptance', value: '100%' },
      { label: 'Start date', value: 'Sep 18' },
      { label: 'Signal confidence', value: '94%' },
    ],
    insight: 'From first signal to accepted offer in 38 days — 2.5x faster than industry average.',
    icon: BadgeCheck,
    tone: 'green',
  },
];

function LiveStatChip({ stat, primary, tick }: { stat: LiveStat; primary: boolean; tick: number }) {
  const value = useCountUp(stat.value + tick, true, 800);
  return (
    <span className={primary ? 'primary' : ''}>
      <strong>{value.toLocaleString()}{stat.suffix}</strong> {stat.label}
    </span>
  );
}

function ScoreBar({ value, tone, delay }: { value: number; tone: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => setWidth(value), 150 + delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return (
    <span className="live-card-score-bar">
      <span className={`live-card-score-bar-fill fill-${tone}`} style={{ width: `${width}%`, transitionDelay: `${delay}ms` }} />
    </span>
  );
}

function LiveIntelligenceCard() {
  const [activePost, setActivePost] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const jobPosts = [
    {
      board: 'Indeed',
      boardColor: '#216ee8',
      title: 'Software Developer — Fresher',
      company: 'Soranova Technologies Private Limited',
      location: 'Remote · India',
      pay: '₹4L – ₹7L / year',
      posted: 'Posted 2 minutes ago',
      image: '/images/image%20copy%2016.png',
    },
    {
      board: 'LinkedIn',
      boardColor: '#0a66c2',
      title: 'AWS Student Builder Group Leader',
      company: 'NEXT GEN·TEAM',
      location: 'India · Remote',
      pay: 'Remote · Internship',
      posted: 'Posted 3 days ago',
      image: '/images/image%20copy%2014.png',
    },
    {
      board: 'Indeed',
      boardColor: '#216ee8',
      title: 'Sales Development Manager',
      company: 'fingertipstech · Fingertips Solutions Private Limited',
      location: 'Remote · India',
      pay: 'From ₹50,000 a month',
      posted: 'Posted 9 minutes ago',
      image: '/images/image%20copy%2017.png',
    },
    {
      board: 'LinkedIn',
      boardColor: '#0a66c2',
      title: 'Data & Automation Executive',
      company: 'ScaleX',
      location: 'India · Remote',
      pay: '₹3L – ₹5L / year',
      posted: 'Posted 2 hours ago',
      image: '/images/image%20copy%2015.png',
    },
  ];

  useEffect(() => {
    const postInterval = setInterval(() => {
      setActivePost((current) => (current + 1) % jobPosts.length);
      setScanProgress(0);
    }, 4600);
    const scanInterval = setInterval(() => {
      setScanProgress((current) => (current >= 100 ? 0 : current + 2));
    }, 90);
    return () => {
      clearInterval(postInterval);
      clearInterval(scanInterval);
    };
  }, [jobPosts.length]);

  return (
    <div
      className="live-card"
      aria-label="HubCredo live LinkedIn and Indeed job scanner"
      style={{ overflow: 'hidden', padding: 0, background: '#fff' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px 12px', borderBottom: '1px solid #e7edf5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#18213d', fontSize: 11, fontFamily: 'DM Mono, monospace', letterSpacing: '.08em' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5a0', boxShadow: '0 0 0 4px rgba(14,165,160,.12)' }} />
          LIVE SCANNING JOB POSTS
        </div>
        <span style={{ color: '#0ea5a0', fontSize: 10, fontFamily: 'DM Mono, monospace' }}>2 BOARDS · 4 LIVE POSTS</span>
      </div>
      <div style={{ padding: '13px 18px 12px', background: '#f7f9fc', borderBottom: '1px solid #edf1f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#5e6b82', fontSize: 11, fontFamily: 'DM Mono, monospace' }}>
          <ScanLine size={13} color="#0ea5a0" />
          Scanning LinkedIn and Indeed for new openings
        </div>
        <div style={{ height: 4, marginTop: 10, borderRadius: 4, background: '#dfe7f1', overflow: 'hidden' }}>
          <div style={{ width: `${scanProgress}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #0ea5a0, #14c7c0)', transition: 'width 90ms linear' }} />
        </div>
      </div>
      <div style={{ overflow: 'hidden', padding: '16px 0 18px' }}>
        <div style={{ display: 'flex', width: '400%', transform: `translateX(-${activePost * 25}%)`, transition: 'transform 700ms cubic-bezier(.22,1,.36,1)' }}>
          {jobPosts.map((jobPost, idx) => (
            <div key={`${jobPost.board}-${idx}`} style={{ width: '25%', padding: '0 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: jobPost.boardColor, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: jobPost.boardColor }} />
                  {jobPost.board}
                </span>
                <span style={{ color: '#8a98ad', fontSize: 10, fontFamily: 'DM Mono, monospace' }}>NEW SIGNAL</span>
              </div>
              <div style={{ position: 'relative', height: 190, overflow: 'hidden', border: '1px solid #dfe6f0', borderRadius: 10, background: '#fff' }}>
                <img src={jobPost.image} alt={`${jobPost.board} job post preview`} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center top', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(14,165,160,0) 0%, rgba(14,165,160,.13) 48%, rgba(14,165,160,0) 53%)', transform: `translateY(${(scanProgress / 100) * 145 - 72}px)`, transition: 'transform 90ms linear' }} />
              </div>
              <div style={{ paddingTop: 12 }}>
                <div style={{ color: '#18213d', fontSize: 15, fontWeight: 700 }}>{jobPost.title}</div>
                <div style={{ marginTop: 5, color: '#5e6b82', fontSize: 12 }}>{jobPost.company} · {jobPost.location}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
                  <span style={{ color: '#16834c', background: '#e9fbf0', borderRadius: 5, padding: '5px 8px', fontSize: 10, fontWeight: 600 }}>{jobPost.pay}</span>
                  <span style={{ color: '#8a98ad', fontSize: 10, whiteSpace: 'nowrap' }}>{jobPost.posted}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: '1px solid #edf1f6', color: '#7587a0', fontSize: 10, fontFamily: 'DM Mono, monospace' }}>
        <span><Bell size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> ALERTS ON</span>
        <span style={{ color: '#0ea5a0' }}>POST {activePost + 1} / {jobPosts.length}</span>
      </div>
    </div>
  );
}

function TiltCard({ children, className = '', as: Tag = 'div', delay = 0 }: { children: ReactNode; className?: string; as?: ElementType; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;
    el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-7px)`;
    el.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
    el.style.setProperty('--my', `${(y / rect.height) * 100}%`);
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateY(0)';
  };

  return (
    <Tag
      ref={cardRef}
      className={`reveal tilt-card ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </Tag>
  );
}

function ScrollProgressBar() {
  const progress = useScrollProgress();
  return <div className="scroll-progress" style={{ transform: `scaleX(${progress})` }} />;
}

function MagneticButton({ children, className, onClick }: { children: ReactNode; className: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.18}px, ${y * 0.25 - 2}px)`;
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
  };

  return (
    <button ref={ref} className={className} onClick={onClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </button>
  );
}

/* ── Landing Page ── */

function LandingPage({ onGetAccess }: { onGetAccess: () => void }) {
  const [modal, setModal] = useState<ModalType>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [activePipelineStep, setActivePipelineStep] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const metricsRef = useRef<HTMLDivElement>(null);
  const [metricsVisible, setMetricsVisible] = useState(false);

  const typedText = useTypewriter(scanStates);
  const radarParallaxRef = useParallax(0.12);
  const heroCopyParallaxRef = useParallax(-0.06);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const pipelineInterval = setInterval(() => {
      setActivePipelineStep((prev) => (prev + 1) % pipeline.length);
    }, 4200);
    return () => clearInterval(pipelineInterval);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const el = metricsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMetricsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const openModal = (type: Exclude<ModalType, null>) => {
    if (type === 'access') { onGetAccess(); return; }
    setSent(false);
    setModal(type);
    setMenuOpen(false);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <ScrollProgressBar />

      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <button
          className="brand"
          onClick={() => scrollTo('top')}
          aria-label="HubCredo home"
          style={{ display: 'flex', alignItems: 'center', marginRight: 'auto' }}
        >
          <img
            src="/images/favicon.svg"
            alt="HubCredo"
            style={{ height: 100, width: 150, objectFit: 'contain', display: 'block' }}
          />
        </button>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`}>
          <button onClick={() => scrollTo('find-reach')}>Find &amp; reach companies</button>
          <button onClick={() => scrollTo('find-candidates')}>Find candidates</button>
          <button onClick={() => scrollTo('how-it-works')}>How it works</button>
        </nav>
        <div className="header-actions">
          <button className="button button-ghost" onClick={() => openModal('demo')}>Book a demo</button>
          <MagneticButton className="button button-dark" onClick={() => openModal('access')}>Get early access <ArrowUpRight size={16} /></MagneticButton>
        </div>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <main id="top">
        <section className="hero section-dark">
          <div className="dot-grid" />
          <div className="hero-copy" ref={heroCopyParallaxRef}>
            <Reveal className="eyebrow"><span className="status-dot" /> JOB SIGNALS ENGINE — SCANNING NOW</Reveal>
            <Reveal delay={120}><h1 className="gradient-headline">Find who's hiring, reach the decision-maker, <em>or</em> source the candidates - one app for both sides of the search.</h1></Reveal>
            <Reveal delay={240}><p className="hero-lede">Track companies hiring and pitch decision-makers directly. Or source and screen candidates for roles you're already working. Same app, either way.</p></Reveal>
            <Reveal delay={360}><div className="hero-actions">
              <MagneticButton className="button button-teal" onClick={() => openModal('access')}>Get early access <ArrowUpRight size={17} /></MagneticButton>
              <button className="text-button" onClick={() => scrollTo('how-it-works')}>See how it works <ArrowDown size={15} /></button>
            </div></Reveal>
            <Reveal delay={480}><div className="hero-proof"><span><strong>24/7</strong> monitoring</span><span><strong>4</strong> signal types</span><span><strong>1</strong> clear next move</span></div></Reveal>
            <Reveal delay={560}><div className="scan-line"><span className="scan-cursor" />{typedText}</div></Reveal>
          </div>
          <div className="hero-visual" ref={radarParallaxRef} style={{ alignSelf: 'start', alignItems: 'flex-start' }}>
            <LiveIntelligenceCard />
          </div>
        </section>

        <section className="metrics-strip" ref={metricsRef}>
          <div><MetricCounter target={200} suffix="+" active={metricsVisible} /><span>teams already<br />reading the signal</span></div>
          <div><MetricCounter target={500} suffix="M+" active={metricsVisible} /><span>profiles indexed<br />for your next search</span></div>
          <div><MetricCounter target={8} suffix="M+" active={metricsVisible} /><span>role changes<br />tracked monthly</span></div>
          <div className="strip-note">The best time to reach a candidate<br /><strong>is before everyone else sees the job.</strong></div>
        </section>

         <section className="trusted-strip" aria-label="Teams using HubCredo">
          <div className="trusted-track">
            {[...trustedLogos, ...trustedLogos].map((logo, i) => (
              <span key={`${logo}-${i}`} className="trusted-logo">{logo}</span>
            ))}
          </div>
        </section>

        <section className="signals section-dark" id="find-reach">
          <div className="dot-grid" />
          <div className="section-intro">
            <Reveal className="eyebrow"><span className="status-dot" /> FIND &amp; REACH COMPANIES</Reveal>
            <Reveal delay={120}><h2 className="gradient-headline">Find companies hiring, and reach the decision-maker.</h2></Reveal>
            <Reveal delay={240}><p>HubCredo watches LinkedIn and Indeed, flags new openings and reposts the moment they change, then surfaces the hiring manager behind the role so you can pitch to run the search.</p></Reveal>
          </div>
          <div className="signal-grid">
            {signals.map((signal, i) => (
              <TiltCard key={signal.label} delay={i * 120} as="article" className={`signal-card ${signal.tone}`}>
                <span className={`signal-tag ${signal.tone}`}>{signal.label}</span>
                <h3>{signal.title}</h3>
                <p>{signal.body}</p>
                <span className={`card-glow ${signal.tone}`} />
              </TiltCard>
            ))}
          </div>
          <div className="section-intro" style={{ marginTop: '90px' }}>
            <Reveal className="eyebrow"><span className="status-dot" /> WIN THE MANDATE</Reveal>
            <Reveal delay={120}><h2 className="gradient-headline">Be the first call, not the fiftieth application.</h2></Reveal>
            <Reveal delay={240}><p>When a signal fires, HubCredo surfaces the hiring manager or founder behind the role — with contact details and a suggested opening line — so you can pitch to run the search directly.</p></Reveal>
          </div>
          <div className="signal-grid">
            <TiltCard className="signal-card teal" delay={0} as="article">
              <span className="signal-tag teal">DECISION-MAKER</span>
              <h3>Hiring manager identified</h3>
              <p>Name, title, and verified contact details for the person behind the open role — not a generic careers inbox.</p>
              <span className="card-glow teal" />
            </TiltCard>
            <TiltCard className="signal-card amber" delay={120} as="article">
              <span className="signal-tag amber">OUTREACH</span>
              <h3>Suggested pitch, ready to send</h3>
              <p>A draft message tailored to the role and company, so you can reach out the same day the signal fires.</p>
              <span className="card-glow amber" />
            </TiltCard>
          </div>
        </section>

        <section className="product-showcase-section" id="find-candidates">
          <Reveal className="showcase-heading">
            <div className="eyebrow eyebrow-dark"><span className="status-dot" /> FIND CANDIDATES</div>
            <p>Or start from the other side: find candidates.</p>
          </Reveal>
          <Reveal delay={160}>
            <ProductShowcase />
          </Reveal>
        </section>

        <section className="pipeline section-light" id="how-it-works">
          <div className="section-intro">
            <Reveal className="eyebrow eyebrow-dark"><span className="status-dot" /> THE PIPELINE</Reveal>
            <Reveal delay={120}><h2>From scattered job boards to a ranked list of who to call.</h2></Reveal>
            <Reveal delay={240}><p>Three stages run on a schedule, so you're reading signals instead of refreshing tabs.</p></Reveal>
          </div>
          <div className="flow-wrapper">
            <div className="flow-stepper">
              {pipeline.map((item, index) => {
                const StageIcon = stageIcons[index];
                return (
                  <button
                    key={item.number}
                    className={`flow-step ${activePipelineStep === index ? 'active' : ''} ${activePipelineStep > index ? 'done' : ''}`}
                    onClick={() => setActivePipelineStep(index)}
                  >
                    <span className="flow-step-marker">
                      {activePipelineStep > index ? <Check size={14} /> : <StageIcon size={16} />}
                    </span>
                    <span className="flow-step-text">
                      <span className="flow-step-label">{stageLabels[index]}</span>
                      <span className="flow-step-title">{item.title}</span>
                    </span>
                    {index < pipeline.length - 1 && <span className="flow-step-connector" />}
                  </button>
                );
              })}
            </div>
            <div className="flow-body">
              <PipelinePanel activeStep={activePipelineStep} />
            </div>
          </div>
        </section>

        <section className="cta section-light">
          <div className="cta-line" />
          <Reveal className="cta-content">
            <div className="eyebrow eyebrow-dark"><span className="status-dot" /> YOUR NEXT ADVANTAGE</div>
            <h2>Whether you're chasing the mandate or filling the role, get there first.</h2>
            <MagneticButton className="button button-dark" onClick={() => openModal('access')}>Get early access <ArrowUpRight size={16} /></MagneticButton>
          </Reveal>
        </section>
      </main>

      <footer className="site-footer site-footer-expanded">
        <div className="footer-main">
          <div className="footer-brand-column">
            <div className="brand" style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src="/images/favicon.svg"
                alt="HubCredo"
                style={{ height: 200, width: 150, objectFit: 'contain', display: 'block' }}
              />
            </div>
            <p>The recruiting intelligence layer for teams that move first — guided, connected, and live from signal to hire.</p>
            <div className="footer-callout">THE BEST CANDIDATE RARELY WINS.<br /><strong>THE BEST TIMING ALWAYS DOES.</strong></div>
          </div>
          <div className="footer-column">
            <h4>PRODUCT</h4>
            <button onClick={() => scrollTo('find-reach')}>Find &amp; reach companies</button>
            <button onClick={() => scrollTo('find-candidates')}>Find candidates</button>
            <button onClick={() => scrollTo('how-it-works')}>How it works</button>
          </div>
          <div className="footer-column">
            <h4>ACCOUNT</h4>
            <button onClick={() => openModal('access')}>Get early access</button>
            <button onClick={() => openModal('demo')}>Book a demo</button>
            <button onClick={() => scrollTo('top')}>Back to top</button>
          </div>
          <div className="footer-column footer-contact">
            <h4>REGISTERED OFFICE</h4>
            <p>HubCredo Solutions Private Limited<br />3rd Floor, Rainmakers Workspace,<br />7th Main Road, JP Nagar Phase 2,<br />Bengaluru, Karnataka — 560078</p>
            <h4>EMAIL</h4>
            <a href="mailto:hello@hubcredo.com">business@hubcredo.com</a>
          </div>
        </div>
        <div className="footer-bottom"><span>© 2026 HubCredo. All rights reserved.</span><span>Built for recruiters who move first.</span></div>
      </footer>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={20} /></button>
            {sent ? (
              <div className="success-state">
                <span className="success-icon"><Check size={22} /></span>
                <h2>You're on the list.</h2>
                <p>We'll reach out with a private look at HubCredo soon.</p>
                <button className="button button-dark" onClick={() => setModal(null)}>Back to site</button>
              </div>
            ) : (
              <>
                <div className="eyebrow eyebrow-dark"><span className="status-dot" /> {modal === 'demo' ? 'SEE THE SIGNAL' : 'GET AHEAD'}</div>
                <h2>{modal === 'demo' ? 'See HubCredo in action.' : 'Be first in line.'}</h2>
                <p>{modal === 'demo' ? 'Tell us where to send your private product walkthrough.' : 'Join the early access list and start reading hiring intent before the market.'}</p>
                <form onSubmit={(event) => { event.preventDefault(); setSent(true); }}>
                  <label>Work email<input type="email" required placeholder="you@company.com" /></label>
                  <label>Company<input type="text" required placeholder="Your company" /></label>
                  <button className="button button-dark form-submit" type="submit">{modal === 'demo' ? 'Request a demo' : 'Join the early access list'} <ArrowUpRight size={16} /></button>
                </form>
                <small>We only use your details to contact you about HubCredo.</small>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── App (router) ── */

function App() {
  const { session, loading } = useAuth();
  const [dashPage, setDashPage] = useState<DashboardPage>('overview');
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return (
      <div className="app-boot">
        <img
          src="/images/favicon.svg"
          alt="HubCredo"
          style={{ height: 40, width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <p>Loading HubCredo…</p>
      </div>
    );
  }

  if (session) {
    return (
      <DashboardLayout activePage={dashPage} onNavigate={setDashPage}>
        {dashPage === 'overview' && <OverviewPage onNavigate={setDashPage} />}
        {dashPage === 'clients' && <ClientsPage />}
        {dashPage === 'candidates' && <CandidatesPage />}
        {dashPage === 'leads' && <LeadsPage />}
        {dashPage === 'linkedin' && <LinkedInPage />}
        {dashPage === 'campaigns' && <CampaignsPage />}
        {dashPage === 'outreach' && <OutreachPage />}
        {dashPage === 'roles' && <RolesPage />}
        {dashPage === 'inbox' && <InboxPage />}
        {dashPage === 'inboxkit' && <InboxKitPage />}
        {dashPage === 'replyio' && <ReplyioPage />}
        {dashPage === 'settings' && <SettingsPage />}

      </DashboardLayout>
    );
  }

  if (showAuth) {
    return <AuthPage />;
  }

  return <LandingPage onGetAccess={() => setShowAuth(true)} />;
}

export default App;