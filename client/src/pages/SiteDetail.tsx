import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Site, Recipient, SeenListing } from '../lib/api';
import MathConfirmModal from '../components/MathConfirmModal';

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
  const [filterError, setFilterError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [listings, setListings] = useState<SeenListing[]>([]);
  const [checking, setChecking] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Set<number>>(new Set());
  const [deletingFilters, setDeletingFilters] = useState(false);

  const load = () => {
    api.getSite(parseInt(id!)).then((s) => {
      setSite(s);
      setName(s.name);
      setUrl(s.url);
    });
    api.getRecipients().then(setRecipients);
    api.getSiteListings(parseInt(id!)).then(setListings);
  };

  useEffect(() => { load(); }, [id]);

  const checkNow = async () => {
    setChecking(true);
    await api.checkSiteNow(parseInt(id!));
    setTimeout(() => { load(); setChecking(false); }, 2500);
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
    setFilterError('');
    setAddingFilter(true);
    try {
      await api.createFilter({ siteId: parseInt(id!), keyword: filterForm.keyword, recipientId: parseInt(filterForm.recipientId) });
      setFilterForm({ keyword: '', recipientId: '' });
      load();
    } catch (err: any) {
      setFilterError(err.message);
    } finally {
      setAddingFilter(false);
    }
  };

  const toggleFilter = async (filterId: number, isActive: boolean) => {
    await api.updateFilter(filterId, { isActive: !isActive });
    load();
  };

  const deleteFilter = async (filterId: number) => {
    await api.deleteFilter(filterId);
    setSelectedFilters((s) => { const n = new Set(s); n.delete(filterId); return n; });
    load();
  };

  const deleteSelectedFilters = async () => {
    setDeletingFilters(true);
    for (const fid of selectedFilters) await api.deleteFilter(fid);
    setSelectedFilters(new Set());
    setDeletingFilters(false);
    load();
  };

  const toggleFilterSelect = (id: number) =>
    setSelectedFilters((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doDelete = async () => {
    await api.deleteSite(parseInt(id!));
    nav('/');
  };

  if (!site) return <div className="page" style={{ color: '#94a3b8' }}>Loading…</div>;

  const newListings = listings.filter((l) => !l.isBaseline);
  const baselineListings = listings.filter((l) => l.isBaseline);

  return (
    <div className="page">
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn-ghost btn-sm" onClick={() => nav('/')}>← Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost btn-sm" onClick={checkNow} disabled={checking}>
            {checking ? '⏳ Checking…' : '▶ Check now'}
          </button>
          <button className="btn-danger btn-sm" onClick={() => setShowDelete(true)}>Delete company</button>
        </div>
      </div>

      {/* Site info */}
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
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 }}>
                ✅ Found <strong>{preview.listings.length}</strong> listings
                {preview.listings.slice(0, 4).map((l, i) => <div key={i} style={{ color: '#334155', marginTop: 4 }}>• {l.title}</div>)}
                {preview.listings.length > 4 && <div style={{ color: '#94a3b8', marginTop: 2 }}>…and {preview.listings.length - 4} more</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn-ghost btn-sm" onClick={runPreview} disabled={previewing || !url}>
                {previewing ? '🔍 Scanning…' : '🔍 Preview'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><span style={{ color: '#94a3b8' }}>URL: </span><a href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a></div>
            <div><span style={{ color: '#94a3b8' }}>Fetch mode: </span>{site.renderMode === 'browser' ? 'Browser / Playwright' : 'Static'}</div>
            <div><span style={{ color: '#94a3b8' }}>Last status: </span>{site.lastStatus || '—'}</div>
          </div>
        )}
      </div>

      {/* Alerts / filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16 }}>Alerts</h2>
          {selectedFilters.size > 0 && (
            <button className="btn-danger btn-sm" onClick={deleteSelectedFilters} disabled={deletingFilters}>
              {deletingFilters ? 'Deleting…' : `Delete ${selectedFilters.size} selected`}
            </button>
          )}
        </div>

        {site.filters && site.filters.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
            {site.filters.map((f, i) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: i < (site.filters?.length ?? 0) - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <input
                  type="checkbox"
                  checked={selectedFilters.has(f.id)}
                  onChange={() => toggleFilterSelect(f.id)}
                  style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 14 }}>
                  <strong>{f.keyword ? `"${f.keyword}"` : 'Any new listing'}</strong>
                  <span style={{ color: '#64748b' }}> → {f.recipient?.label} ({f.recipient?.email})</span>
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

        <form onSubmit={addFilter} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label>Keyword</label>
            <input
              value={filterForm.keyword}
              onChange={(e) => { setFilterForm((f) => ({ ...f, keyword: e.target.value })); setFilterError(''); }}
              placeholder="e.g. designer — blank = any new listing"
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Send alert to</label>
            <select value={filterForm.recipientId} onChange={(e) => setFilterForm((f) => ({ ...f, recipientId: e.target.value }))} required>
              <option value="">Pick recipient…</option>
              {recipients.map((r) => <option key={r.id} value={r.id}>{r.label} ({r.email})</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={addingFilter || !filterForm.recipientId}>
            {addingFilter ? '…' : 'Add alert'}
          </button>
        </form>
        {filterError && <p className="status-error" style={{ marginTop: 8, fontSize: 13 }}>⚠️ {filterError}</p>}
        {recipients.length === 0 && <p style={{ marginTop: 10, fontSize: 13, color: '#94a3b8' }}>No recipients yet — add one in Settings first.</p>}
      </div>

      {/* Found positions */}
      <div className="card">
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Found positions</h2>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
          "First seen" = when this app detected the listing. Positions marked as baseline existed before you started tracking this company.
        </p>

        {listings.length === 0 ? (
          <p style={{ fontSize: 14, color: '#94a3b8' }}>No listings detected yet — run a check first.</p>
        ) : (
          <>
            {newListings.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🆕 New since tracking started ({newListings.length})
                </p>
                {newListings.map((l, i) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>{l.title}</a>
                    <span style={{ fontSize: 12, color: '#16a34a', flexShrink: 0 }}>
                      Appeared {new Date(l.firstSeenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
                {baselineListings.length > 0 && <div style={{ margin: '16px 0 10px' }} />}
              </>
            )}

            {baselineListings.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Existed when added ({baselineListings.length})
                </p>
                {baselineListings.map((l) => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, flex: 1, color: '#64748b' }}>{l.title}</a>
                    <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                      {new Date(l.firstSeenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {showDelete && site && (
        <MathConfirmModal
          title={`Delete "${site.name}"?`}
          description="This will remove the company and all its alerts. Can't be undone."
          confirmLabel="Delete company"
          onConfirm={doDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
