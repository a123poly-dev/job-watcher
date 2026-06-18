import { useState } from 'react';
import { api, Site } from '../lib/api';
import { SEED_COMPANIES } from '../lib/seedCompanies';

interface Props {
  existingSites: Site[];
  onClose: () => void;
  onDone: () => void;
}

export default function BulkImportModal({ existingSites, onClose, onDone }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [search, setSearch] = useState('');
  const [showAdded, setShowAdded] = useState(false);

  const existingUrls = new Set(existingSites.map((s) => s.url));
  const existingNames = new Set(existingSites.map((s) => s.name.toLowerCase()));

  const isAdded = (i: number) => {
    const c = SEED_COMPANIES[i];
    return existingUrls.has(c.url) || existingNames.has(c.name.toLowerCase());
  };

  const filtered = SEED_COMPANIES.map((c, i) => ({ ...c, index: i })).filter((c) => {
    if (!showAdded && isAdded(c.index)) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.url.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggle = (i: number) =>
    setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const selectAll = () => setSelected(new Set(filtered.map((c) => c.index)));
  const selectNone = () => setSelected(new Set());

  const doImport = async () => {
    setImporting(true);
    const toImport = [...selected].map((i) => SEED_COMPANIES[i]);
    let done = 0;
    for (const c of toImport) {
      setProgress(`Adding ${c.name}… (${done + 1}/${toImport.length})`);
      try {
        await api.createSite({ name: c.name, url: c.url, renderMode: c.renderMode || 'static' });
      } catch { /* skip duplicates */ }
      done++;
    }
    setImporting(false);
    onDone();
  };

  const addedCount = SEED_COMPANIES.filter((_, i) => isAdded(i)).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Import companies</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} disabled={importing}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            style={{ flex: 1 }}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button className="btn-ghost btn-sm" onClick={selectAll}>Select all ({filtered.length})</button>
          <button className="btn-ghost btn-sm" onClick={selectNone}>Clear</button>
          {addedCount > 0 && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => setShowAdded((v) => !v)}
              style={{ color: '#94a3b8' }}
            >
              {showAdded ? `Hide ${addedCount} already added` : `Show ${addedCount} already added`}
            </button>
          )}
          <span style={{ fontSize: 13, color: '#64748b', marginLeft: 'auto' }}>{selected.size} selected</span>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #e2e8f0', borderRadius: 8 }}>
          {filtered.length === 0 && (
            <p style={{ padding: 20, color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
              {search ? 'No companies match your search.' : 'All companies are already added.'}
            </p>
          )}
          {filtered.map((c) => (
            <label key={c.index} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selected.has(c.index) ? '#eff6ff' : isAdded(c.index) ? '#f8fafc' : 'white' }}>
              <input type="checkbox" checked={selected.has(c.index)} onChange={() => toggle(c.index)} style={{ width: 16, height: 16 }} disabled={isAdded(c.index)} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500, fontSize: 14, color: isAdded(c.index) ? '#94a3b8' : undefined }}>{c.name}</span>
                {isAdded(c.index) && <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>Already added</span>}
                {c.notes && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{c.notes}</span>}
                {c.renderMode === 'browser' && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>Playwright</span>}
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.url}</span>
            </label>
          ))}
        </div>

        {importing && <p style={{ fontSize: 13, color: '#2563eb', marginTop: 12 }}>{progress}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn-ghost" onClick={onClose} disabled={importing}>Cancel</button>
          <button className="btn-primary" onClick={doImport} disabled={importing || selected.size === 0}>
            {importing ? 'Importing…' : `Import ${selected.size} companies`}
          </button>
        </div>
      </div>
    </div>
  );
}
