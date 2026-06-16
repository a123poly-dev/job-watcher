import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Site, Recipient } from '../lib/api';
import AddSiteModal from '../components/AddSiteModal';
import BulkImportModal from '../components/BulkImportModal';

const CHECKLIST_KEY = 'jw_checklist_dismissed_at';

function statusBadge(site: Site) {
  if (!site.listSelector) return <span style={{ color: '#f59e0b', fontSize: 13 }}>⚙️ Needs selectors</span>;
  if (!site.lastStatus) return <span style={{ color: '#94a3b8', fontSize: 13 }}>Not checked yet</span>;
  if (site.lastStatus === 'ok') return <span className="status-ok">✅ OK</span>;
  return <span className="status-error" title={site.lastStatus}>⚠️ {site.lastStatus.replace('error: ', '')}</span>;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isChecklistVisible(): boolean {
  const dismissed = localStorage.getItem(CHECKLIST_KEY);
  if (!dismissed) return true;
  // Show again if dismissed more than 24h ago and not yet fully set up
  const age = Date.now() - parseInt(dismissed, 10);
  return age > 24 * 60 * 60 * 1000;
}

interface ChecklistProps {
  hasRecipients: boolean;
  hasSites: boolean;
  hasFilters: boolean;
  onDismiss: () => void;
  onImport: () => void;
}

function SetupChecklist({ hasRecipients, hasSites, hasFilters, onDismiss, onImport }: ChecklistProps) {
  const allDone = hasRecipients && hasSites && hasFilters;

  const steps = [
    {
      done: hasRecipients,
      label: <>Add notification recipients in <Link to="/settings" style={{ fontWeight: 600 }}>Settings</Link></>,
      detail: 'Who should get job alerts? Add your email and your partner\'s.',
    },
    {
      done: hasSites,
      label: <><button onClick={onImport} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, color: '#2563eb', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Import companies</button> from the prepared list</>,
      detail: '90 Finnish & remote companies are ready to add in one click.',
    },
    {
      done: false,
      label: <>Open a company and add <strong>CSS selectors</strong></>,
      detail: 'Click any company → inspect their careers page → fill in list/title/link selectors → hit Preview.',
    },
    {
      done: hasFilters,
      label: <>Add <strong>filters</strong> to each site</>,
      detail: 'Set a keyword (e.g. "designer") and pick who gets notified. Blank = any new listing.',
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #2563eb', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16 }}>
          {allDone ? '🎉 You\'re all set up!' : 'Getting started'}
        </h2>
        <button
          onClick={onDismiss}
          title="Dismiss"
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 0 0 8px' }}
        >
          ✕
        </button>
      </div>
      {allDone && (
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
          Filters are live and the checker runs every 3 hours. Dismiss this when you're done.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: step.done ? 0.6 : 1 }}>
            <span style={{ fontSize: 17, marginTop: 1, flexShrink: 0 }}>{step.done ? '✅' : `${i + 1}.`}</span>
            <div>
              <span style={{ fontSize: 14, fontWeight: step.done ? 400 : 500, textDecoration: step.done ? 'line-through' : 'none' }}>
                {step.label}
              </span>
              {!step.done && (
                <span style={{ color: '#64748b', fontSize: 13, marginLeft: 6 }}>— {step.detail}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showChecklist, setShowChecklist] = useState(isChecklistVisible());
  const [checking, setChecking] = useState<number | null>(null);

  const load = () => {
    api.getSites().then(setSites);
    api.getRecipients().then(setRecipients);
  };

  useEffect(() => { load(); }, []);

  const dismissChecklist = () => {
    localStorage.setItem(CHECKLIST_KEY, String(Date.now()));
    setShowChecklist(false);
  };

  const triggerCheck = async (id: number) => {
    setChecking(id);
    await api.checkSiteNow(id);
    setTimeout(() => { load(); setChecking(null); }, 2000);
  };

  const deleteSite = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return;
    await api.deleteSite(id);
    load();
  };

  const hasFilters = sites.some((s) => s.filters && s.filters.length > 0);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Tracked companies</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowBulk(true)}>📋 Import companies</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add site</button>
        </div>
      </div>

      {showChecklist && (
        <SetupChecklist
          hasRecipients={recipients.length > 0}
          hasSites={sites.length > 0}
          hasFilters={hasFilters}
          onDismiss={dismissChecklist}
          onImport={() => setShowBulk(true)}
        />
      )}

      {!showChecklist && (
        <button
          onClick={() => setShowChecklist(true)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}
        >
          Show setup guide
        </button>
      )}

      {sites.length === 0 ? (
        <div className="empty-state">No sites yet — import the company list or add one manually.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sites.map((site) => (
            <div key={site.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Link to={`/sites/${site.id}`} style={{ fontWeight: 600, fontSize: 16 }}>{site.name}</Link>
                  <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '2px 6px' }}>
                    {site.renderMode}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  <a href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {site.filters?.map((f) => (
                    <span key={f.id} className={`tag${f.isActive ? '' : ' paused'}`}>
                      {f.keyword || '(any)'} → {f.recipient?.label || f.recipient?.email}
                      {!f.isActive && ' (paused)'}
                    </span>
                  ))}
                  {(!site.filters || site.filters.length === 0) && (
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>No filters — <Link to={`/sites/${site.id}`}>add one</Link></span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16 }}>
                  <span>Checked: {timeAgo(site.lastCheckedAt)}</span>
                  {statusBadge(site)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {site.listSelector && (
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => triggerCheck(site.id)}
                    disabled={checking === site.id}
                  >
                    {checking === site.id ? '…' : '▶ Check'}
                  </button>
                )}
                <Link to={`/sites/${site.id}`}>
                  <button className="btn-ghost btn-sm">Edit</button>
                </Link>
                <button className="btn-danger btn-sm" onClick={() => deleteSite(site.id, site.name)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddSiteModal
          recipients={recipients}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {showBulk && (
        <BulkImportModal
          onClose={() => setShowBulk(false)}
          onDone={() => { setShowBulk(false); load(); }}
        />
      )}
    </div>
  );
}
