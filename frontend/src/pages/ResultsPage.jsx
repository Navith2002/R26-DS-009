import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Lightbulb,
  Pencil,
  Sprout,
  Star,
  Target,
  X,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Info,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';

import { useApp } from '../context/useApp';
import LanguageToggle from '../components/LanguageToggle';
import { assetUrl } from '../services/api';

import {
  analysisStatus,
  isBlockedQualityResult,
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


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function toneForSeverity(severity) {
  if (severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'info';
}

function resultQualityTone(label) {
  const normalized = String(label || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const tones = {
    excellent: 'good',
    'very good': 'good',
    good: 'good',
    'above average': 'above-average',
    average: 'average',
    'below average': 'below-average',
    poor: 'poor',
  };
  return tones[normalized] || qualityTone(label);
}


function normalizeIssueType(issue = {}) {
  const raw = String(
    issue?.issue_type
      || issue?.type
      || issue?.feature
      || 'general'
  ).trim().toLowerCase();

  const aliases = {
    spacing_std: 'spacing',
    word_spacing_variation: 'word_spacing',
    character_spacing_variation: 'character_spacing',
    baseline_std: 'baseline_alignment',
    avg_slant: 'slant',
    avg_size_variation: 'size_variation',
    character_proportion_variation: 'character_proportion',
    character_shape_consistency: 'character_shape',
    stroke_thickness_consistency: 'stroke_thickness',
  };

  return aliases[raw] || raw;
}


/* =========================================================
   CHILD ISSUE ICONS
   ========================================================= */

function childIssueIcon(issueType) {
  const icons = {
    spacing: '↔️',
    word_spacing: '↔️',
    character_spacing: '🔤',
    baseline_alignment: '📏',
    local_baseline_drift: '🛣️',
    size_variation: '🔠',
    character_proportion: '📐',
    curve_smoothness: '〰️',
    loop_roundness: '⭕',
    stroke_continuity: '✏️',
    stroke_thickness: '🖊️',
    density_distribution: '✨',
    character_shape: '👀',
    upper_lower_balance: '⚖️',
    slant: '📐',
  };

  return icons[issueType] || '🌱';
}


/* =========================================================
   TRANSLATION HELPERS
   ========================================================= */

function childIssueCopy(issueType, t) {
  const normalizedIssue = normalizeIssueType({
    issue_type: issueType,
  });

  const titleKey = `issue.${normalizedIssue}.title`;
  const textKey = `issue.${normalizedIssue}.text`;

  return {
    title: t(titleKey),
    text: t(textKey),
  };
}


function childQualityCopy(label, t) {
  const normalized = String(label || '')
    .trim()
    .toLowerCase();

  const keyMap = {
    'very good': 'results.childVeryGood',
    good: 'results.childGood',
    average: 'results.childAverage',
    'below average': 'results.childBelowAverage',
    poor: 'results.childPoor',
  };

  const key = keyMap[normalized] || 'results.childAverage';

  return {
    title: t(`${key}Title`),
    text: t(`${key}Text`),
  };
}


function feedbackCopy(feedbackStatus, t) {
  const status = String(
    feedbackStatus || ''
  ).toUpperCase();

  if (
    status === 'UNAVAILABLE'
    || status === 'NOT_RUN'
  ) {
    return {
      kind: 'unavailable',
      title: t('results.feedbackUnavailableTitle'),
      text: t('results.feedbackUnavailableText'),
    };
  }

  if (status === 'PARTIAL') {
    return {
      kind: 'partial',
      title: t('results.partialFeedbackTitle'),
      text: t('results.partialFeedbackText'),
    };
  }

  return {
    kind: 'available',
    title: '',
    text: '',
  };
}


/* =========================================================
   RECOMMENDATIONS
   ========================================================= */

function normalizeRecommendations(result) {
  const structured = Array.isArray(
    result?.recommendations
  )
    ? result.recommendations
    : [];

  const texts = Array.isArray(
    result?.recommendation_texts
  )
    ? result.recommendation_texts
    : [];

  const priority = [];
  const normal = [];
  const seen = new Set();

  const add = (target, item) => {
    const signature =
      `${item.issueType || 'general'}|${String(
        item.text || ''
      ).trim()}`.toLowerCase();

    if (!item.text || seen.has(signature)) {
      return;
    }

    seen.add(signature);
    target.push(item);
  };

  if (
    structured.length
    && typeof structured[0] === 'object'
  ) {
    structured.slice(0, 3).forEach(
      (item, index) => {
        add(priority, {
          id:
            `${item.issue_type
              || item.issueType
              || item.type
              || 'practice'}-priority-${index}`,

          issueType:
            item.issue_type
            || item.issueType
            || item.type
            || 'general',

          practiceFocus:
            item.practice_focus
            || item.practiceFocus
            || item.issue_type
            || item.issueType
            || item.type
            || 'general',

          childTitle:
            item.child_title
            || item.childTitle
            || '',

          title:
            item.title
            || '',

          text:
            item.primary
            || item.text
            || item.recommendations?.[0]
            || '',

          secondary:
            item.secondary
            || item.recommendations?.[1]
            || '',

          severity:
            item.severity
            || 'low',

          reliability:
            item.reliability
            || 'unknown',
        });
      }
    );

    structured.forEach(
      (item, index) => {
        if (normal.length >= 2) {
          return;
        }

        const secondary =
          item.secondary
          || item.recommendations?.[1];

        if (!secondary) {
          return;
        }

        add(normal, {
          id:
            `${item.issue_type
              || item.issueType
              || item.type
              || 'practice'}-extra-${index}`,

          issueType:
            item.issue_type
            || item.issueType
            || item.type
            || 'general',

          practiceFocus:
            item.practice_focus
            || item.practiceFocus
            || item.issue_type
            || item.issueType
            || item.type
            || 'general',

          childTitle:
            item.child_title
            || item.childTitle
            || '',

          title:
            item.title
            || '',

          text: secondary,

          secondary: '',

          severity:
            item.severity
            || 'low',

          reliability:
            item.reliability
            || 'unknown',
        });
      }
    );
  } else {
    const source =
      texts.length
        ? texts
        : structured;

    source.slice(0, 3).forEach(
      (text, index) => {
        const value =
          typeof text === 'string'
            ? text
            : text?.primary
              || text?.text
              || '';

        if (!value) {
          return;
        }

        add(priority, {
          id: `practice-priority-${index}`,
          issueType: 'general',
          practiceFocus: 'general',
          childTitle: '',
          title: '',
          text: value,
          secondary: '',
          severity: 'low',
          reliability: 'unknown',
        });
      }
    );
  }

  return {
    priority: priority.slice(0, 3),
    normal: normal.slice(0, 2),
  };
}


/* =========================================================
   VALIDATION REASONS
   ========================================================= */

function childReason(reason = '', t) {
  const value =
    String(reason).toLowerCase();

  if (value.includes('blur')) {
    return t('results.reasonBlur');
  }

  if (value.includes('contrast')) {
    return t('results.reasonContrast');
  }

  if (
    value.includes('handwriting')
    || value.includes('ink')
  ) {
    return t('results.reasonInk');
  }

  if (value.includes('visibility')) {
    return t('results.reasonVisibility');
  }

  if (value.includes('word')) {
    return t('results.reasonWord');
  }

  return t('results.reasonDefault');
}


/* =========================================================
   PREDICTION
   ========================================================= */

function mergedPrediction(result) {
  if (isBlockedQualityResult(result)) {
    return { available: false, label: null, confidence: null, probabilities: {} };
  }
  const qualityPrediction =
    result?.quality_prediction || {};

  const mlPrediction =
    result?.ml_prediction || {};

  return {
    ...qualityPrediction,
    ...mlPrediction,

    label:
      mlPrediction?.label
      || qualityPrediction?.final_label
      || qualityPrediction?.reported_label
      || qualityPrediction?.predicted_label
      || null,

    confidence:
      mlPrediction?.confidence
      ?? qualityPrediction?.confidence
      ?? null,

    probabilities:
      mlPrediction?.probabilities
      || qualityPrediction?.probabilities
      || {},

    review_recommended:
      mlPrediction?.review_recommended
      ?? qualityPrediction?.review_recommended
      ?? mlPrediction?.low_confidence
      ?? qualityPrediction?.low_confidence
      ?? false,

    review_note:
      mlPrediction?.review_note
      || qualityPrediction?.review_note
      || null,
  };
}


/* =========================================================
   FEEDBACK STATUS
   ========================================================= */

function normalizeFeedbackStatus(result) {
  const explicit = String(
    result?.feedback_status || ''
  ).trim().toUpperCase();

  if (explicit) {
    return explicit;
  }

  const explainability =
    result?.explainability || {};

  if (
    explainability?.available === false
  ) {
    return 'UNAVAILABLE';
  }

  if (
    explainability?.partial_feedback === true
  ) {
    return 'PARTIAL';
  }

  if (
    explainability?.available === true
  ) {
    return 'AVAILABLE';
  }

  return 'NOT_RUN';
}


/* =========================================================
   FIND RECOMMENDATION FOR ISSUE
   ========================================================= */

function recommendationForIssue(
  issue,
  recommendations
) {
  const issueType =
    normalizeIssueType(issue);

  return (
    recommendations.priority.find(
      (item) =>
        item.issueType === issueType
    )
    ||
    recommendations.normal.find(
      (item) =>
        item.issueType === issueType
    )
    ||
    null
  );
}


/* =========================================================
   MAIN RESULTS PAGE
   ========================================================= */

const SKILL_FEEDBACK = [
  { id: 'spacing', title: 'results.skillSpacing', icon: '↔',
    features: ['spacing_std', 'word_spacing_variation'], types: ['spacing', 'word_spacing'] },
  { id: 'alignment', title: 'results.skillAlignment', icon: '☰',
    features: ['baseline_std', 'local_baseline_drift'], types: ['baseline_alignment', 'local_baseline_drift'] },
  { id: 'size', title: 'results.skillSize', icon: 'அ',
    features: ['avg_size_variation', 'character_proportion_variation'], types: ['size_variation', 'character_proportion'] },
];

function excludedSkillFeatures(explanation) {
  const named = items => (Array.isArray(items) ? items : [])
    .map(item => typeof item === 'string' ? item : item?.feature);
  return new Set([
    ...named(explanation?.suppressed_features),
    ...named(explanation?.missing_features),
    ...named(explanation?.soft_warning_features),
  ]);
}

function finiteMeasurement(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function trustworthyIssue(issue, result, explanation) {
  return explanation?.available === true
    && ['strong', 'moderate'].includes(issue?.reliability)
    && ['high', 'medium', 'low'].includes(issue?.severity)
    && !(issue?.reliability_warnings?.length)
    && finiteMeasurement(result?.raw_features?.[issue.feature])
    && !excludedSkillFeatures(explanation).has(issue.feature);
}

function skillFeedbackStates(result, issues, explanation) {
  const usable = explanation?.available === true;
  const raw = result?.raw_features || {};
  const excluded = excludedSkillFeatures(explanation);
  // Only complete, explicit coverage supports a no-concern state. Absence of
  // an issue alone never proves that a skill was assessed or was good.
  const expected = Number(explanation?.expected_feature_count);
  const fullyEvaluated = usable && Number.isFinite(expected) && expected > 0
    && Number(explanation?.calibrated_feature_count) === expected
    && Number(explanation?.evaluated_feature_count) === expected
    && explanation?.partial_feedback !== true;
  return SKILL_FEEDBACK.map(skill => {
    const related = issues.filter(issue => skill.features.includes(issue.feature)
      || skill.types.includes(normalizeIssueType(issue)));
    const practice = usable && related.some(issue => trustworthyIssue(issue, result, explanation));
    const required = skill.features.filter(name => result?.language === 'sinhala' || !['word_spacing_variation', 'character_proportion_variation'].includes(name));
    const hasEvidence = required.length > 0 && required.every(name => finiteMeasurement(raw[name]));
    const uncertain = related.some(issue => !trustworthyIssue(issue, result, explanation))
      || skill.features.some(name => excluded.has(name));
    const state = practice ? 'practice'
      : fullyEvaluated && hasEvidence && !uncertain && !related.length ? 'clear' : 'unknown';
    return { ...skill, state };
  });
}

function SkillFeedbackCards({ skills, language, t }) {
  const labels = { clear: 'results.skillClear', practice: 'results.skillPractice', unknown: 'results.skillUnknown' };
  return (
    <section className="hw-skill-section" aria-labelledby="hw-skills-title">
      <div className="hw-section-title"><Sprout aria-hidden="true" /><h3 id="hw-skills-title">{t('results.mySkills')}</h3><span aria-hidden="true">✦</span></div>
      <div className="hw-skill-grid">
        {skills.map(skill => (
          <article className={`hw-skill-card hw-skill-${skill.state}`} key={skill.id}>
            <div className="hw-skill-content">
              <span className={`hw-skill-icon hw-skill-icon-${skill.id}`} aria-hidden="true">{skill.id === 'size' ? (language === 'tamil' ? 'அ' : 'අ') : skill.icon}</span>
              <h4>{t(skill.title)}</h4>
              <p>{t(`results.skillDescription.${skill.id}`)}</p>
            </div>
            <div className="hw-skill-indicator">
              <div className="hw-skill-ring" role="img" aria-label={`${t(skill.title)}: ${t(labels[skill.state])}`}>
                <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="39" pathLength="100" /></svg>
                <span aria-hidden="true">{skill.state === 'clear' ? '✓' : skill.state === 'practice' ? '✎' : '?'}</span>
              </div>
              <span className="hw-skill-state">{t(labels[skill.state])}</span>
            </div>
          </article>
        ))}
      </div>
      <p className="hw-indicator-note"><Info size={14} aria-hidden="true" />{t('results.skillIndicatorsNote')}</p>
    </section>
  );
}

function ResultPhoto({ src, caption, t }) {
  const dialog = useRef(null);
  if (!src) return null;
  return (
    <figure className="hw-result-photo">
      <div className="hw-photo-heading"><Camera size={19} aria-hidden="true" /><span>{t('results.myHandwriting')}</span></div>
      <button type="button" className="hw-photo-open" onClick={() => dialog.current?.showModal()} aria-label={t('results.enlargeImage')}>
        <img src={src} alt={caption} />
        <span className="hw-photo-enlarge">{t('results.enlargeImage')}</span>
      </button>
      <figcaption>{caption}</figcaption>
      <dialog ref={dialog} className="hw-photo-dialog" aria-label={t('results.myHandwriting')} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <button type="button" className="hw-photo-close" onClick={() => dialog.current?.close()} aria-label={t('results.closeImage')}><X size={22} /></button>
        <img src={src} alt={caption} />
        <p>{caption}</p>
      </dialog>
    </figure>
  );
}

function FocusPracticeCard({ focus, secondary, language, navigate, t }) {
  const glyph = language === 'tamil' ? 'அ' : 'අ';
  const open = item => navigate('/practice', { state: { focus: item.focus, language } });
  return (
    <section className="hw-practice-section" aria-labelledby="hw-practice-title">
      <div className="hw-section-title"><Target aria-hidden="true" /><h3 id="hw-practice-title">{t('results.todayPractice')}</h3><span aria-hidden="true">✦</span></div>
      <div className="hw-practice-body">
        <div className="hw-practice-copy">
          <span className="hw-practice-label">{t(focus.personalized ? 'results.nextSmallStep' : 'results.generalPractice')}</span>
          <h4>{focus.title}</h4><p>{focus.text}</p>
          <div className={`hw-tracing-guide hw-tracing-${focus.focus}`} aria-hidden="true">
            <span className="hw-pencil-sticker">✏️</span>
            {[0, 1, 2, 3].map(i => <span key={i} className={i < 2 ? 'hw-trace-faded' : 'hw-trace-ink'}>{glyph}</span>)}
          </div>
          <small className="hw-practice-example-note">{t('results.practiceExample')}</small>
        </div>
        <div className="hw-practice-actions">
          <button type="button" className="primary-action" onClick={() => open(focus)}><Pencil size={20} aria-hidden="true" />{t('results.practice')}<ArrowRight size={20} aria-hidden="true" /></button>
          <div className="hw-small-tip"><Lightbulb size={21} aria-hidden="true" /><div><strong>{t('results.smallTip')}</strong><p>{t('results.smallTipText')}</p></div></div>
        </div>
      </div>
      {secondary && <div className="hw-secondary-focus"><span>{childIssueIcon(secondary.focus)}</span><div><strong>{secondary.title}</strong><p>{secondary.text}</p></div><button type="button" onClick={() => open(secondary)}>{t('results.tryIt')}<ArrowRight size={16} aria-hidden="true" /></button></div>}
    </section>
  );
}

function EffortBadges({ t }) {
  return (
    <section className="hw-effort-section" aria-labelledby="hw-effort-title">
      <div className="hw-section-title"><Star aria-hidden="true" /><h3 id="hw-effort-title">{t('results.effortTitle')}</h3></div>
      <div className="hw-effort-grid">
        <article className="hw-effort-badge hw-effort-star"><span className="hw-sticker" aria-hidden="true">🌟</span><div><strong>{t('results.effortChecked')}</strong><p>{t('results.effortCheckedText')}</p></div></article>
        <article className="hw-effort-badge hw-effort-pencil"><span className="hw-sticker" aria-hidden="true">✏️</span><div><strong>{t('results.effortNext')}</strong><p>{t('results.effortNextText')}</p></div></article>
      </div>
    </section>
  );
}

export default function ResultsPage() {
  const { id } = useParams();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const {
    history,
    language,
    t,
  } = useApp();

  // Resolve from this child's records only. Navigation state can survive a
  // sign-out or child switch and must never bypass account isolation.
  const result = history.find((item) => item.id === id);
  // The Analyze page owns and revokes its blob URL on unmount. Create a
  // separate Results-page URL from the original File passed in route state.
  const previewFile = result && location.state?.previewFile instanceof Blob
    ? location.state.previewFile
    : null;
  const [ownedPreview, setOwnedPreview] = useState(null);

  useEffect(() => {
    if (!previewFile) return undefined;
    const url = URL.createObjectURL(previewFile);
    setOwnedPreview({ file: previewFile, url });
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const preview = result
    ? (ownedPreview?.file === previewFile ? ownedPreview?.url : null)
      || (previewFile ? null : location.state?.preview)
      || null
    : null;


  /* =======================================================
     RESULT NOT FOUND
     ======================================================= */

  if (!result) {
    return (
      <div className="not-found-card">

        <h2>
          {t('results.resultNotFound')}
        </h2>

        <p>
          {t('results.resultNotFoundText')}
        </p>

        <button
          className="primary-action"
          onClick={() =>
            navigate('/analyze')
          }
        >
          {t('results.newCheck')}
        </button>

      </div>
    );
  }


  /* =======================================================
     RESULT DATA
     ======================================================= */

  const status =
    analysisStatus(result);

  const legacyLabel =
    qualityLabel(result);

  const prediction =
    mergedPrediction(result);

  const finalModelLabel =
    prediction?.label
    || legacyLabel
    || mostLikelyLabel(result);

  const tone =
    resultQualityTone(finalModelLabel);

  const validation =
    result?.input_validation || {};

  const segmentation =
    result?.segmentation_reliability || {};

  const issues =
    Array.isArray(result?.issues)
      ? result.issues
      : Array.isArray(
          result?.explainability?.issues
        )
        ? result.explainability.issues
        : [];

  const recommendations =
    normalizeRecommendations(result);

  const probabilities =
    prediction?.probabilities || {};

  const features =
    result?.raw_features || {};

  const outputs =
    result?.output_files || {};

  const resultImage =
    preview || assetUrl(outputs?.preprocessing?.skew_corrected);
  const resultImageCaption = preview
    ? t('results.uploaded')
    : t('results.skewCorrected');

  const debug =
    result?.debug || {};

  const explainability =
    result?.explainability || {};

  const feedbackStatus =
    normalizeFeedbackStatus(result);

  const feedbackAvailable =
    feedbackStatus === 'AVAILABLE'
    || feedbackStatus === 'PARTIAL'
    || explainability?.available === true;

  const partialFeedback =
    feedbackStatus === 'PARTIAL'
    || explainability?.partial_feedback === true;

  const feedbackMessage =
    feedbackCopy(
      feedbackStatus,
      t
    );

  const statusInfo =
    friendlyStatus(
      result,
      language
    );

  const reviewRecommended =
    Boolean(
      prediction?.low_confidence ?? prediction?.review_recommended
    );

  const confidence = prediction?.confidence != null
    ? Number(prediction.confidence)
    : null;

  const topProbability =
    Object.entries(
      probabilities
    ).sort(
      (a, b) =>
        Number(b[1])
        - Number(a[1])
    );


  /* =======================================================
     NON-COMPLETED RESULT
     ======================================================= */

  if (status !== 'COMPLETED') {
    const isModelError =
      status === 'MODEL_ERROR';



    return (
      <div className="results-page page-stack gc hw hw-kids-results">

        <ResultTopbar
          navigate={navigate}
          id={
            result.analysis_id || id
          }
          t={t}
        />


        <section
          className={
            `kid-result-hero quality-result-hero hw-result-header tone-${
              statusInfo?.tone || 'retake'
            }`
          }
        >

          <div className="kid-result-copy">

            <span className="eyebrow">
              {t('results.yourCheck')}
            </span>

            <h2>
              {
                statusInfo?.title
                || t('results.tryAgain')
              }
            </h2>

            <p>
              {statusInfo?.text}
            </p>

            <div className="result-action-row">

              <button
                className="primary-action"
                onClick={() =>
                  navigate('/analyze')
                }
              >

                <RefreshCcw size={17} />

                {
                  isModelError
                    ? t('results.tryAgain')
                    : t('results.retake')
                }

              </button>

            </div>

          </div>


          <div className="hw-result-visuals hw-result-visuals-kids">
            <div className="kid-result-mascot" aria-hidden="true">📷</div>
            {resultImage && (
          <ResultPhoto src={resultImage} caption={resultImageCaption} t={t} />
        )}
          </div>

        </section>


        <section className="hw-capture-help">
          <Camera size={28} aria-hidden="true" />
          <div><h3>{t('results.captureHelpTitle')}</h3><p>{t('results.captureHelpText')}</p></div>
        </section>

        <TechnicalDetails
          result={result}
          preview={preview}
          validation={validation}
          segmentation={segmentation}
          prediction={prediction}
          topProbability={
            topProbability
          }
          features={features}
          outputs={outputs}
          debug={debug}
          issues={issues}
          explainability={
            explainability
          }
          feedbackStatus={
            feedbackStatus
          }
          uiLanguage={language}
          t={t}
        />

      </div>
    );
  }


  /* =======================================================
     COMPLETED RESULT
     ======================================================= */

  const rawDisplayLabel =
    finalModelLabel;

  const displayLabel =
    qualityLabelText(
      rawDisplayLabel,
      language
    )
    || t('home.completed');

  const skills = skillFeedbackStates(result, issues, explainability);
  const severityOrder = { high: 3, medium: 2, low: 1 };
  const trusted = feedbackAvailable ? issues.filter(issue => trustworthyIssue(issue, result, explainability))
    .sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)) : [];
  const distinct = trusted.filter((issue, index, all) => all.findIndex(other => normalizeIssueType(other) === normalizeIssueType(issue)) === index);
  const practiceItems = distinct.slice(0, 2).map(issue => {
    const type = normalizeIssueType(issue);
    const copy = localizedRecommendation(type, language);
    const item = [...recommendations.priority, ...recommendations.normal]
      .find(candidate => normalizeIssueType({ issue_type: candidate.issueType }) === type);
    const focus = type === 'word_spacing' ? 'spacing' : type;
    return { focus, title: copy.title, text: copy.text, personalized: true, source: item };
  });
  const primaryPractice = practiceItems[0] || { focus: 'general', title: t('results.generalPracticeTitle'), text: t('results.generalPracticeText'), personalized: false };
  const primaryFocus = primaryPractice.focus;
  const visibleIssues = feedbackAvailable ? issues.slice(0, 3) : [];
  const gradePalette = {
    good: { ink: '#1f7a3f', soft: '#e3f3e6' },
    'above-average': { ink: '#946b00', soft: '#fff7d6' },
    average: { ink: '#b64e0b', soft: '#fff0e2' },
    'below-average': { ink: '#b64e0b', soft: '#fff0e2' },
    poor: { ink: '#b52d32', soft: '#fff0ef' },
  }[tone] || { ink: '#365b50', soft: '#edf4ef' };
  const GradeIcon = tone === 'good' ? Star
    : tone === 'above-average' ? Sparkles
      : tone === 'average' ? Sprout
        : tone === 'below-average' ? Pencil : Target;
  const visualIcon = tone === 'good'
    ? /^(excellent|very good)$/i.test(String(rawDisplayLabel || '').trim()) ? '🌟' : '⭐'
    : tone === 'above-average' ? '✨'
      : tone === 'average' ? '🌱'
        : tone === 'below-average' ? '✏️' : '💪';


  return (
    <div className="results-page page-stack gc hw hw-kids-results">

      <ResultTopbar
        navigate={navigate}
        id={
          result.analysis_id || id
        }
        t={t}
      />


      {/* ===================================================
          RESULT HERO
          =================================================== */}

      <section
        className={
          `kid-result-hero ` +
          `quality-result-hero hw-result-header hw-quality-hero ` +
          `tone-${tone}`
        }
      >

        <div className="kid-result-copy">

          <span className="result-language">
            {
              languageName(
                result.language,
                language
              )
            }
          </span>

          <span className="eyebrow hw-grade-eyebrow" style={{ color: gradePalette.ink, backgroundColor: gradePalette.soft }}>
            {t(tone === 'good' ? 'results.effortChecked' : 'results.modelResult')}
          </span>

          <div className="hw-grade-heading" style={{ '--hw-grade-ink': gradePalette.ink, '--hw-grade-soft': gradePalette.soft }}>
            <span className="hw-grade-symbol" aria-hidden="true"><GradeIcon size={36} strokeWidth={2.3} /></span>
            <h2 className="hw-grade-label" style={{ color: gradePalette.ink, WebkitTextFillColor: gradePalette.ink }}>{displayLabel}</h2>
          </div>

          {reviewRecommended && (
            <div className="teacher-review-inline" role="alert">
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <strong><span aria-hidden="true">🧑‍🏫 </span>{t('results.teacherReview')}</strong>
                <p>{t('results.teacherReviewText')}</p>
              </div>
            </div>
          )}

          <p className="child-quality-message">
            {t('results.heroEncouragement')}
          </p>

          <div className="result-action-row">
            <button type="button" className="primary-action" onClick={() => navigate('/practice', { state: { focus: primaryFocus, language: result.language } })}>
              <Pencil size={20} aria-hidden="true" />{t('results.practice')}<ArrowRight size={20} aria-hidden="true" />
            </button>
          </div>

        </div>


        <div className="hw-result-visuals hw-result-visuals-kids">
          <div className="kid-result-mascot quality-mascot" aria-hidden="true">{visualIcon}</div>
          {resultImage && (
          <ResultPhoto src={resultImage} caption={resultImageCaption} t={t} />
        )}
        </div>
      </section>


      <SkillFeedbackCards skills={skills} language={result.language} t={t} />

      {(!feedbackAvailable || partialFeedback) && (
        <div className="hw-feedback-note" role="note"><Info size={18} aria-hidden="true" /><p>{t(feedbackAvailable ? 'results.skillPartialNote' : 'results.skillUnavailableNote')}</p></div>
      )}

      {visibleIssues.length > 0 && (
        <section className="result-card child-card child-issues-card">
          <div className="card-heading-row">
            <div>
              <span className="eyebrow">{t('results.whatINoticed')}</span>
              <h3>{t('results.workOnFirst')}</h3>
            </div>
            <span className="count-badge">{visibleIssues.length}</span>
          </div>
          <ChildIssueList
            issues={visibleIssues}
            recommendations={recommendations}
            analysisLanguage={result.language}
            uiLanguage={language}
            navigate={navigate}
            t={t}
          />
        </section>
      )}

      <FocusPracticeCard focus={primaryPractice} secondary={practiceItems[1]} language={result.language} navigate={navigate} t={t} />
      <EffortBadges t={t} />

      {/* ===================================================
          TECHNICAL DETAILS
          =================================================== */}

      <TechnicalDetails
        result={result}
        preview={preview}
        validation={validation}
        segmentation={segmentation}
        prediction={prediction}
        topProbability={
          topProbability
        }
        features={features}
        outputs={outputs}
        debug={debug}
        issues={issues}
        explainability={
          explainability
        }
        feedbackStatus={
          feedbackStatus
        }
        uiLanguage={language}
        t={t}
      />

    </div>
  );
}


/* =========================================================
   TOP BAR
   ========================================================= */

function ResultTopbar({
  navigate,
  id,
  t,
}) {
  return (
    <div
      className={
        "results-topbar " +
        "results-topbar-with-language"
      }
    >

      <button
        onClick={() =>
          navigate('/analyze')
        }
      >

        <ArrowLeft size={19} />

        {t('results.newCheck')}

      </button>


      <div className="results-topbar-right">

        <span className="analysis-id">
          {
            t(
              'results.checkId',
              { id }
            )
          }
        </span>

        <LanguageToggle
          compact
        />

      </div>

    </div>
  );
}


/* =========================================================
   CHILD ISSUE LIST
   ========================================================= */

function ChildIssueList({
  issues,
  recommendations,
  analysisLanguage,
  uiLanguage,
  navigate,
  t,
}) {
  return (
    <div className="child-issue-list">

      {
        issues.map(
          (issue, index) => {

            const issueType =
              normalizeIssueType(issue);

            const copy =
              childIssueCopy(
                issueType,
                t
              );

            const recommendation =
              recommendationForIssue(
                issue,
                recommendations
              );

            const practiceFocus =
              recommendation?.practiceFocus
              || issueType
              || 'general';

            const recommendationCopy =
              recommendation
                ? localizedRecommendation(
                    recommendation.issueType,
                    uiLanguage,
                    recommendation.childTitle
                      || recommendation.title,
                    recommendation.text
                  )
                : null;


            return (
              <article
                className={
                  `child-issue-card ` +
                  `severity-${
                    issue?.severity || 'low'
                  }`
                }
                key={
                  `${
                    issue?.feature
                    || issueType
                  }-${index}`
                }
              >

                <div className="child-issue-icon">
                  {
                    childIssueIcon(
                      issueType
                    )
                  }
                </div>


                <div className="child-issue-copy">

                  <h4>
                    {copy.title}
                  </h4>

                  <p>
                    {copy.text}
                  </p>


                  {
                    recommendation && (
                      <div className="child-try-this">

                        <strong>
                          {t('results.tryThis')}
                        </strong>

                        <p>
                          {
                            recommendationCopy?.text
                            || recommendation.text
                          }
                        </p>

                      </div>
                    )
                  }

                </div>


                <button
                  className="issue-practice-button"
                  onClick={() =>
                    navigate(
                      '/practice',
                      {
                        state: {
                          focus:
                            practiceFocus,
                          language:
                            analysisLanguage,
                        },
                      }
                    )
                  }
                >
                  {t('results.practice')}
                </button>

              </article>
            );
          }
        )
      }

    </div>
  );
}


/* =========================================================
   PRIORITY RECOMMENDATIONS
   ========================================================= */

function PriorityRecommendationList({
  items,
  analysisLanguage,
  uiLanguage,
  navigate,
  t,
}) {
  return (
    <div className="kid-recommendation-list">

      {
        items
          .slice(0, 3)
          .map(
            (item, index) => {

              const copy =
                localizedRecommendation(
                  item.issueType,
                  uiLanguage,
                  item.childTitle
                    || item.title,
                  item.text
                );


              return (
                <article
                  className={
                    `kid-recommendation ` +
                    `priority-recommendation ` +
                    `severity-${
                      item.severity || 'low'
                    }`
                  }
                  key={item.id}
                >

                  <span
                    className="recommendation-number"
                  >
                    {index + 1}
                  </span>


                  <div>

                    <div
                      className={
                        "recommendation-title-row"
                      }
                    >

                      <h4>
                        {
                          item.childTitle
                          || copy.title
                        }
                      </h4>

                    </div>


                    <p>
                      {copy.text}
                    </p>

                  </div>


                  <button
                    onClick={() =>
                      navigate(
                        '/practice',
                        {
                          state: {
                            focus:
                              item.practiceFocus
                              || item.issueType,
                            language:
                              analysisLanguage,
                          },
                        }
                      )
                    }
                  >
                    {t('results.practice')}
                  </button>

                </article>
              );
            }
          )
      }

    </div>
  );
}


/* =========================================================
   NORMAL RECOMMENDATIONS
   ========================================================= */

function NormalRecommendationList({
  items,
  analysisLanguage,
  uiLanguage,
  navigate,
  t,
}) {
  if (!items?.length) {
    return null;
  }

  return (
    <div className="normal-recommendation-list">

      {
        items
          .slice(0, 2)
          .map(
            (item, index) => {

              const copy =
                localizedRecommendation(
                  item.issueType,
                  uiLanguage,
                  item.childTitle
                    || item.title,
                  item.text
                );


              return (
                <article
                  className="normal-recommendation"
                  key={item.id}
                >

                  <span
                    className="normal-tip-icon"
                  >
                    {index + 1}
                  </span>


                  <div>

                    <h4>
                      {
                        item.childTitle
                        || copy.title
                        || t('results.extraTip')
                      }
                    </h4>

                    <p>
                      {copy.text}
                    </p>

                  </div>


                  <button
                    onClick={() =>
                      navigate(
                        '/practice',
                        {
                          state: {
                            focus:
                              item.practiceFocus
                              || item.issueType,
                            language:
                              analysisLanguage,
                          },
                        }
                      )
                    }
                  >
                    {t('results.tryIt')}
                  </button>

                </article>
              );
            }
          )
      }

    </div>
  );
}


/* =========================================================
   TECHNICAL DETAILS
   ========================================================= */

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
  explainability = {},
  feedbackStatus,
  uiLanguage,
  t,
}) {
  const rawModelLabel =
    qualityLabel(result)
    || prediction?.label
    || mostLikelyLabel(result);

  const suppressedFeatures =
    explainability?.suppressed_features
    || [];

  const softWarnings =
    explainability?.soft_warning_features
    || [];

  const missingFeatures =
    explainability?.missing_features
    || [];


  return (
    <details className="technical-details">

      <summary>

        <span>

          <Info size={18} />

          {t('results.teacherDetails')}

        </span>

        <ChevronDown size={18} />

      </summary>


      <div className="technical-details-body">

        {/* =================================================
            TEACHER STATS
            ================================================= */}

        <div className="teacher-stat-grid">

          <div>

            <span>
              {t('results.analysisStatus')}
            </span>

            <strong>
              {
                result?.analysis_status
                || '—'
              }
            </strong>

          </div>


          <div>

            <span>
              {t('results.feedbackStatus')}
            </span>

            <strong>
              {feedbackStatus || '—'}
            </strong>

          </div>


          <div>

            <span>
              {t('results.confidence')}
            </span>

            <strong>

              {
                prediction?.confidence != null &&
                Number.isFinite(Number(prediction.confidence))
                  ? `${
                      formatNumber(
                        prediction.confidence,
                        1
                      )
                    }%`
                  : '—'
              }

            </strong>

          </div>


          <div>

            <span>
              {t('results.modelClass')}
            </span>

            <strong>

              {
                rawModelLabel
                  ? qualityLabelText(
                      rawModelLabel,
                      uiLanguage
                    )
                  : '—'
              }

            </strong>

          </div>


          <div>

            <span>
              {t('results.review')}
            </span>

            <strong>

              {
                prediction?.review_recommended
                  ? t(
                      'results.recommended'
                    )
                  : t(
                      'results.notRequired'
                    )
              }

            </strong>

          </div>


          <div>

            <span>
              {t('results.lines')}
            </span>

            <strong>
              {
                debug?.line_count
                ?? '—'
              }
            </strong>

          </div>


          <div>

            <span>
              {t('results.words')}
            </span>

            <strong>
              {
                debug?.word_count
                ?? '—'
              }
            </strong>

          </div>


          <div>

            <span>
              {t('results.characters')}
            </span>

            <strong>
              {
                debug?.character_region_count
                ?? '—'
              }
            </strong>

          </div>


          <div>

            <span>
              {t('results.segGate')}
            </span>

            <strong>
              {
                segmentation?.status
                || '—'
              }
            </strong>

          </div>

        </div>


        {/* =================================================
            PROBABILITIES
            ================================================= */}

        {
          topProbability?.length > 0 && (
            <section
              className="teacher-subsection"
            >

              <h4>
                {t('results.probabilities')}
              </h4>


              <div className="probability-list">

                {
                  topProbability.map(
                    ([name, value]) => (
                      <div
                        className="probability-row"
                        key={name}
                      >

                        <div
                          className={
                            "probability-label"
                          }
                        >

                          <span>
                            {
                              qualityLabelText(
                                name,
                                uiLanguage
                              )
                            }
                          </span>

                          <strong>
                            {
                              Number(value)
                                .toFixed(1)
                            }%
                          </strong>

                        </div>


                        <div
                          className={
                            "probability-track"
                          }
                        >

                          <div
                            className={
                              `probability-fill ` +
                              `tone-${
                                resultQualityTone(name)
                              }`
                            }
                            style={{
                              width:
                                `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    Number(value)
                                  )
                                )}%`,
                            }}
                          />

                        </div>

                      </div>
                    )
                  )
                }

              </div>

            </section>
          )
        }


        {/* =================================================
            ISSUE EXPLANATIONS
            ================================================= */}

        {
          issues.length > 0 && (
            <section
              className="teacher-subsection"
            >

              <h4>
                {t('results.issueExplanations')}
              </h4>


              <div className="issue-list">

                {
                  issues.map(
                    (issue, index) => {

                      const issueType =
                        normalizeIssueType(
                          issue
                        );

                      const childCopy =
                        childIssueCopy(
                          issueType,
                          t
                        );


                      return (
                        <div
                          className={
                            `issue-item ` +
                            `${toneForSeverity(
                              issue.severity
                            )}`
                          }
                          key={
                            `${
                              issue.feature
                              || issue.type
                            }-${index}`
                          }
                        >

                          <div
                            className="issue-severity"
                          >
                            {
                              severityText(
                                issue.severity,
                                uiLanguage
                              )
                            }
                          </div>


                          <div>

                            <h4>
                              {
                                childCopy.title
                                || featureNameText(
                                  issue.feature
                                  || issue.type,
                                  uiLanguage
                                )
                              }
                            </h4>


                            {/* IMPORTANT:
                                Do NOT show backend
                                English message.
                            */}

                            <p>
                              {
                                childCopy.text
                              }
                            </p>


                            <small>

                              {
                                issue.feature
                                  ? `${featureNameText(
                                      issue.feature,
                                      uiLanguage
                                    )}: ${
                                      formatNumber(
                                        issue.value
                                      )
                                    }`
                                  : ''
                              }

                            </small>


                            <div
                              className={
                                "teacher-issue-meta"
                              }
                            >

                              <small>
                                {
                                  t(
                                    'results.reliability'
                                  )
                                }:{' '}
                                {
                                  issue.reliability
                                  || 'unknown'
                                }
                              </small>


                              {
                                Number.isFinite(
                                  Number(
                                    issue
                                      .spearman_teacher_correlation
                                  )
                                ) && (
                                  <small>

                                    {
                                      t(
                                        'results.teacherCorrelation'
                                      )
                                    }:{' '}

                                    {
                                      formatNumber(
                                        issue
                                          .spearman_teacher_correlation,
                                        3
                                      )
                                    }

                                  </small>
                                )
                              }


                              <small>

                                {
                                  t(
                                    'results.thresholdSource'
                                  )
                                }:{' '}

                                {
                                  issue.threshold_source
                                  || '—'
                                }

                              </small>

                            </div>

                          </div>

                        </div>
                      );
                    }
                  )
                }

              </div>

            </section>
          )
        }


        {/* =================================================
            EXPLAINABILITY DIAGNOSTICS
            ================================================= */}

        {
          (
            suppressedFeatures.length > 0
            || softWarnings.length > 0
            || missingFeatures.length > 0
          ) && (
            <section
              className="teacher-subsection"
            >

              <h4>
                {
                  t(
                    'results.explainabilityDiagnostics'
                  )
                }
              </h4>


              <div className="feature-table">

                <div className="feature-row">

                  <span>
                    {
                      t(
                        'results.suppressedFeatures'
                      )
                    }
                  </span>

                  <strong>
                    {suppressedFeatures.length}
                  </strong>

                </div>


                <div className="feature-row">

                  <span>
                    {
                      t(
                        'results.softWarningFeatures'
                      )
                    }
                  </span>

                  <strong>
                    {softWarnings.length}
                  </strong>

                </div>


                <div className="feature-row">

                  <span>
                    {
                      t(
                        'results.missingFeatures'
                      )
                    }
                  </span>

                  <strong>
                    {missingFeatures.length}
                  </strong>

                </div>

              </div>

            </section>
          )
        }


        {/* =================================================
            INPUT MEASUREMENTS
            ================================================= */}

        {
          Object.keys(
            validation?.features || {}
          ).length > 0 && (
            <section
              className="teacher-subsection"
            >

              <h4>
                {t('results.inputMeasurements')}
              </h4>


              <div className="feature-table">

                {
                  Object.entries(
                    validation.features
                  ).map(
                    ([name, value]) => (
                      <div
                        className="feature-row"
                        key={name}
                      >

                        <span>
                          {
                            featureNameText(
                              name,
                              uiLanguage
                            )
                          }
                        </span>

                        <strong>
                          {
                            formatNumber(
                              value
                            )
                          }
                        </strong>

                      </div>
                    )
                  )
                }

              </div>

            </section>
          )
        }


        {/* =================================================
            STRUCTURAL FEATURES
            ================================================= */}

        {
          Object.keys(
            features || {}
          ).length > 0 && (
            <section
              className="teacher-subsection"
            >

              <h4>
                {t('results.structuralFeatures')}
              </h4>


              <div className="feature-grid">

                {
                  Object.entries(
                    features
                  ).map(
                    ([name, value]) => (
                      <div
                        className="feature-tile"
                        key={name}
                      >

                        <span>
                          {
                            featureNameText(
                              name,
                              uiLanguage
                            )
                          }
                        </span>

                        <strong>
                          {
                            formatNumber(
                              value
                            )
                          }
                        </strong>

                      </div>
                    )
                  )
                }

              </div>

            </section>
          )
        }


        {/* =================================================
            OUTPUT GALLERY
            ================================================= */}

        <OutputGallery
          outputs={outputs}
          preview={preview}
          t={t}
        />

      </div>

    </details>
  );
}


/* =========================================================
   OUTPUT GALLERY
   ========================================================= */

function OutputGallery({
  outputs,
  preview,
  t,
}) {
  const segmentation =
    outputs?.segmentation || {};

  const preprocessing =
    outputs?.preprocessing || {};


  const items = [

    preview
      ? [
          t('results.uploaded'),
          preview,
          true,
        ]
      : null,


    preprocessing?.skew_corrected
      ? [
          t('results.skewCorrected'),
          preprocessing.skew_corrected,
        ]
      : null,


    preprocessing?.shadow_removed
      ? [
          t('results.shadowRemoved'),
          preprocessing.shadow_removed,
        ]
      : null,


    preprocessing?.contrast_enhanced
      ? [
          t('results.contrastEnhanced'),
          preprocessing.contrast_enhanced,
        ]
      : null,


    preprocessing?.binary
      ? [
          t('results.binarized'),
          preprocessing.binary,
        ]
      : null,


    preprocessing?.ruled_lines_removed
      ? [
          t('results.ruledRemoved'),
          preprocessing.ruled_lines_removed,
        ]
      : null,


    segmentation?.line_overlay
      || outputs?.line_debug
      ? [
          t('results.lineSeg'),
          segmentation?.line_overlay
          || outputs?.line_debug,
        ]
      : null,


    segmentation?.word_overlay
      || outputs?.word_debug
      ? [
          t('results.wordSeg'),
          segmentation?.word_overlay
          || outputs?.word_debug,
        ]
      : null,


    segmentation?.character_overlay
      || outputs?.character_debug
      ? [
          t('results.charSeg'),
          segmentation?.character_overlay
          || outputs?.character_debug,
        ]
      : null,


    segmentation?.combined_overlay
      ? [
          t('results.combinedSeg'),
          segmentation.combined_overlay,
        ]
      : null,

  ].filter(Boolean);


  if (!items.length) {
    return null;
  }


  return (
    <section
      className="teacher-subsection"
    >

      <h4>
        {t('results.processingOutputs')}
      </h4>


      <div className="output-gallery">

        {
          items.map(
            ([
              title,
              path,
              alreadyResolved,
            ]) => {

              const src =
                alreadyResolved
                  ? path
                  : assetUrl(path);


              return (
                <figure
                  key={title}
                >

                  <div
                    className="output-image"
                  >

                    <img
                      src={src}
                      alt={title}
                    />

                  </div>


                  <figcaption>
                    {title}
                  </figcaption>

                </figure>
              );
            }
          )
        }

      </div>

    </section>
  );
}
