import { useState, useEffect, FormEvent } from 'react';

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function makeProblem(): { question: string; answer: number } {
  const ops = [
    () => { const a = Math.floor(Math.random() * 9) + 2; const b = Math.floor(Math.random() * 9) + 2; return { question: `${a} + ${b}`, answer: a + b }; },
    () => { const b = Math.floor(Math.random() * 9) + 2; const a = b + Math.floor(Math.random() * 9) + 1; return { question: `${a} − ${b}`, answer: a - b }; },
    () => { const a = Math.floor(Math.random() * 5) + 2; const b = Math.floor(Math.random() * 5) + 2; return { question: `${a} × ${b}`, answer: a * b }; },
  ];
  return ops[Math.floor(Math.random() * ops.length)]();
}

export default function MathConfirmModal({ title, description, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const [problem] = useState(makeProblem);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => { setTimeout(() => (document.getElementById('math-input') as HTMLInputElement)?.focus(), 50); }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (parseInt(input, 10) === problem.answer) {
      onConfirm();
    } else {
      setWrong(true);
      setInput('');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 380 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>{description}</p>

        <form onSubmit={submit}>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>To confirm, solve:</p>
            <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>{problem.question} = ?</p>
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <input
              id="math-input"
              type="number"
              value={input}
              onChange={(e) => { setInput(e.target.value); setWrong(false); }}
              placeholder="Your answer"
              autoComplete="off"
            />
          </div>
          {wrong && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>That's not right — try again.</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-danger" disabled={!input}>{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
