import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Linkedin, Mail, Radio, ScanLine, Users, Zap } from 'lucide-react';

export const stageIcons = [ScanLine, Radio, ArrowUpRight];
export const stageLabels = ['SCAN', 'SCORE', 'REACH'];

const scanBoards = [
  { name: 'LinkedIn', icon: Linkedin, color: 'linkedin' },
  { name: 'Indeed', icon: Radio, color: 'indeed' },
];

const scanRows = [
  { board: 'LinkedIn', role: 'Senior ML Engineer', company: 'Northstar AI', status: 'found' },
  { board: 'Indeed', role: 'Head of Growth', company: 'Brightwell', status: 'found' },
  { board: 'LinkedIn', role: 'Product Designer', company: 'Veridian Labs', status: 'found' },
  { board: 'Indeed', role: 'Staff Backend Eng', company: 'Helix', status: 'deduped' },
];

const scoreRows = [
  { company: 'Northstar AI', signal: 'REPOST', score: 94, tone: 'amber' },
  { company: 'Brightwell', signal: 'NEW', score: 89, tone: 'teal' },
  { company: 'Veridian Labs', signal: 'REOPENED', score: 87, tone: 'blue' },
];

const reachSteps = [
  { label: 'Match 12 candidates', icon: Users, detail: 'from 500M profiles' },
  { label: 'Draft outreach', icon: Mail, detail: 'email + LinkedIn' },
  { label: 'Send 3-touch sequence', icon: Zap, detail: 'all channels fired' },
];

export function PipelinePanel({ activeStep }: { activeStep: number }) {
  return (
    <div className="flow-panel">
      <div className={`flow-panel-slide ${activeStep === 0 ? 'active' : ''}`}>
        <ScanStage active={activeStep === 0} />
      </div>
      <div className={`flow-panel-slide ${activeStep === 1 ? 'active' : ''}`}>
        <ScoreStage active={activeStep === 1} />
      </div>
      <div className={`flow-panel-slide ${activeStep === 2 ? 'active' : ''}`}>
        <ReachStage active={activeStep === 2} />
      </div>
    </div>
  );
}

function ScanStage({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const [visibleRows, setVisibleRows] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      setVisibleRows(0);
      return;
    }
    setProgress(0);
    setVisibleRows(0);
    tickRef.current = 0;
    const progInterval = setInterval(() => {
      tickRef.current = Math.min(tickRef.current + 3, 100);
      setProgress(tickRef.current);
      if (tickRef.current >= 100) clearInterval(progInterval);
    }, 70);
    const rowTimeouts: ReturnType<typeof setTimeout>[] = [];
    scanRows.forEach((_, i) => {
      rowTimeouts.push(setTimeout(() => setVisibleRows(i + 1), 450 + i * 550));
    });
    return () => {
      clearInterval(progInterval);
      rowTimeouts.forEach(clearTimeout);
    };
  }, [active]);

  return (
    <div className="stage-content scan-stage">
      <div className="scan-boards">
        {scanBoards.map((b) => (
          <div key={b.name} className={`scan-board-chip ${b.color} ${active ? 'pulsing' : ''}`}>
            <b.icon size={14} /> {b.name}
            <span className="scan-board-status">{active ? 'LIVE' : 'IDLE'}</span>
          </div>
        ))}
      </div>
      <div className="scan-progress-wrap">
        <div className="scan-progress-track">
          <div className="scan-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="scan-progress-label">
          {progress < 100 ? `Scanning job boards… ${progress}%` : 'Scan complete · 3 new signals'}
        </span>
      </div>
      <div className="scan-rows">
        {scanRows.map((row, i) => (
          <div key={i} className={`scan-row ${visibleRows > i ? 'visible' : ''}`}>
            <span className={`scan-row-board ${row.board.toLowerCase()}`}>{row.board}</span>
            <div className="scan-row-info">
              <span className="scan-row-role">{row.role}</span>
              <span className="scan-row-company">{row.company}</span>
            </div>
            <span className={`scan-row-status ${row.status}`}>
              {row.status === 'found' ? <Check size={11} /> : null}
              {row.status === 'found' ? 'NEW' : 'DEDUP'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreStage({ active }: { active: boolean }) {
  const [resolved, setResolved] = useState(0);
  const [barWidths, setBarWidths] = useState<number[]>([0, 0, 0]);

  useEffect(() => {
    if (!active) {
      setResolved(0);
      setBarWidths([0, 0, 0]);
      return;
    }
    setResolved(0);
    setBarWidths([0, 0, 0]);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    timeouts.push(setTimeout(() => setResolved(1), 350));
    timeouts.push(setTimeout(() => setResolved(2), 800));
    timeouts.push(setTimeout(() => setResolved(3), 1250));
    scoreRows.forEach((row, i) => {
      timeouts.push(
        setTimeout(() => {
          setBarWidths((prev) => {
            const n = [...prev];
            n[i] = row.score;
            return n;
          });
        }, 550 + i * 450)
      );
    });
    return () => timeouts.forEach(clearTimeout);
  }, [active]);

  return (
    <div className="stage-content score-stage">
      <div className="score-resolve-bar">
        <span>Resolving companies &amp; scoring signals</span>
        <span className="score-resolve-count">{resolved}/3 resolved</span>
      </div>
      <div className="score-rows">
        {scoreRows.map((row, i) => (
          <div key={i} className={`score-row ${resolved > i ? 'resolved' : ''}`}>
            <div className="score-row-top">
              <span className="score-row-company">{row.company}</span>
              <span className={`score-row-signal ${row.tone}`}>{row.signal}</span>
            </div>
            <div className="score-row-bar-track">
              <div className={`score-row-bar-fill ${row.tone}`} style={{ width: `${barWidths[i]}%` }} />
            </div>
            <span className="score-row-value">{barWidths[i] > 0 ? `${barWidths[i]}% match` : 'pending'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReachStage({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    setStep(0);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    reachSteps.forEach((_, i) => {
      timeouts.push(setTimeout(() => setStep(i + 1), 450 + i * 650));
    });
    return () => timeouts.forEach(clearTimeout);
  }, [active]);

  return (
    <div className="stage-content reach-stage">
      <div className="reach-steps">
        {reachSteps.map((s, i) => (
          <div
            key={i}
            className={`reach-step ${step > i ? 'done' : ''} ${step === i && active ? 'active' : ''}`}
          >
            <span className="reach-step-icon">
              <s.icon size={16} />
            </span>
            <div className="reach-step-text">
              <strong>{s.label}</strong>
              <small>{s.detail}</small>
            </div>
            <span className="reach-step-check">
              {step > i ? <Check size={14} /> : <span className="reach-step-num">{i + 1}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="reach-preview-footer">
        <Mail size={13} />
        {active && step >= 3
          ? 'Outreach sent — 12 candidates contacted across email & LinkedIn'
          : 'Preparing outreach sequence…'}
      </div>
    </div>
  );
}
