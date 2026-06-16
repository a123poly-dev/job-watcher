import { useState, FormEvent } from 'react';
import { api } from '../lib/api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onLogin();
    } catch {
      setError('Wrong password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div className="card" style={{ width: 360 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>👀 Job Watcher</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Enter the shared password to continue.</p>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="••••••••"
            />
          </div>
          {error && <p className="status-error" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
