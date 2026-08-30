export default function LoadingScreen({ t, step }) {
  return (
    <div id="loadingScreen">
      <div className="spinner" />
      <div className="loading-text">{t.loadingText}</div>
      <div className="loading-sub">{t.loadingSub}</div>
      <div className="loading-steps">
        {t.steps.map((label, i) => {
          const n = i + 1;
          const cls = n < step ? 'lstep done' : n === step ? 'lstep active' : 'lstep';
          return <div key={n} className={cls}>{label}</div>;
        })}
      </div>
    </div>
  );
}
