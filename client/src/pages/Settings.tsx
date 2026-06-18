import { useState, useEffect, FormEvent } from 'react';
import { api, Recipient, Site } from '../lib/api';

export default function Settings() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState({ label: '', email: '' });
  const [adding, setAdding] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const load = () => {
    api.getRecipients().then(setRecipients);
    api.getSites().then(setSites);
  };
  useEffect(() => { load(); }, []);

  const addRecipient = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createRecipient(form);
      setForm({ label: '', email: '' });
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const deleteRecipient = async (id: number) => {
    await api.deleteRecipient(id);
    setConfirmDelete(null);
    load();
  };

  const sendTest = async () => {
    setTesting(true);
    setTestStatus('');
    try {
      await api.sendTestEmail(testEmail);
      setTestStatus('✅ Test email sent!');
    } catch (err: any) {
      setTestStatus(`❌ Failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recipients</h2>

        {recipients.length > 0 && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recipients.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{r.label}</span>
                  <span style={{ color: '#64748b', marginLeft: 8, fontSize: 14 }}>{r.email}</span>
                </div>
                <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(r.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {confirmDelete !== null && (() => {
          const r = recipients.find((r) => r.id === confirmDelete)!;
          const affectedFilters = sites.flatMap((s) =>
            (s.filters ?? []).filter((f) => f.recipientId === confirmDelete && !f.archivedAt)
              .map((f) => ({ site: s.name, keyword: f.keyword || '(any new listing)' }))
          );
          return (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Remove {r.label} ({r.email})?</p>
              {affectedFilters.length > 0 ? (
                <>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>This will also delete {affectedFilters.length} alert{affectedFilters.length > 1 ? 's' : ''}:</p>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
                    {affectedFilters.map((f, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#64748b' }}>• <strong>{f.site}</strong> — keyword: <em>{f.keyword}</em></li>
                    ))}
                  </ul>
                </>
              ) : (
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>No alerts are set up for this recipient.</p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-danger btn-sm" onClick={() => deleteRecipient(confirmDelete)}>Yes, remove</button>
                <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            </div>
          );
        })()}

        <form onSubmit={addRecipient} style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Label</label>
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required placeholder="e.g. Me" />
          </div>
          <div style={{ flex: 2 }}>
            <label>Email</label>
            <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required type="email" placeholder="you@example.com" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={adding}>{adding ? '…' : 'Add'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Test email</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Send a test email to confirm your SMTP settings are working.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Send test to…"
            style={{ maxWidth: 280 }}
          />
          <button className="btn-primary" onClick={sendTest} disabled={testing || !testEmail}>
            {testing ? 'Sending…' : 'Send test email'}
          </button>
        </div>
        {testStatus && <p style={{ marginTop: 10, fontSize: 14 }}>{testStatus}</p>}
      </div>
    </div>
  );
}
