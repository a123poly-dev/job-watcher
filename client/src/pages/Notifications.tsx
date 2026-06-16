import { useState, useEffect } from 'react';
import { api, NotificationLogEntry } from '../lib/api';

export default function Notifications() {
  const [entries, setEntries] = useState<NotificationLogEntry[]>([]);

  useEffect(() => { api.getNotificationLog().then(setEntries); }, []);

  return (
    <div className="page">
      <h1 className="page-title">Sent notifications</h1>
      {entries.length === 0 ? (
        <div className="empty-state">No notifications sent yet.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {entries.map((e, i) => (
            <div key={e.id} style={{ padding: '14px 20px', borderBottom: i < entries.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span>{e.success ? '✅' : '❌'}</span>
                <a href={e.listingUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 14 }}>
                  {e.listingTitle}
                </a>
              </div>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                {e.filter?.site?.name} → {e.sentToEmail}
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{new Date(e.sentAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
