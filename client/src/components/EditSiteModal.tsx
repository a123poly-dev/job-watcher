import { useState, FormEvent } from 'react';
import { api, Site } from '../lib/api';

interface Props {
  site: Site;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditSiteModal({ site, onClose, onSaved }: Props) {
  const [name, setName] = useState(site.name);
  const [url, setUrl] = useState(site.url);
  const [preview, setPreview] = useState<{ listings: { title: string; url: string }[]; renderMode: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);

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
    await api.updateSite(site.id, { name, url, renderMode: preview?.renderMode || site.renderMode });
    setSaving(false);
    onSaved();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Edit {site.name}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={save}>
          <div className="form-row">
            <label>Company name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Careers page URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} required type="url" />
          </div>

          {previewError && <p className="status-error" style={{ marginBottom: 10 }}>{previewError}</p>}
          {preview && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 }}>
              ✅ Found <strong>{preview.listings.length}</strong> listings
              {preview.listings.slice(0, 4).map((l, i) => (
                <div key={i} style={{ color: '#334155', marginTop: 4 }}>• {l.title}</div>
              ))}
              {preview.listings.length > 4 && <div style={{ color: '#94a3b8', marginTop: 2 }}>…and {preview.listings.length - 4} more</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost btn-sm" onClick={runPreview} disabled={previewing || !url}>
              {previewing ? '🔍 Scanning…' : '🔍 Preview'}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
