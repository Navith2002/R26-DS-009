import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Info,
  RefreshCcw,
  Sparkles,
  Star,
} from 'lucide-react';
import { useApp } from '../context/useApp';
import LanguageToggle from '../components/LanguageToggle';
import { assetUrl } from '../services/api';
import {
  analysisStatus,
  formatNumber,
  friendlyStatus,
  mostLikelyLabel,
  qualityLabel,
  qualityTone,
} from '../utils/format';
import {
  featureNameText,
  languageName,
  localizedRecommendation,
  qualityLabelText,
  severityText,
} from '../i18n/translations';

function toneForSeverity(severity) {
  if (severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'info';
}

function normalizeRecommendations(result) {
  const structured = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const texts = Array.isArray(result?.recommendation_texts) ? result.recommendation_texts : [];

  const priority = [];
  const normal = [];
  const seen = new Set();

  const add = (target, item) => {
    const signature = `${item.issueType || 'general'}|${String(item.text || '').trim()}`.toLowerCase();
    if (!item.text || seen.has(signature)) return;
    seen.add(signature);
    target.push(item);
  };

  if (structured.length && typeof structured[0] === 'object') {
    structured.slice(0, 3).forEach((item, index) => {
      add(priority, {
        id: `${item.issue_type || item.issueType || item.type || 'practice'}-priority-${index}`,
        issueType: item.issue_type || item.issueType || item.type || 'general',
        title: item.title || '',
        text: item.primary || item.text || item.recommendations?.[0] || 'Practice this skill slowly and carefully.',
        severity: item.severity || 'medium',
      });
    });

    structured.forEach((item, index) => {
      if (normal.length >= 2) return;
      const secondary = item.secondary || item.recommendations?.[1];
      if (!secondary) return;
      add(normal, {
        id: `${item.issue_type || item.issueType || item.type || 'practice'}-extra-${index}`,
        issueType: item.issue_type || item.issueType || item.type || 'general',
        title: item.title || '',
        text: secondary,
        severity: 'normal',
      });
    });
  } else {
    const source = texts.length ? texts : structured;
    source.slice(0, 3).forEach((text, index) => {
      add(priority, {
        id: `practice-priority-${index}`,
        issueType: 'general',
        title: '',
        text: typeof text === 'string' ? text : text?.primary || 'Keep practising this skill.',
        severity: 'medium',
      });
    });
  }

  texts.forEach((text, index) => {
    if (normal.length >= 2) return;
    add(normal, {
      id: `practice-extra-text-${index}`,
      issueType: 'general',
      title: '',
      text: typeof text === 'string' ? text : text?.primary || '',
      severity: 'normal',
    });
  });

  // Always keep two secondary recommendations visible when the backend
  // returns fewer than two. They remain normal-weight, not priority tips.
  while (normal.length < 2) {
    normal.push({
      id: `practice-extra-fallback-${normal.length}`,
      issueType: 'general',
      title: '',
      text: 'Short, slow practice helps handwriting become more consistent.',
      severity: 'normal',
    });
  }

  return {
    priority: priority.slice(0, 3),
    normal: normal.slice(0, 2),
  };
}

function childReason(reason = '', t) {
  const value = String(reason).toLowerCase();
  if (value.includes('blur')) return t('results.reasonBlur');
  if (value.includes('contrast')) return t('results.reasonContrast');
  if (value.includes('handwriting') || value.includes('ink')) return t('results.reasonInk');
  if (value.includes('visibility')) return t('results.reasonVisibility');
  if (value.includes('word')) return t('results.reasonWord');
  return t('results.reasonDefault');
}

function mergedPrediction(result) {
  const qualityPrediction = result?.quality_prediction || {};
  const mlPrediction = result?.ml_prediction || {};
  return {
    ...qualityPrediction,
    ...mlPrediction,
    label: mlPrediction?.label || qualityPrediction?.final_label || qualityPrediction?.reported_label || qualityPrediction?.predicted_label || null,
    confidence: mlPrediction?.confidence ?? qualityPrediction?.confidence ?? null,
    probabilities: mlPrediction?.probabilities || qualityPrediction?.probabilities || {},
    review_recommended:
      mlPrediction?.review_recommended
      ?? qualityPrediction?.review_recommended
      ?? mlPrediction?.low_confidence
      ?? qualityPrediction?.low_confidence
      ?? false,
    review_note: mlPrediction?.review_note || qualityPrediction?.review_note || null,
  };
}

export default function ResultsPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { history, latestResult, language, t } = useApp();

  const result = location.state?.result
    || (latestResult?.analysis_id === id ? latestResult : null)
    || history.find((item) => item.id === id);
  const preview = location.state?.preview;

  if (!result) {
    return (
      <div className="not-found-card">
        <h2>{t('results.resultNotFound')}</h2>
        <p>{t('results.resultNotFoundText')}</p>
        <button className="primary-action" onClick={() => navigate('/analyze')}>{t('results.newCheck')}</button>
      </div>
    );
  }

  const status = analysisStatus(result);
  const label = qualityLabel(result);
  const tone = qualityTone(label);
  const prediction = mergedPrediction(result);
  const validation = result?.input_validation || {};
  const segmentation = result?.segmentation_reliability || {};
  const issues = result?.issues || [];
  const recommendations = normalizeRecommendations(result);
  const probabilities = prediction?.probabilities || {};
  const features = result?.raw_features || {};
  const outputs = result?.output_files || {};
  const debug = result?.debug || {};
  const statusInfo = friendlyStatus(result, language);
  const reviewRecommended = Boolean(prediction?.review_recommended);
  const confidence = Number(prediction?.confidence);
  const confidenceAvailable = Number.isFinite(confidence);

  const topProbability = useMemo(
    () => Object.entries(probabilities).sort((a, b) => Number(b[1]) - Number(a[1])),
    [probabilities]
  );

  if (status !== 'COMPLETED') {
    const isModelError = status === 'MODEL_ERROR';
    const reasons = status === 'SEGMENTATION_UNRELIABLE'
      ? (segmentation.reasons || segmentation.warnings || [])
      : (validation.reasons || []);
    const retryRecommendations = [...recommendations.priority, ...recommendations.normal].slice(0, 2);

    return (
      <div className="results-page page-stack">
        <ResultTopbar navigate={navigate} id={result.analysis_id || id} t={t} />

        <section className={`kid-result-hero tone-${statusInfo?.tone || 'retake'}`}>
          <div className="kid-result-copy">
            <span className="eyebrow">{t('results.yourCheck')}</span>
            <h2>{statusInfo?.title || t('results.tryAgain')}</h2>
            <p>{statusInfo?.text}</p>
            <div className="result-action-row">
              <button className="primary-action" onClick={() => navigate('/analyze')}>
                <RefreshCcw size={17} /> {isModelError ? t('results.tryAgain') : t('results.retake')}
              </button>
            </div>
          </div>
          <div className="kid-result-mascot" aria-hidden="true">📷</div>
        </section>

        {reasons.length > 0 && (
          <section className="result-card child-card">
            <div className="card-heading-row">
              <div><span className="eyebrow">{t('results.photoTips')}</span><h3>{t('results.whatFix')}</h3></div>
            </div>
            <div className="friendly-reason-grid">
              {reasons.slice(0, 4).map((reason, index) => (
                <div className="friendly-reason" key={`${reason}-${index}`}>
                  <AlertTriangle size={17} />
                  <span>{childReason(reason, t)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {retryRecommendations.length > 0 && (
          <section className="result-card recommendation-card child-card">
            <div className="card-heading-row">
              <div><span className="eyebrow">{t('results.nextPhoto')}</span><h3>{t('results.helpfulTips')}</h3></div>
              <Sparkles size={22} />
            </div>
            <NormalRecommendationList items={retryRecommendations} analysisLanguage={result.language} uiLanguage={language} navigate={navigate} t={t} />
          </section>
        )}

        <TechnicalDetails
          result={result}
          preview={preview}
          validation={validation}
          segmentation={segmentation}
          prediction={prediction}
          topProbability={topProbability}
          features={features}
          outputs={outputs}
          debug={debug}
          issues={issues}
          uiLanguage={language}
          t={t}
        />
      </div>
    );
  }

  const primaryFocus = recommendations.priority[0]?.issueType || 'general';
  const displayLabel = qualityLabelText(label || prediction?.label, language) || t('home.completed');

  return (
    <div className="results-page page-stack">
      <ResultTopbar navigate={navigate} id={result.analysis_id || id} t={t} />

      <section className={`kid-result-hero quality-result-hero tone-${tone}`}>
        <div className="kid-result-copy">
          <span className="result-language">{languageName(result.language, language)}</span>
          <span className="eyebrow">{t('results.modelResult')}</span>
          <h2>{displayLabel}</h2>
          <div className="result-model-summary compact-summary">
            <div className="confidence-badge">
              <span>{t('results.confidence')}</span>
              <strong>{confidenceAvailable ? `${formatNumber(confidence, 1)}%` : '—'}</strong>
            </div>
          </div>

          {reviewRecommended && (
            <div className="teacher-review-inline" role="note">
              <span>🧑‍🏫</span>
              <div>
                <strong>{t('results.teacherReview')}</strong>
              </div>
            </div>
          )}

          <div className="result-action-row">
            <button className="primary-action" onClick={() => navigate('/practice', { state: { focus: primaryFocus, language: result.language } })}>
              <Sparkles size={17} /> {t('results.topTip')}
            </button>
          </div>
        </div>
        <div className="kid-result-mascot quality-mascot" aria-hidden="true">
          {tone === 'good' ? '🌟' : tone === 'average' ? '🙂' : tone === 'below-average' ? '✏️' : '💪'}
        </div>
      </section>

      <div className="child-results-grid single-result-column">
        <section className="result-card child-card recommendations-showcase">
          <div className="card-heading-row">
            <div>
              <h3>{t('results.planTitle')}</h3>
            </div>
            <span className="count-badge">{recommendations.priority.length + recommendations.normal.length}</span>
          </div>

          {recommendations.priority.length ? (
            <>
              <div className="recommendation-section-label"><Star size={14} fill="currentColor" /> {t('results.best3')}</div>
              <PriorityRecommendationList items={recommendations.priority} analysisLanguage={result.language} uiLanguage={language} navigate={navigate} t={t} />
              <div className="recommendation-section-label normal-label"><Sparkles size={14} /> {t('results.extra2')}</div>
              <NormalRecommendationList items={recommendations.normal} analysisLanguage={result.language} uiLanguage={language} navigate={navigate} t={t} />
            </>
          ) : (
            <div className="positive-state">
              <CheckCircle2 size={28} />
              <div><h4>{t('results.keepGood')}</h4><p>{t('results.noWeakness')}</p></div>
            </div>
          )}
        </section>

      </div>

      <SegmentationPreview outputs={outputs} t={t} />

      <TechnicalDetails
        result={result}
        preview={preview}
        validation={validation}
        segmentation={segmentation}
        prediction={prediction}
        topProbability={topProbability}
        features={features}
        outputs={outputs}
        debug={debug}
        issues={issues}
        uiLanguage={language}
        t={t}
      />
    </div>
  );
}

function ResultTopbar({ navigate, id, t }) {
  return (
    <div className="results-topbar results-topbar-with-language">
      <button onClick={() => navigate('/analyze')}><ArrowLeft size={19} /> {t('results.newCheck')}</button>
      <div className="results-topbar-right">
        <span className="analysis-id">{t('results.checkId', { id })}</span>
        <LanguageToggle compact />
      </div>
    </div>
  );
}

function PriorityRecommendationList({ items, analysisLanguage, uiLanguage, navigate, t }) {
  return (
    <div className="kid-recommendation-list">
      {items.slice(0, 3).map((item, index) => {
        const copy = localizedRecommendation(item.issueType, uiLanguage, item.title, item.text);
        return (
          <article className={`kid-recommendation priority-recommendation severity-${item.severity || 'medium'}`} key={item.id}>
            <span className="recommendation-number">{index + 1}</span>
            <div>
              <div className="recommendation-title-row">
                <h4>{copy.title}</h4>
                <span className="priority-chip">{t('results.priority')}</span>
              </div>
              <p>{copy.text}</p>
            </div>
            <button onClick={() => navigate('/practice', { state: { focus: item.issueType, language: analysisLanguage } })}>{t('results.practice')}</button>
          </article>
        );
      })}
    </div>
  );
}

function NormalRecommendationList({ items, analysisLanguage, uiLanguage, navigate, t }) {
  if (!items?.length) return null;

  return (
    <div className="normal-recommendation-list">
      {items.slice(0, 2).map((item, index) => {
        const copy = localizedRecommendation(item.issueType, uiLanguage, item.title, item.text);
        return (
          <article className="normal-recommendation" key={item.id}>
            <span className="normal-tip-icon">{index + 1}</span>
            <div>
              <h4>{copy.title || t('results.extraTip')}</h4>
              <p>{copy.text}</p>
            </div>
            <button onClick={() => navigate('/practice', { state: { focus: item.issueType, language: analysisLanguage } })}>{t('results.tryIt')}</button>
          </article>
        );
      })}
    </div>
  );
}

function SegmentationPreview({ outputs, t }) {
  const segmentation = outputs?.segmentation || {};
  const items = [
    segmentation?.line_overlay || outputs?.line_debug
      ? [t('results.lines'), segmentation?.line_overlay || outputs?.line_debug, t('results.lineRegions')]
      : null,
    segmentation?.word_overlay || outputs?.word_debug
      ? [t('results.words'), segmentation?.word_overlay || outputs?.word_debug, t('results.wordRegions')]
      : null,
    segmentation?.character_overlay || outputs?.character_debug
      ? [t('results.characters'), segmentation?.character_overlay || outputs?.character_debug, t('results.characterRegions')]
      : null,
    segmentation?.combined_overlay
      ? [t('results.combined'), segmentation?.combined_overlay, t('results.combinedRegions')]
      : null,
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <section className="result-card child-card segmentation-preview-card">
      <div className="card-heading-row">
        <div>
          <h3>{t('results.segTitle')}</h3>
        </div>
        <span className="count-badge">{t('results.views', { count: items.length })}</span>
      </div>
      <div className="segmentation-preview-grid">
        {items.map(([title, path, description]) => (
          <figure className="segmentation-preview-item" key={title}>
            <div className="segmentation-preview-image"><img src={assetUrl(path)} alt={title} /></div>
            <figcaption><strong>{title}</strong></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function TechnicalDetails({
  result,
  preview,
  validation,
  segmentation,
  prediction,
  topProbability,
  features,
  outputs,
  debug,
  issues = [],
  uiLanguage,
  t,
}) {
  const rawModelLabel = qualityLabel(result) || prediction?.label || mostLikelyLabel(result);

  return (
    <details className="technical-details">
      <summary>
        <span><Info size={18} /> {t('results.teacherDetails')}</span>
        <ChevronDown size={18} />
      </summary>
      <div className="technical-details-body">
        <div className="teacher-stat-grid">
          <div><span>{t('results.analysisStatus')}</span><strong>{result?.analysis_status || '—'}</strong></div>
          <div><span>{t('results.confidence')}</span><strong>{Number.isFinite(Number(prediction?.confidence)) ? `${formatNumber(prediction.confidence, 1)}%` : '—'}</strong></div>
          <div><span>{t('results.modelClass')}</span><strong>{rawModelLabel ? qualityLabelText(rawModelLabel, uiLanguage) : '—'}</strong></div>
          <div><span>{t('results.review')}</span><strong>{prediction?.review_recommended ? t('results.recommended') : t('results.notRequired')}</strong></div>
          <div><span>{t('results.lines')}</span><strong>{debug?.line_count ?? '—'}</strong></div>
          <div><span>{t('results.words')}</span><strong>{debug?.word_count ?? '—'}</strong></div>
          <div><span>{t('results.characters')}</span><strong>{debug?.character_region_count ?? '—'}</strong></div>
          <div><span>{t('results.segGate')}</span><strong>{segmentation?.status || '—'}</strong></div>
        </div>

        {topProbability?.length > 0 && (
          <section className="teacher-subsection">
            <h4>{t('results.probabilities')}</h4>
            <div className="probability-list">
              {topProbability.map(([name, value]) => (
                <div className="probability-row" key={name}>
                  <div className="probability-label"><span>{qualityLabelText(name, uiLanguage)}</span><strong>{Number(value).toFixed(1)}%</strong></div>
                  <div className="probability-track"><div className={`probability-fill tone-${qualityTone(name)}`} style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {issues.length > 0 && (
          <section className="teacher-subsection">
            <h4>{t('results.issueExplanations')}</h4>
            <div className="issue-list">
              {issues.map((issue, index) => {
                const issueType = issue.issue_type || issue.type || issue.feature || 'general';
                const copy = localizedRecommendation(issueType, uiLanguage, issue.title, issue.message);
                return (
                  <div className={`issue-item ${toneForSeverity(issue.severity)}`} key={`${issue.feature || issue.type}-${index}`}>
                    <div className="issue-severity">{severityText(issue.severity, uiLanguage)}</div>
                    <div>
                      <h4>{copy.title || featureNameText(issue.feature || issue.type, uiLanguage)}</h4>
                      <p>{copy.text}</p>
                      <small>{issue.feature ? `${featureNameText(issue.feature, uiLanguage)}: ${formatNumber(issue.value)}` : ''}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {Object.keys(validation?.features || {}).length > 0 && (
          <section className="teacher-subsection">
            <h4>{t('results.inputMeasurements')}</h4>
            <div className="feature-table">
              {Object.entries(validation.features).map(([name, value]) => (
                <div className="feature-row" key={name}><span>{featureNameText(name, uiLanguage)}</span><strong>{formatNumber(value)}</strong></div>
              ))}
            </div>
          </section>
        )}

        {Object.keys(features || {}).length > 0 && (
          <section className="teacher-subsection">
            <h4>{t('results.structuralFeatures')}</h4>
            <div className="feature-grid">
              {Object.entries(features).map(([name, value]) => (
                <div className="feature-tile" key={name}><span>{featureNameText(name, uiLanguage)}</span><strong>{formatNumber(value)}</strong></div>
              ))}
            </div>
          </section>
        )}

        <OutputGallery outputs={outputs} preview={preview} t={t} />
      </div>
    </details>
  );
}

function OutputGallery({ outputs, preview, t }) {
  const segmentation = outputs?.segmentation || {};
  const preprocessing = outputs?.preprocessing || {};
  const items = [
    preview ? [t('results.uploaded'), preview, true] : null,
    preprocessing?.skew_corrected ? [t('results.skewCorrected'), preprocessing.skew_corrected] : null,
    preprocessing?.shadow_removed ? [t('results.shadowRemoved'), preprocessing.shadow_removed] : null,
    preprocessing?.contrast_enhanced ? [t('results.contrastEnhanced'), preprocessing.contrast_enhanced] : null,
    preprocessing?.binary ? [t('results.binarized'), preprocessing.binary] : null,
    preprocessing?.ruled_lines_removed ? [t('results.ruledRemoved'), preprocessing.ruled_lines_removed] : null,
    segmentation?.line_overlay || outputs?.line_debug ? [t('results.lineSeg'), segmentation?.line_overlay || outputs?.line_debug] : null,
    segmentation?.word_overlay || outputs?.word_debug ? [t('results.wordSeg'), segmentation?.word_overlay || outputs?.word_debug] : null,
    segmentation?.character_overlay || outputs?.character_debug ? [t('results.charSeg'), segmentation?.character_overlay || outputs?.character_debug] : null,
    segmentation?.combined_overlay ? [t('results.combinedSeg'), segmentation.combined_overlay] : null,
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <section className="teacher-subsection">
      <h4>{t('results.processingOutputs')}</h4>
      <div className="output-gallery">
        {items.map(([title, path, alreadyResolved]) => {
          const src = alreadyResolved ? path : assetUrl(path);
          return (
            <figure key={title}>
              <div className="output-image"><img src={src} alt={title} /></div>
              <figcaption>{title}</figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
