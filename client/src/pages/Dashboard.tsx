import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api, Site, Recipient } from '../lib/api';
import AddSiteModal from '../components/AddSiteModal';
import BulkImportModal from '../components/BulkImportModal';
import BulkFilterModal from '../components/BulkFilterModal';
import MathConfirmModal from '../components/MathConfirmModal';

const CHECKLIST_KEY = 'jw_checklist_dismissed_at';

function timeAgo(dateStr?: string) {
  if (!dateStr) return null;
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
  return Date.now() - parseInt(dismissed, 10) > 24 * 60 * 60 * 1000;
}

// ── Stats bar ──────────────────────────────────────────────────────────────────
function StatsBar({ sites }: { sites: Site[] }) {
  const total = sites.length;
  const withFilters = sites.filter((s) => s.filters && s.filters.length > 0).length;
  const errors = sites.filter((s) => s.lastStatus && s.lastStatus.startsWith('error')).length;
  const lastChecked = sites.reduce<string | undefined>((latest, s) => {
    if (!s.lastCheckedAt) return latest;
    if (!latest) return s.lastCheckedAt;
    return s.lastCheckedAt > latest ? s.lastCheckedAt : latest;
  }, undefined);

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {[
        { label: 'Companies tracked', value: total },
        { label: 'With alerts', value: `${withFilters} / ${total}` },
        { label: 'Errors', value: errors, warn: errors > 0 },
        { label: 'Last check', value: timeAgo(lastChecked) ?? 'Never' },
      ].map(({ label, value, warn }) => (
        <div key={label} className="card" style={{ padding: '12px 18px', flex: '1 1 160px', minWidth: 140 }}>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{label}</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: (warn as boolean) ? '#dc2626' : '#1e293b' }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Setup checklist ────────────────────────────────────────────────────────────
interface ChecklistProps {
  hasRecipients: boolean; hasSites: boolean; hasFilters: boolean;
  onDismiss: () => void; onImport: () => void;
}
function SetupChecklist({ hasRecipients, hasSites, hasFilters, onDismiss, onImport }: ChecklistProps) {
  const steps: { done: boolean; label: React.ReactNode; detail: string }[] = [
    { done: hasRecipients, label: <>Add who gets alerts — <Link to="/settings" style={{ fontWeight: 600 }}>Settings</Link></>, detail: 'Name + email for each person.' },
    { done: hasSites, label: <><button onClick={onImport} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}>Import companies</button> from the prepared list</>, detail: '90 Finnish & remote companies, one click.' },
    { done: false, label: <>Click a company → hit <strong>Preview</strong> to confirm the app can read its jobs</>, detail: 'Auto-extracts listings. No technical setup.' },
    { done: hasFilters, label: <>Select companies → <strong>Add filter to selected</strong></>, detail: 'Set a keyword (e.g. "designer") and who gets the alert.' },
  ];
  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #2563eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h2 style={{ fontWeight: 700, fontSize: 15 }}>Getting started</h2>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, padding: '0 0 0 12px' }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: step.done ? 0.5 : 1 }}>
            <span style={{ fontSize: 15, marginTop: 2, flexShrink: 0 }}>{step.done ? '✅' : `${i + 1}.`}</span>
            <div>
              <span style={{ fontSize: 14, fontWeight: 500, textDecoration: step.done ? 'line-through' : 'none' }}>{step.label}</span>
              {!step.done && <p style={{ color: '#64748b', fontSize: 13, marginTop: 1 }}>{step.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ site }: { site: Site }) {
  if (!site.lastStatus) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Not checked</span>;
  if (site.lastStatus.startsWith('ok')) return <span style={{ color: '#16a34a', fontSize: 12 }}>✅ {site.lastStatus.replace('ok: ', '')}</span>;
  if (site.lastStatus === 'no listings') return <span style={{ color: '#64748b', fontSize: 12 }}>— No positions found</span>;
  return <span className="status-error" style={{ fontSize: 12 }} title={site.lastStatus}>⚠️ {site.lastStatus.replace('error: ', '').slice(0, 60)}</span>;
}

// ── Main dashboard ─────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'ok' | 'no_listings' | 'error' | 'unchecked';
type AlertFilter = 'all' | 'with' | 'without';

export default function Dashboard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showChecklist, setShowChecklist] = useState(isChecklistVisible());
  const [checking, setChecking] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkFilter, setShowBulkFilter] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null); // single delete
  const [deleteBulk, setDeleteBulk] = useState(false);

  // Search & filter
  const [search, setSearch] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');

  const load = () => {
    api.getSites().then(setSites);
    api.getRecipients().then(setRecipients);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => sites.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (keywordSearch) {
      const kw = keywordSearch.toLowerCase();
      const hasMatch = s.filters?.some((f) => f.keyword.toLowerCase().includes(kw));
      if (!hasMatch) return false;
    }
    if (statusFilter === 'ok' && !s.lastStatus?.startsWith('ok')) return false;
    if (statusFilter === 'no_listings' && s.lastStatus !== 'no listings') return false;
    if (statusFilter === 'error' && !s.lastStatus?.startsWith('error')) return false;
    if (statusFilter === 'unchecked' && s.lastStatus) return false;
    if (alertFilter === 'with' && (!s.filters || s.filters.length === 0)) return false;
    if (alertFilter === 'without' && s.filters && s.filters.length > 0) return false;
    return true;
  }), [sites, search, keywordSearch, statusFilter, alertFilter]);

  const toggleSelect = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearAll = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(filtered.map((s) => s.id)));

  const triggerCheck = async (id: number) => {
    setChecking(id);
    await api.checkSiteNow(id);
    setTimeout(() => { load(); setChecking(null); }, 2500);
  };

  const doDelete = async (id: number) => {
    await api.deleteSite(id);
    setDeleteTarget(null);
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    load();
  };

  const doBulkDelete = async () => {
    for (const id of selected) await api.deleteSite(id);
    setDeleteBulk(false);
    clearAll();
    load();
  };

  const hasFilters = sites.some((s) => s.filters && s.filters.length > 0);
  const selectedSites = sites.filter((s) => selected.has(s.id));
  const allSelectedOnPage = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Tracked companies</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setShowBulk(true)}>📋 Import companies</button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add company</button>
        </div>
      </div>

      {/* Stats */}
      {sites.length > 0 && <StatsBar sites={sites} />}

      {/* Checklist */}
      {showChecklist && (
        <SetupChecklist
          hasRecipients={recipients.length > 0} hasSites={sites.length > 0} hasFilters={hasFilters}
          onDismiss={() => { localStorage.setItem(CHECKLIST_KEY, String(Date.now())); setShowChecklist(false); }}
          onImport={() => setShowBulk(true)}
        />
      )}
      {!showChecklist && (
        <button onClick={() => setShowChecklist(true)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
          Show setup guide
        </button>
      )}

      {/* Search + filters */}
      {sites.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', marginTop: 60 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name…"
            style={{ maxWidth: 220, flex: '1 1 160px' }}
          />
          <input
            value={keywordSearch}
            onChange={(e) => setKeywordSearch(e.target.value)}
            placeholder="Filter by keyword (e.g. designer)…"
            style={{ maxWidth: 240, flex: '1 1 180px' }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={{ width: 'auto', flex: '0 0 auto' }}>
            <option value="all">All statuses</option>
            <option value="ok">✅ Positions found</option>
            <option value="no_listings">— No positions found</option>
            <option value="error">⚠️ Error</option>
            <option value="unchecked">Not checked yet</option>
          </select>
          <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value as AlertFilter)} style={{ width: 'auto', flex: '0 0 auto' }}>
            <option value="all">All companies</option>
            <option value="with">With alerts</option>
            <option value="without">Without alerts</option>
          </select>
          {(search || keywordSearch || statusFilter !== 'all' || alertFilter !== 'all') && (
            <button className="btn-ghost btn-sm" onClick={() => { setSearch(''); setKeywordSearch(''); setStatusFilter('all'); setAlertFilter('all'); }}>Clear</button>
          )}
        </div>
      )}

      {/* Selection toolbar */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, color: '#64748b', minHeight: 32 }}>
          <input
            type="checkbox"
            checked={allSelectedOnPage}
            ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelectedOnPage; }}
            onChange={() => allSelectedOnPage ? clearAll() : selectAll()}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span>{selected.size > 0 ? `${selected.size} selected` : 'Select all'}</span>
          {selected.size > 0 && (
            <>
              <button className="btn-primary btn-sm" onClick={() => setShowBulkFilter(true)}>+ Add filter to selected</button>
              <button className="btn-danger btn-sm" onClick={() => setDeleteBulk(true)}>Delete selected</button>
              <button className="btn-ghost btn-sm" onClick={clearAll}>Clear</button>
            </>
          )}
        </div>
      )}

      {/* Company list */}
      {sites.length === 0 ? (
        <div className="empty-state">No companies yet — import the list or add one manually.</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No companies match your search.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((site) => (
            <div
              key={site.id}
              className="card company-card"
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                borderColor: selected.has(site.id) ? '#93c5fd' : undefined,
                background: selected.has(site.id) ? '#eff6ff' : undefined,
                padding: '14px 16px',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(site.id)}
                onChange={() => toggleSelect(site.id)}
                style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Link to={`/sites/${site.id}`} style={{ fontWeight: 600, fontSize: 15 }}>{site.name}</Link>
                  <span style={{ fontSize: 11, background: site.renderMode === 'browser' ? '#fef3c7' : '#f1f5f9', color: site.renderMode === 'browser' ? '#92400e' : '#64748b', borderRadius: 4, padding: '1px 6px' }}>
                    {site.renderMode}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <a href={site.url} target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8' }}>{site.url}</a>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
                  {site.filters?.map((f) => (
                    <span key={f.id} className={`tag${f.isActive ? '' : ' paused'}`}>
                      {f.keyword || '(any)'} → {f.recipient?.label}
                      {!f.isActive && ' ⏸'}
                    </span>
                  ))}
                  {(!site.filters || site.filters.length === 0) && (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>No alerts — <Link to={`/sites/${site.id}`} style={{ fontSize: 12 }}>add one</Link></span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{timeAgo(site.lastCheckedAt) ? `Checked ${timeAgo(site.lastCheckedAt)}` : 'Not checked yet'}</span>
                  <StatusBadge site={site} />
                </div>
              </div>

              {/* Hover-reveal actions */}
              <div className="card-actions" style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                <button
                  className="btn-icon"
                  title="Check now"
                  onClick={() => triggerCheck(site.id)}
                  disabled={checking === site.id}
                >
                  {checking === site.id ? '…' : '▶ Check'}
                </button>
                <button className="btn-icon danger" title="Delete" onClick={() => setDeleteTarget(site)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddSiteModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {showBulk && <BulkImportModal onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); load(); }} />}
      {showBulkFilter && <BulkFilterModal sites={selectedSites} recipients={recipients} onClose={() => setShowBulkFilter(false)} onDone={() => { setShowBulkFilter(false); clearAll(); load(); }} />}

      {deleteTarget && (
        <MathConfirmModal
          title={`Delete "${deleteTarget.name}"?`}
          description="This will remove the company and all its alerts. This can't be undone."
          confirmLabel="Delete company"
          onConfirm={() => doDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {deleteBulk && (
        <MathConfirmModal
          title={`Delete ${selected.size} companies?`}
          description={`This will remove ${selectedSites.map((s) => s.name).join(', ')} and all their alerts.`}
          confirmLabel={`Delete ${selected.size} companies`}
          onConfirm={doBulkDelete}
          onCancel={() => setDeleteBulk(false)}
        />
      )}
    </div>
  );
}
