// Restyled to match WriteBright's own empty-state card (colors/fonts/
// sizes) exactly, same treatment as UploadScreen.jsx -- pulled outside
// .grammar-check-scope in GrammarCheckPage.jsx and rebuilt with the
// shared .empty-state/.empty-icon classes (styles.css) instead of this
// component's own #loadingScreen/.spinner palette. The step list keeps
// its original data (t.steps/step), just restyled to WriteBright's
// orange/green/muted tones instead of the old dot-prefix list.
export default function LoadingScreen({ t, step }) {
  return (
    <div className="empty-state loading-empty-state">
      <div className="empty-icon"><span className="wb-spinner" aria-hidden="true" /></div>
      <h3>{t.loadingText}</h3>
      <p>{t.loadingSub}</p>
      <div className="loading-step-list">
        {t.steps.map((label, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'active' : 'upcoming';
          return (
            <div key={n} className={`loading-step-row loading-step-row--${state}`}>
              <span className="loading-step-dot" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
