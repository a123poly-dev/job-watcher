import { useState, FormEvent } from 'react';
import { api, Recipient, Site } from '../lib/api';

interface Props {
  sites: Site[];
  recipients: Recipient[];
  onClose: () => void;
  onDone: () => void;
}

export default function BulkFilterModal({ sites, recipients, onClose, onDone }: Props) {
  const [keyword, setKeyword] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipientId) return;
    setSaving(true);
    let done = 0;
    for (const site of sites) {
      setProgress(`Adding filter to ${site.name}… (${done + 1}/${sites.length})`);
      try {
        await api.createFilter({ siteId: site.id, keyword, recipientId: parseInt(recipientId) });
      } catch { /* skip if duplicate */ }
      done++;
    }
    setSaving(false);
    onDone();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add filter to {sites.length} companies</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} disabled={saving}>✕</button>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 16, maxHeight: 140, overflowY: 'auto' }}>
          {sites.map((s) => (
            <div key={s.id} style={{ fontSize: 13, color: '#334155', padding: '2px 0' }}>• {s.name}</div>
          ))}
        </div>

        <form onSubmit={save}>
          <div className="form-row">
            <label>Keyword to watch for</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder='e.g. designer — leave blank to get alerted on any new listing'
            />
          </div>
          <div className="form-row">
            <label>Send alerts to</label>
            <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)} required>
              <option value="">Pick recipient…</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>{r.label} ({r.email})</option>
              ))}
            </select>
          </div>

          {saving && <p style={{ fontSize: 13, color: '#2563eb', marginBottom: 10 }}>{progress}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !recipientId}>
              {saving ? 'Adding…' : `Add filter to ${sites.length} companies`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
