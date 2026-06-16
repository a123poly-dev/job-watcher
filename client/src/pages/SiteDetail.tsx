import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Site, Recipient } from '../lib/api';

export default function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', listSelector: '', titleSelector: '', linkSelector: '', renderMode: 'static' });
  const [filterForm, setFilterForm] = useState({ keyword: '', recipientId: '' });
  const [saving, setSaving] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);

  const load = () => {
    api.getSite(parseInt(id!)).then((s) => {
      setSite(s);
      setForm({ name: s.name, url: s.url, listSelector: s.listSelector, titleSelector: s.titleSelector, linkSelector: s.linkSelector, renderMode: s.renderMode });
    });
    api.getRecipients().then(setRecipients);
  };

  useEffect(() => { load(); }, [id]);

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.updateSite(parseInt(id!), form);
    setSaving(false);
    setEditing(false);
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
    if (!confirm('Remove this filter?')) return;
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
          <button className="btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <form onSubmit={saveEdit}>
            {(['name', 'url', 'listSelector', 'titleSelector', 'linkSelector'] as const).map((k) => (
              <div key={k} className="form-row">
                <label>{k}</label>
                <input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} required />
              </div>
            ))}
            <div className="form-row">
              <label>Render mode</label>
              <select value={form.renderMode} onChange={(e) => setForm((f) => ({ ...f, renderMode: e.target.value }))}>
                <option value="static">static</option>
                <option value="browser">browser (Playwright)</option>
              </select>
            </div>
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </form>
        ) : (
          <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><span style={{ color: '#94a3b8' }}>URL:</span> <a href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a></div>
            <div><span style={{ color: '#94a3b8' }}>List selector:</span> <code>{site.listSelector}</code></div>
            <div><span style={{ color: '#94a3b8' }}>Title selector:</span> <code>{site.titleSelector}</code></div>
            <div><span style={{ color: '#94a3b8' }}>Link selector:</span> <code>{site.linkSelector}</code></div>
            <div><span style={{ color: '#94a3b8' }}>Render mode:</span> {site.renderMode}</div>
            <div><span style={{ color: '#94a3b8' }}>Last status:</span> {site.lastStatus || '—'}</div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Filters</h2>

        {site.filters && site.filters.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {site.filters.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ flex: 1, fontSize: 14 }}>
                  <strong>"{f.keyword || 'any'}"</strong> → {f.recipient?.email}
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
            <label>Keyword</label>
            <input
              value={filterForm.keyword}
              onChange={(e) => setFilterForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="e.g. designer (blank = any)"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Send to</label>
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
            {addingFilter ? '…' : 'Add filter'}
          </button>
        </form>

        {recipients.length === 0 && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>No recipients yet — add one in Settings first.</p>
        )}
      </div>
    </div>
  );
}
