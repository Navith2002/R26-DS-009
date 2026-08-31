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
  const { history, grammarRuns, fluencyRuns, clearHistory, language, t } = useApp();
  const navigate = useNavigate();

  const grammarLang = language === 'tamil' ? 'ta' : 'si';
  const GT = GRAMMAR_UI_TEXT[grammarLang] || GRAMMAR_UI_TEXT.si;
  // Newest first, matching how `history` above is already ordered
  // (registerAnalysis prepends; registerGrammarRun appends, so this list
  // reverses at render time instead).
  const grammarHistory = [...grammarRuns].reverse();
  // Same reversal, same reason -- registerFluencyRun (AppContext.jsx)
  // also appends.
  const fluencyHistory = [...fluencyRuns].reverse();

  if (!history.length && !grammarHistory.length && !fluencyHistory.length) {
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
      <section className="page-intro header-with-action">
        <div>
          <span className="eyebrow">{t('history.eyebrow')}</span>
          <h2>{t('history.title')}</h2>
        </div>
        {!!history.length && (
          <button
            className="danger-outline"
            onClick={() => {
              if (confirm(t('history.clearConfirm'))) clearHistory();
            }}
          >
            <Trash2 size={17} /> {t('history.clear')}
          </button>
        )}
      </section>

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

            return (
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
          <section className="page-intro">
            <h2>{GT.historyHeading}</h2>
          </section>

          <div className="history-cards">
            {grammarHistory.map((item) => {
              const errors = Math.max(0, (item.total || 0) - (item.correct || 0));
              const tone = errors === 0 ? 'good' : errors <= 2 ? 'average' : 'below';
              const errorText = errors === 0
                ? (grammarLang === 'ta' ? 'பிழைகள் இல்லை' : 'වැරදි නැත')
                : (grammarLang === 'ta' ? `பிழைகள் ${errors}` : `වැරදි ${errors}`);

              return (
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
          <section className="page-intro">
            <h2>කියවුම් හැකියා පරීක්ෂණ</h2>
          </section>

          <div className="history-cards">
            {fluencyHistory.map((item) => {
              const label = item.result?.fluency_label;
              const tone = label === 'Fluent' ? 'good' : label === 'Struggling' ? 'below' : 'average';
              const isTamil = item.language === 'tamil';
              const statusText = label === 'Fluent'
                ? (isTamil ? 'சரளம்' : 'ප්‍රවීණයි')
                : label === 'Struggling'
                  ? (isTamil ? 'பயிற்சி தேவை' : 'අභ්‍යාස අවශ්‍යයි')
                  : (isTamil ? 'மிதமானது' : 'මධ්‍යස්ථයි');
              const fluencyLabelText = isTamil ? 'வாசிப்புத் திறன் மதிப்பீடு' : 'කියවීමේ ප්‍රවීණතා ඇගයීම';

              return (
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
    </div>
  );
}
