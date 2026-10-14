import { Check, ScanText } from 'lucide-react';

// While the page is analysed: the uploaded photo with a moving scan line,
// a progress bar and the analysis steps (t.steps, advanced by `step`).
export default function LoadingScreen({ t, step, previewUrl }) {
  const total = t.steps.length;
  const percent = Math.round((Math.min(step, total) / total) * 100);

  return (
    <div className="page-stack gc">
      <section className="gc-card gc-loading">
        <div className="gc-scan">
          {previewUrl ? <img src={previewUrl} alt="" /> : <span className="gc-scan-blank"><ScanText size={40} /></span>}
          <span className="gc-scan-line" aria-hidden="true" />
        </div>
        <div className="gc-loading-body">
          <h3>{t.loadingText}</h3>
          <p>{t.loadingSub}</p>
          <div className="gc-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%` }} />
          </div>
          <span className="gc-progress-pct">{percent}%</span>
          <ol className="gc-steps">
            {t.steps.map((label, i) => {
              const n = i + 1;
              const state = n < step ? 'done' : n === step ? 'active' : 'upcoming';
              return (
                <li key={label} className={state}>
                  <span className="gc-step-dot">{state === 'done' ? <Check size={14} /> : n}</span>
                  {label}
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}
