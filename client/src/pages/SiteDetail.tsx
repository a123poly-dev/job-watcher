import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Site, Recipient } from '../lib/api';

export default function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<{ listings: { title: string; url: string }[]; renderMode: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [filterForm, setFilterForm] = useState({ keyword: '', recipientId: '' });
  const [saving, setSaving] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);

  const load = () => {
    api.getSite(parseInt(id!)).then((s) => {
      setSite(s);
      setName(s.name);
      setUrl(s.url);
    });
    api.getRecipients().then(setRecipients);
  };

  useEffect(() => { load(); }, [id]);

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

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.updateSite(parseInt(id!), { name, url, renderMode: preview?.renderMode });
    setSaving(false);
    setEditing(false);
    setPreview(null);
    load();
  };

  const addFilter = async (e: FormEvent) => {
    e.preventDefault();
    setAddingFilter(true);
    await api.createFilter({ siteId: parseInt(id!), keyword: filterForm.keyword, recipientId: parseInt(filterForm.recipientId) });
    setFilterForm({ keyword: '', recipientId: '' });
    setAddingFilter(false);
    load();
  };

  const toggleFilter = async (filterId: number, isActive: boolean) => {
    await api.updateFilter(filterId, { isActive: !isActive });
    load();
  };

  const deleteFilter = async (filterId: number) => {
    if (!confirm('Remove this alert?')) return;
    await api.deleteFilter(filterId);
    load();
  };

  if (!site) return <div className="page" style={{ color: '#94a3b8' }}>Loading…</div>;

  return (
    <div className="page">
      <button className="btn-ghost btn-sm" onClick={() => nav('/')} style={{ marginBottom: 16 }}>← Back</button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{site.name}</h1>
          <button className="btn-ghost btn-sm" onClick={() => { setEditing(!editing); setPreview(null); }}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <form onSubmit={saveEdit}>
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
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#166534', marginBottom: 6 }}>
                  ✅ Found <strong>{preview.listings.length}</strong> job listings
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {preview.listings.slice(0, 6).map((l, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#334155' }}>
                      • <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn-ghost btn-sm" onClick={runPreview} disabled={previewing || !url}>
                {previewing ? '🔍 Scanning…' : '🔍 Preview jobs'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <span style={{ color: '#94a3b8' }}>URL: </span>
              <a href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a>
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Fetch mode: </span>
              {site.renderMode === 'browser' ? 'Browser / Playwright (JavaScript-rendered)' : 'Static'}
            </div>
            <div>
              <span style={{ color: '#94a3b8' }}>Last status: </span>
              {site.lastStatus || '—'}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Alerts</h2>

        {site.filters && site.filters.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {site.filters.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ flex: 1, fontSize: 14 }}>
                  Alert on <strong>{f.keyword ? `"${f.keyword}"` : 'any new listing'}</strong> → {f.recipient?.label} ({f.recipient?.email})
                  {!f.isActive && <span style={{ color: '#94a3b8', marginLeft: 8 }}>(paused)</span>}
                </span>
                <button className="btn-ghost btn-sm" onClick={() => toggleFilter(f.id, f.isActive)}>
                  {f.isActive ? 'Pause' : 'Resume'}
                </button>
                <button className="btn-danger btn-sm" onClick={() => deleteFilter(f.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addFilter} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Keyword to watch for</label>
            <input
              value={filterForm.keyword}
              onChange={(e) => setFilterForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="e.g. designer — blank = any new listing"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Send alert to</label>
            <select
              value={filterForm.recipientId}
              onChange={(e) => setFilterForm((f) => ({ ...f, recipientId: e.target.value }))}
              required
            >
              <option value="">Pick recipient…</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>{r.label} ({r.email})</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={addingFilter || !filterForm.recipientId}>
            {addingFilter ? '…' : 'Add alert'}
          </button>
        </form>

        {recipients.length === 0 && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>No recipients yet — add one in Settings first.</p>
        )}
      </div>
    </div>
  );
}
