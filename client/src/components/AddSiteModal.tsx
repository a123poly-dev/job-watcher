import { useState, FormEvent } from 'react';
import { api } from '../lib/api';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function AddSiteModal({ onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<{ listings: { title: string; url: string }[]; renderMode: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      await api.createSite({ name, url, renderMode: preview?.renderMode || 'static' });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add company</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={save}>
          <div className="form-row">
            <label>Company name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Smartly" autoFocus />
          </div>
          <div className="form-row">
            <label>Careers page URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} required type="url" placeholder="https://..." />
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={runPreview}
              disabled={previewing || !url}
            >
              {previewing ? '🔍 Scanning page…' : '🔍 Preview — check what jobs the app sees'}
            </button>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
              Fetches the page and automatically extracts all job listings.
            </p>
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
                  <li key={i} style={{ fontSize: 13, color: '#334155' }}>
                    • <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a>
                  </li>
                ))}
                {preview.listings.length > 8 && (
                  <li style={{ fontSize: 13, color: '#94a3b8' }}>…and {preview.listings.length - 8} more</li>
                )}
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
