import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Site, Recipient } from '../lib/api';
import AddSiteModal from '../components/AddSiteModal';
import BulkImportModal from '../components/BulkImportModal';
import BulkFilterModal from '../components/BulkFilterModal';

const CHECKLIST_KEY = 'jw_checklist_dismissed_at';

function statusBadge(site: Site) {
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

  const steps: { done: boolean; label: React.ReactNode; detail: string }[] = [
    {
      done: hasRecipients,
      label: <>Add who gets the alerts — go to <Link to="/settings" style={{ fontWeight: 600 }}>Settings</Link> and add email addresses</>,
      detail: 'Just a name and email for each person. You can add multiple.',
    },
    {
      done: hasSites,
      label: <><button onClick={onImport} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, color: '#2563eb', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>Import companies</button> from the prepared list of 90</>,
      detail: 'Finnish & remote companies are ready to add in one click. Pick the ones you care about.',
    },
    {
      done: false,
      label: <>Click any company and hit <strong>Preview</strong> to confirm the app can read its jobs</>,
      detail: 'The app uses AI to find job listings automatically — no technical setup needed. Preview shows you exactly what it sees.',
    },
    {
      done: hasFilters,
      label: <>Set up <strong>alerts</strong> — select companies below and use "Add filter to selected"</>,
      detail: 'Pick a keyword (e.g. "designer") and who should get the email. Blank keyword = alert on any new job.',
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #2563eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16 }}>
          {allDone ? '🎉 All set up — job alerts are running!' : 'Getting started'}
        </h2>
        <button
          onClick={onDismiss}
          title="Dismiss"
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 0 0 12px' }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, marginTop: 2, flexShrink: 0, opacity: step.done ? 0.5 : 1 }}>
              {step.done ? '✅' : `${i + 1}.`}
            </span>
            <div style={{ opacity: step.done ? 0.55 : 1 }}>
              <span style={{ fontSize: 14, fontWeight: 500, textDecoration: step.done ? 'line-through' : 'none' }}>
                {step.label}
              </span>
              {!step.done && (
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{step.detail}</p>
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkFilter, setShowBulkFilter] = useState(false);

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
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    load();
  };

  const toggleSelect = (id: number) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAll = () => setSelected(new Set(sites.map((s) => s.id)));
  const clearAll = () => setSelected(new Set());

  const hasFilters = sites.some((s) => s.filters && s.filters.length > 0);
  const selectedSites = sites.filter((s) => selected.has(s.id));

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
        <>
          {/* Selection toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, color: '#64748b' }}>
            <input
              type="checkbox"
              checked={selected.size === sites.length && sites.length > 0}
              ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < sites.length; }}
              onChange={() => selected.size === sites.length ? clearAll() : selectAll()}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span>
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </span>
            {selected.size > 0 && (
              <>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setShowBulkFilter(true)}
                  style={{ marginLeft: 4 }}
                >
                  + Add filter to selected
                </button>
                <button className="btn-ghost btn-sm" onClick={clearAll}>Clear</button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sites.map((site) => (
              <div
                key={site.id}
                className="card"
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderColor: selected.has(site.id) ? '#93c5fd' : undefined, background: selected.has(site.id) ? '#eff6ff' : undefined }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(site.id)}
                  onChange={() => toggleSelect(site.id)}
                  style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Link to={`/sites/${site.id}`} style={{ fontWeight: 600, fontSize: 15 }}>{site.name}</Link>
                    <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '2px 6px' }}>
                      {site.renderMode}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                    <a href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
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
                      {checking === site.id ? '…' : '▶'}
                    </button>
                  )}
                  <Link to={`/sites/${site.id}`}>
                    <button className="btn-ghost btn-sm">Edit</button>
                  </Link>
                  <button className="btn-danger btn-sm" onClick={() => deleteSite(site.id, site.name)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showAdd && (
        <AddSiteModal
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
      {showBulkFilter && (
        <BulkFilterModal
          sites={selectedSites}
          recipients={recipients}
          onClose={() => setShowBulkFilter(false)}
          onDone={() => { setShowBulkFilter(false); clearAll(); load(); }}
        />
      )}
    </div>
  );
}
