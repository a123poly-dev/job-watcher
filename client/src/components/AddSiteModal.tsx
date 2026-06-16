import { useState, FormEvent } from 'react';
import { api, Recipient } from '../lib/api';

interface Props {
  recipients: Recipient[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AddSiteModal({ recipients, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: '',
    url: '',
    listSelector: '',
    titleSelector: '',
    linkSelector: '',
  });
  const [preview, setPreview] = useState<{ listings: { title: string; url: string }[]; renderMode: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const runPreview = async () => {
    setPreviewError('');
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await api.previewSite({
        url: form.url,
        listSelector: form.listSelector,
        titleSelector: form.titleSelector,
        linkSelector: form.linkSelector,
      });
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
      await api.createSite({ ...form, renderMode: preview?.renderMode || 'static' });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Add site</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={save}>
          <div className="form-row">
            <label>Company name</label>
            <input value={form.name} onChange={set('name')} required placeholder="e.g. Smartly" />
          </div>
          <div className="form-row">
            <label>Careers page URL</label>
            <input value={form.url} onChange={set('url')} required type="url" placeholder="https://..." />
          </div>
          <div className="form-row">
            <label>List selector <span style={{ fontWeight: 400, color: '#94a3b8' }}>(CSS selector for each job row)</span></label>
            <input value={form.listSelector} onChange={set('listSelector')} required placeholder=".job-listing, li.position" />
          </div>
          <div className="form-row">
            <label>Title selector <span style={{ fontWeight: 400, color: '#94a3b8' }}>(within each row, or "self")</span></label>
            <input value={form.titleSelector} onChange={set('titleSelector')} required placeholder=".job-title, h3, self" />
          </div>
          <div className="form-row">
            <label>Link selector <span style={{ fontWeight: 400, color: '#94a3b8' }}>(within each row, or "self")</span></label>
            <input value={form.linkSelector} onChange={set('linkSelector')} required placeholder="a, self" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <button type="button" className="btn-ghost" onClick={runPreview} disabled={previewing || !form.url || !form.listSelector}>
              {previewing ? '🔍 Fetching…' : '🔍 Preview listings'}
            </button>
            {previewError && <p className="status-error" style={{ marginTop: 8 }}>{previewError}</p>}
          </div>

          {preview && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                Found <strong>{preview.listings.length}</strong> listings using <strong>{preview.renderMode}</strong> mode
                {preview.renderMode === 'browser' && ' (Playwright)'}
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {preview.listings.slice(0, 10).map((l, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#334155' }}>
                    • <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a>
                  </li>
                ))}
                {preview.listings.length > 10 && (
                  <li style={{ fontSize: 13, color: '#94a3b8' }}>…and {preview.listings.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          {error && <p className="status-error" style={{ marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
