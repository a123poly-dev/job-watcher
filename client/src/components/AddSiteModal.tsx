import { useState, useEffect, FormEvent } from 'react';
import { api, Site, Recipient } from '../lib/api';

interface Props {
  existingSites: Site[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AddSiteModal({ existingSites, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<{ listings: { title: string; url: string }[]; renderMode: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedSiteId, setSavedSiteId] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [filters, setFilters] = useState<{ keyword: string; recipientId: string }[]>([{ keyword: '', recipientId: '' }]);
  const [duplicate, setDuplicate] = useState<Site | null>(null);

  useEffect(() => { api.getRecipients().then(setRecipients); }, []);

  const checkDuplicate = (newUrl: string, newName: string) => {
    const byUrl = existingSites.find((s) => s.url === newUrl);
    const byName = existingSites.find((s) => s.name.toLowerCase() === newName.toLowerCase());
    setDuplicate(byUrl || byName || null);
  };

  const runPreview = async () => {
    setPreviewError('');
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await api.previewSite({ url });
      setPreview(result);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const site = await api.createSite({ name, url, renderMode: preview?.renderMode || 'static' });
      setSavedSiteId(site.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveFilters = async () => {
    const toAdd = filters.filter((f) => f.recipientId);
    for (const f of toAdd) {
      try {
        await api.createFilter({ siteId: savedSiteId!, keyword: f.keyword, recipientId: parseInt(f.recipientId) });
      } catch { /* skip duplicates */ }
    }
    onSaved();
  };

  const addFilterRow = () => setFilters((f) => [...f, { keyword: '', recipientId: '' }]);
  const removeFilterRow = (i: number) => setFilters((f) => f.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, field: 'keyword' | 'recipientId', value: string) =>
    setFilters((f) => f.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  // Step 2: filters after site saved
  if (savedSiteId !== null) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 540 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add alerts for {name}</h2>
            <button className="btn-ghost btn-sm" onClick={onSaved}>✕</button>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Optional — set up keyword alerts now, or skip and add them later from the company page.</p>

          {filters.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                {i === 0 && <label>Keyword</label>}
                <input value={f.keyword} onChange={(e) => updateFilter(i, 'keyword', e.target.value)} placeholder='e.g. designer — blank = any new listing' />
              </div>
              <div style={{ flex: 1 }}>
                {i === 0 && <label>Send alert to</label>}
                <select value={f.recipientId} onChange={(e) => updateFilter(i, 'recipientId', e.target.value)}>
                  <option value="">Pick recipient…</option>
                  {recipients.map((r) => <option key={r.id} value={r.id}>{r.label} ({r.email})</option>)}
                </select>
              </div>
              {filters.length > 1 && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => removeFilterRow(i)} style={{ marginBottom: 1 }}>✕</button>
              )}
            </div>
          ))}

          <button type="button" className="btn-ghost btn-sm" onClick={addFilterRow} style={{ marginBottom: 20 }}>+ Add another alert</button>

          {recipients.length === 0 && (
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>No recipients yet — add one in Settings first.</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onSaved}>Skip for now</button>
            <button type="button" className="btn-primary" onClick={saveFilters} disabled={!filters.some((f) => f.recipientId)}>
              Save alerts
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add company</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {duplicate && (
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
            ⚠️ <strong>{duplicate.name}</strong> is already on your dashboard.<br />
            <span style={{ color: '#64748b' }}>URL: {duplicate.url}</span><br />
            <span style={{ color: '#64748b' }}>Status: {duplicate.lastStatus || 'Not checked yet'}</span>
          </div>
        )}

        <form onSubmit={save}>
          <div className="form-row">
            <label>Company name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); checkDuplicate(url, e.target.value); }}
              required
              placeholder="e.g. Smartly"
              autoFocus
            />
          </div>
          <div className="form-row">
            <label>Careers page URL</label>
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); checkDuplicate(e.target.value, name); }}
              required
              type="url"
              placeholder="https://..."
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <button type="button" className="btn-ghost" onClick={runPreview} disabled={previewing || !url}>
              {previewing ? '🔍 Scanning page…' : '🔍 Preview — check what jobs the app sees'}
            </button>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Fetches the page and automatically extracts all job listings.</p>
            {previewError && <p className="status-error" style={{ marginTop: 8 }}>{previewError}</p>}
          </div>

          {preview && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#166534', marginBottom: 8 }}>
                ✅ Found <strong>{preview.listings.length}</strong> job listings
                {preview.renderMode === 'browser' && ' (JavaScript-rendered site)'}
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {preview.listings.slice(0, 8).map((l, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#334155' }}>• <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a></li>
                ))}
                {preview.listings.length > 8 && <li style={{ fontSize: 13, color: '#94a3b8' }}>…and {preview.listings.length - 8} more</li>}
              </ul>
            </div>
          )}

          {error && <p className="status-error" style={{ marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
