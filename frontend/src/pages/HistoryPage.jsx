import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, Trash2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  analysisStatus,
  formatDate,
  qualityLabel,
  qualityTone,
} from '../utils/format';
import { languageName, localizedRecommendation, qualityLabelText } from '../i18n/translations';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { UI_TEXT as GRAMMAR_UI_TEXT } from '../components/grammarCheck/i18n';

function historyStatus(item, language, t) {
  const label = qualityLabel(item);
  if (label) return { text: qualityLabelText(label, language), tone: qualityTone(label) };

  const status = analysisStatus(item);
  if (status === 'NEEDS_TEACHER_REVIEW') return { text: t('home.teacherReview'), tone: 'review' };
  if (status === 'SEGMENTATION_UNRELIABLE' || status === 'INPUT_RETAKE_REQUIRED') return { text: t('history.tryPhoto'), tone: 'retake' };
  if (status === 'MODEL_ERROR') return { text: t('history.notFinished'), tone: 'retake' };
  return { text: t('history.writingCheck'), tone: 'neutral' };
}

export default function HistoryPage() {
  const { history, grammarRuns, fluencyRuns, readingRuns, clearHistory, deleteHistoryEntry, activeChild, language, t } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [deletion, setDeletion] = useState(null);
  async function remove() {
    setBusy(true); setError(false);
    try {
      if (deletion === 'all') await clearHistory();
      else await deleteHistoryEntry(deletion);
    } catch { setError(true); }
    finally { setBusy(false); setDeletion(null); }
  }
  function row(item, content) {
    return <div className="history-row" key={item.id}>{content}<button className="danger-outline history-delete" disabled={busy} onClick={() => setDeletion(item.id)} aria-label={t('account.delete')} title={t('account.delete')}><Trash2 size={18} /></button></div>;
  }

  const grammarLang = language === 'tamil' ? 'ta' : 'si';
  const GT = GRAMMAR_UI_TEXT[grammarLang] || GRAMMAR_UI_TEXT.si;
  // Newest first, matching how `history` above is already ordered
  // (registerAnalysis prepends; registerGrammarRun appends, so this list
  // reverses at render time instead).
  const grammarHistory = [...grammarRuns].reverse();

  // Same reversal, same reason -- registerFluencyRun (AppContext.jsx)
  // also appends.
  const fluencyHistory = [...fluencyRuns].reverse();
  if (!history.length && !grammarHistory.length && !fluencyHistory.length && !readingRuns.length) {
    return (
      <EmptyState
        title={t('history.emptyTitle')}
        text={t('history.emptyText')}
        action={<button className="primary-action" onClick={() => navigate('/analyze')}>{t('progress.check')}</button>}
      />
    );
  }

  return (
    <div className="page-stack">
      {deletion && <ConfirmDialog
        message={deletion === 'all' ? t('account.deleteAllConfirm', { name: activeChild.name }) : t('account.deleteOneConfirm')}
        busy={busy} onConfirm={remove} onCancel={() => setDeletion(null)}
      />}
      <section className="page-intro header-with-action">
        <div>
          <span className="eyebrow">{t('history.eyebrow')}</span>
          <h2>{t('history.title')}</h2>
        </div>
        {(!!history.length || !!grammarRuns.length || !!fluencyRuns.length || !!readingRuns.length) && (
          <button
            className="danger-outline"
            disabled={busy}
            onClick={() => setDeletion('all')}
          >
            <Trash2 size={17} /> {t('account.deleteAll')}
          </button>
        )}
      </section>
      <p>{t('account.currentChild', { name: activeChild.name })}</p>
      <p className="history-notice">{t('account.reportNote')}</p>
      {error && <p className="account-error" role="alert">{t('account.deleteError')}</p>}

      {!!history.length && (
        <div className="history-cards">
          {history.map((item) => {
            const state = historyStatus(item, language, t);
            const firstStructured = Array.isArray(item?.recommendations) && typeof item.recommendations?.[0] === 'object'
              ? item.recommendations[0]
              : null;
            const localizedTip = firstStructured
              ? localizedRecommendation(
                  firstStructured.issueType || firstStructured.issue_type || firstStructured.type,
                  language,
                  firstStructured.title,
                  firstStructured.text || firstStructured.primary,
                ).text
              : '';
            const topTip = localizedTip || '';

            return row(item,
              <button key={item.id} className="history-card kid-history-card" onClick={() => navigate(`/results/${item.id}`)}>
                <div className={`history-script ${item.language}`}><span>{item.language === 'tamil' ? 'அ' : 'අ'}</span></div>
                <div className="history-copy">
                  <small>{languageName(item.language, language)} {t('history.writingCheck')}</small>
                  <h3>{state.text}</h3>
                  <p><Clock3 size={13} /> {formatDate(item.createdAt, language)}</p>
                </div>
                <div className="history-friendly-meta">
                  <span className={`quality-pill tone-${state.tone}`}>{state.text}</span>
                  {topTip && <small>{topTip}</small>}
                </div>
                <span className="history-arrow">→</span>
              </button>
            );
          })}
        </div>
      )}

      {!!grammarHistory.length && (
        <>
          <section className="section-intro">
            <h2>{GT.historyHeading}</h2>
          </section>

          <div className="history-cards">
            {grammarHistory.map((item) => {
              const errors = Math.max(0, (item.total || 0) - (item.correct || 0));
              const tone = errors === 0 ? 'good' : errors <= 2 ? 'average' : 'below';
              const errorText = errors === 0
                ? (grammarLang === 'ta' ? 'பிழைகள் இல்லை' : 'වැරදි නැත')
                : (grammarLang === 'ta' ? `பிழைகள் ${errors}` : `වැරදි ${errors}`);

              return row(item,
                <button
                  key={item.id}
                  className="history-card kid-history-card"
                  onClick={() => navigate(`/grammar-results/${item.id}`)}
                >
                  <div className={`history-script ${item.language === 'ta' ? 'tamil' : 'sinhala'}`}>
                    <span>{item.language === 'ta' ? 'அ' : 'අ'}</span>
                  </div>
                  <div className="history-copy">
                    <small>{GT.historyLabel}</small>
                    <h3>{errorText}</h3>
                    <p><Clock3 size={13} /> {formatDate(item.createdAt, language)}</p>
                  </div>
                  <div className="history-friendly-meta">
                    <span className={`quality-pill tone-${tone}`}>{errorText}</span>
                  </div>
                  <span className="history-arrow">→</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Reading-fluency assessment history (FluencyPage.jsx via
          registerFluencyRun, AppContext.jsx) -- same card layout as the
          grammar-check section above, placed right after it. Each card
          opens its own detail view (FluencyResultPage.jsx), same as
          /results/:id and /grammar-results/:id. */}
      {!!fluencyHistory.length && (
        <>
          <section className="section-intro">
            <h2>{t('account.fluencyHistory')}</h2>
          </section>

          <div className="history-cards">
            {fluencyHistory.map((item) => {
              const label = item.result?.fluency_label;
              const tone = label === 'Fluent' ? 'good' : label === 'Struggling' ? 'below' : 'average';
              const isTamil = language === 'tamil';
              const statusText = label === 'Fluent'
                ? (isTamil ? 'சரளம்' : 'ප්‍රවීණයි')
                : label === 'Struggling'
                  ? (isTamil ? 'பயிற்சி தேவை' : 'අභ්‍යාස අවශ්‍යයි')
                  : (isTamil ? 'மிதமானது' : 'මධ්‍යස්ථයි');
              const fluencyLabelText = isTamil ? 'வாசிப்புத் திறன் மதிப்பீடு' : 'කියවීමේ ප්‍රවීණතා ඇගයීම';

              return row(item,
                <button
                  key={item.id}
                  className="history-card kid-history-card"
                  onClick={() => navigate(`/fluency-results/${item.id}`)}
                >
                  <div className={`history-script ${item.language}`}>
                    <span>{isTamil ? 'அ' : 'අ'}</span>
                  </div>
                  <div className="history-copy">
                    <small>{fluencyLabelText}</small>
                    <h3>{statusText}</h3>
                    <p><Clock3 size={13} /> {formatDate(item.createdAt, language)}</p>
                  </div>
                  <div className="history-friendly-meta">
                    <span className={`quality-pill tone-${tone}`}>{statusText}</span>
                  </div>
                  <span className="history-arrow">→</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {!!readingRuns.length && <>
        <section className="section-intro"><h2>{t('account.readingHistory')}</h2></section>
        <div className="history-cards">{readingRuns.map((item) => row(item,
          <button className="history-card kid-history-card" onClick={() => navigate(`/reading-results/${item.id}`)}>
            <div className={`history-script ${item.language}`}><span>{item.language === 'tamil' ? 'அ' : 'අ'}</span></div>
            <div className="history-copy"><h3>{t('account.readingAccuracy', { value: Number(item.result?.accuracy || 0).toFixed(0) })}</h3><p><Clock3 size={13} />{formatDate(item.createdAt, language)}</p></div>
            <span className="history-arrow">→</span>
          </button>
        ))}</div>
      </>}
    </div>
  );
}
