import { useState, useEffect } from 'react';
import { api, ActivityLogEntry } from '../lib/api';

const icons: Record<string, string> = {
  site_added: '➕',
  site_removed: '🗑️',
  filter_added: '🔍',
  filter_removed: '🗑️',
  filter_edited: '✏️',
};

export default function History() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);

  useEffect(() => { api.getActivityLog().then(setEntries); }, []);

  return (
    <div className="page">
      <h1 className="page-title">History</h1>
      {entries.length === 0 ? (
        <div className="empty-state">No activity yet.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {entries.map((e, i) => (
            <div key={e.id} style={{ padding: '14px 20px', borderBottom: i < entries.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>{icons[e.type] || '•'}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14 }}>{e.detail}</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{new Date(e.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
