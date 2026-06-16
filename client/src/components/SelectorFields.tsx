import { PLATFORMS } from '../lib/platforms';

interface Selectors {
  listSelector: string;
  titleSelector: string;
  linkSelector: string;
}

interface Props {
  values: Selectors;
  onChange: (s: Selectors) => void;
  onRenderModeChange?: (mode: 'static' | 'browser') => void;
}

export default function SelectorFields({ values, onChange, onRenderModeChange }: Props) {
  const applyPlatform = (key: string) => {
    if (key === '') return;
    const p = PLATFORMS[key];
    onChange({ listSelector: p.listSelector, titleSelector: p.titleSelector, linkSelector: p.linkSelector });
    onRenderModeChange?.(p.renderMode);
  };

  return (
    <div>
      {/* Platform shortcut */}
      <div className="form-row">
        <label>Known platform? <span style={{ fontWeight: 400, color: '#94a3b8' }}>— picks the right selectors for you</span></label>
        <select defaultValue="" onChange={(e) => applyPlatform(e.target.value)}>
          <option value="">Custom / unknown — I'll fill in manually</option>
          {Object.entries(PLATFORMS).map(([key, p]) => (
            <option key={key} value={key}>{p.label} — {p.hint}</option>
          ))}
        </select>
      </div>

      {/* Explainer */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
        <strong>How to find selectors for an unknown site:</strong>
        <ol style={{ paddingLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Open the careers page in your browser</li>
          <li>Right-click on one of the job titles → <strong>Inspect</strong></li>
          <li>Look at the HTML — find the element that wraps each job row (a <code>&lt;li&gt;</code>, <code>&lt;div&gt;</code>, etc.)</li>
          <li>Right-click that element in DevTools → <strong>Copy → Copy selector</strong></li>
          <li>Paste it below as the "job row" selector, then find the title and link elements inside it</li>
        </ol>
        <p style={{ marginTop: 8 }}>Then hit <strong>Preview</strong> — if it shows job titles, you got it right.</p>
      </div>

      <div className="form-row">
        <label>
          Job row selector
          <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>— the HTML element that repeats once per job listing</span>
        </label>
        <input
          value={values.listSelector}
          onChange={(e) => onChange({ ...values, listSelector: e.target.value })}
          placeholder=".job-listing   or   li.position   or   tr.job-row"
        />
      </div>

      <div className="form-row">
        <label>
          Job title selector
          <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>— where the job title text is, inside each row</span>
        </label>
        <input
          value={values.titleSelector}
          onChange={(e) => onChange({ ...values, titleSelector: e.target.value })}
          placeholder='h3   or   .job-title   or   "self" if the row element itself is the link'
        />
      </div>

      <div className="form-row">
        <label>
          Apply link selector
          <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>— the &lt;a&gt; tag linking to the full job post, inside each row</span>
        </label>
        <input
          value={values.linkSelector}
          onChange={(e) => onChange({ ...values, linkSelector: e.target.value })}
          placeholder='a   or   "self" if the row element itself is the link'
        />
      </div>
    </div>
  );
}
