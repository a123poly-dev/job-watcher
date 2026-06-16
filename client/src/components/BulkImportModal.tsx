import { useState } from 'react';
import { api } from '../lib/api';
import { SEED_COMPANIES, SeedCompany } from '../lib/seedCompanies';

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export default function BulkImportModal({ onClose, onDone }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  const toggle = (i: number) =>
    setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const selectAll = () => setSelected(new Set(SEED_COMPANIES.map((_, i) => i)));
  const selectNone = () => setSelected(new Set());

  const doImport = async () => {
    setImporting(true);
    const toImport = [...selected].map((i) => SEED_COMPANIES[i]);
    let done = 0;
    for (const c of toImport) {
      setProgress(`Adding ${c.name}… (${done + 1}/${toImport.length})`);
      try {
        await api.createSite({
          name: c.name,
          url: c.url,
          renderMode: c.renderMode || 'static',
        });
      } catch { /* skip duplicates */ }
      done++;
    }
    setImporting(false);
    onDone();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Import companies</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} disabled={importing}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Companies will be added with URL pre-filled but <strong>no CSS selectors</strong> — you'll add those per site after inspecting each page. Known JS-rendered sites already have render mode set to "browser".
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn-ghost btn-sm" onClick={selectAll}>Select all ({SEED_COMPANIES.length})</button>
          <button className="btn-ghost btn-sm" onClick={selectNone}>Clear</button>
          <span style={{ fontSize: 13, color: '#64748b', marginLeft: 'auto', alignSelf: 'center' }}>{selected.size} selected</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #e2e8f0', borderRadius: 8 }}>
          {SEED_COMPANIES.map((c, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < SEED_COMPANIES.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', background: selected.has(i) ? '#eff6ff' : 'white' }}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ width: 16, height: 16 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</span>
                {c.notes && <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{c.notes}</span>}
                {c.renderMode === 'browser' && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>Playwright</span>}
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.url}</span>
            </label>
          ))}
        </div>

        {importing && (
          <p style={{ fontSize: 13, color: '#2563eb', marginTop: 12 }}>{progress}</p>
        )}

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
