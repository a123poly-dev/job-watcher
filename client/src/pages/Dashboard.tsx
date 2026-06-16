import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Site, Recipient } from '../lib/api';
import AddSiteModal from '../components/AddSiteModal';

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

export default function Dashboard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [checking, setChecking] = useState<number | null>(null);

  const load = () => {
    api.getSites().then(setSites);
    api.getRecipients().then(setRecipients);
  };

  useEffect(() => { load(); }, []);

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

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Tracked companies</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add site</button>
      </div>

      {sites.length === 0 ? (
        <div className="empty-state">No sites yet. Add your first one!</div>
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
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>No filters yet</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 16 }}>
                  <span>Checked: {timeAgo(site.lastCheckedAt)}</span>
                  {statusBadge(site)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => triggerCheck(site.id)}
                  disabled={checking === site.id}
                >
                  {checking === site.id ? '…' : '▶ Check'}
                </button>
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
    </div>
  );
}
