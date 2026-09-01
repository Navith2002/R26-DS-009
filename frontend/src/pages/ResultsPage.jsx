import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
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

export default function ResultsPage() {
  const { id } = useParams();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const {
    history,
    latestResult,
    language,
    t,
  } = useApp();

  const result =
    location.state?.result
    ||
    (
      latestResult?.analysis_id === id
        ? latestResult
        : null
    )
    ||
    history.find(
      (item) => item.id === id
    );

  const preview =
    location.state?.preview;


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
    qualityTone(finalModelLabel);

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
      prediction?.review_recommended
    );

  const confidence =
    Number(
      prediction?.confidence
    );

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

    const reasons =
      status === 'SEGMENTATION_UNRELIABLE'
        ? (
            segmentation.reasons
            || segmentation.warnings
            || []
          )
        : (
            validation.reasons
            || []
          );

    const retryRecommendations = [
      ...recommendations.priority,
      ...recommendations.normal,
    ].slice(0, 2);

    return (
      <div className="results-page page-stack">

        <ResultTopbar
          navigate={navigate}
          id={
            result.analysis_id || id
          }
          t={t}
        />


        <section
          className={
            `kid-result-hero tone-${
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


          <div
            className="kid-result-mascot"
            aria-hidden="true"
          >
            📷
          </div>

        </section>


        {
          reasons.length > 0 && (
            <section
              className="result-card child-card"
            >

              <div className="card-heading-row">

                <div>

                  <span className="eyebrow">
                    {t('results.photoTips')}
                  </span>

                  <h3>
                    {t('results.whatFix')}
                  </h3>

                </div>

              </div>


              <div className="friendly-reason-grid">

                {
                  reasons
                    .slice(0, 4)
                    .map(
                      (reason, index) => (
                        <div
                          className="friendly-reason"
                          key={
                            `${reason}-${index}`
                          }
                        >

                          <AlertTriangle
                            size={17}
                          />

                          <span>
                            {
                              childReason(
                                reason,
                                t
                              )
                            }
                          </span>

                        </div>
                      )
                    )
                }

              </div>

            </section>
          )
        }


        {
          retryRecommendations.length > 0 && (
            <section
              className={
                "result-card " +
                "recommendation-card " +
                "child-card"
              }
            >

              <div className="card-heading-row">

                <div>

                  <span className="eyebrow">
                    {t('results.nextPhoto')}
                  </span>

                  <h3>
                    {t('results.helpfulTips')}
                  </h3>

                </div>

                <Sparkles size={22} />

              </div>


              <NormalRecommendationList
                items={
                  retryRecommendations
                }
                analysisLanguage={
                  result.language
                }
                uiLanguage={language}
                navigate={navigate}
                t={t}
              />

            </section>
          )
        }


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

  const childQuality =
    childQualityCopy(
      rawDisplayLabel,
      t
    );

  const displayLabel =
    qualityLabelText(
      rawDisplayLabel,
      language
    )
    || t('home.completed');

  const firstPractice =
    recommendations.priority[0];

  const primaryFocus =
    firstPractice?.practiceFocus
    || firstPractice?.issueType
    || normalizeIssueType(issues[0])
    || 'general';

  const visibleIssues =
    issues.slice(0, 3);


  return (
    <div className="results-page page-stack">

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
          `quality-result-hero ` +
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

          <span className="eyebrow">
            {t('results.modelResult')}
          </span>

          <h2>
            {childQuality.title}
          </h2>

          <p className="child-quality-message">
            {childQuality.text}
          </p>


          {/* IMPORTANT:
              Translation comes from Translation.js
          */}

          <div className="child-model-level">

            <span>
              {t('results.handwritingLevel')}
            </span>

            <strong>
              {displayLabel}
            </strong>

          </div>


          {
            reviewRecommended && (
              <div
                className="teacher-review-inline"
                role="note"
              >

                <span>
                  🧑‍🏫
                </span>

                <div>

                  <strong>
                    {t('results.teacherReview')}
                  </strong>

                </div>

              </div>
            )
          }


          {
            (
              visibleIssues.length > 0
              ||
              recommendations.priority.length > 0
            ) && (
              <div className="result-action-row">

                <button
                  className="primary-action"
                  onClick={() =>
                    navigate(
                      '/practice',
                      {
                        state: {
                          focus:
                            primaryFocus,
                          language:
                            result.language,
                        },
                      }
                    )
                  }
                >

                  <Sparkles size={17} />

                  {t('results.topTip')}

                </button>

              </div>
            )
          }

        </div>


        <div
          className={
            "kid-result-mascot " +
            "quality-mascot"
          }
          aria-hidden="true"
        >

          {
            String(
              rawDisplayLabel || ''
            ).toLowerCase() === 'very good'
              ? '🌟'
              : String(
                  rawDisplayLabel || ''
                ).toLowerCase() === 'good'
                ? '⭐'
                : String(
                    rawDisplayLabel || ''
                  ).toLowerCase() === 'average'
                  ? '🌱'
                  : String(
                      rawDisplayLabel || ''
                    ).toLowerCase() ===
                    'below average'
                    ? '✏️'
                    : '💪'
          }

        </div>

      </section>


      {/* ===================================================
          CHILD RESULTS
          =================================================== */}

      <div
        className={
          "child-results-grid " +
          "single-result-column"
        }
      >


        {/* =================================================
            FEEDBACK UNAVAILABLE
            ================================================= */}

        {
          !feedbackAvailable && (
            <section
              className={
                "result-card " +
                "child-card " +
                "feedback-unavailable-card"
              }
            >

              <div className="feedback-state-row">

                <Info size={24} />

                <div>

                  <h3>
                    {feedbackMessage.title}
                  </h3>

                  <p>
                    {feedbackMessage.text}
                  </p>

                </div>

              </div>

            </section>
          )
        }


        {/* =================================================
            PARTIAL FEEDBACK
            ================================================= */}

        {
          feedbackAvailable
          && partialFeedback
          && (
            <section
              className={
                "result-card " +
                "child-card " +
                "partial-feedback-card"
              }
            >

              <div className="feedback-state-row">

                <Sparkles size={23} />

                <div>

                  <h3>
                    {
                      feedbackCopy(
                        'PARTIAL',
                        t
                      ).title
                    }
                  </h3>

                  <p>
                    {
                      feedbackCopy(
                        'PARTIAL',
                        t
                      ).text
                    }
                  </p>

                </div>

              </div>

            </section>
          )
        }


        {/* =================================================
            ISSUES
            ================================================= */}

        {
          feedbackAvailable
          && visibleIssues.length > 0
          && (
            <section
              className={
                "result-card " +
                "child-card " +
                "child-issues-card"
              }
            >

              <div className="card-heading-row">

                <div>

                  <span className="eyebrow">
                    {t('results.whatINoticed')}
                  </span>

                  <h3>
                    {t('results.workOnFirst')}
                  </h3>

                </div>

                <span className="count-badge">
                  {visibleIssues.length}
                </span>

              </div>


              <ChildIssueList
                issues={visibleIssues}
                recommendations={
                  recommendations
                }
                analysisLanguage={
                  result.language
                }
                uiLanguage={language}
                navigate={navigate}
                t={t}
              />

            </section>
          )
        }


        {/* =================================================
            NO ISSUES
            ================================================= */}

        {
          feedbackAvailable
          && visibleIssues.length === 0
          && (
            <section
              className="result-card child-card"
            >

              <div className="positive-state">

                <CheckCircle2
                  size={28}
                />

                <div>

                  <h4>
                    {t('results.noIssueTitle')}
                  </h4>

                  <p>
                    {t('results.noIssueText')}
                  </p>

                </div>

              </div>

            </section>
          )
        }


        {/* =================================================
            RECOMMENDATIONS
            ================================================= */}

        {
          feedbackAvailable
          && recommendations.priority.length > 0
          && visibleIssues.length === 0
          && (
            <section
              className={
                "result-card " +
                "child-card " +
                "recommendations-showcase"
              }
            >

              <div className="card-heading-row">

                <div>

                  <h3>
                    {t('results.planTitle')}
                  </h3>

                </div>

                <span className="count-badge">
                  {
                    recommendations
                      .priority.length
                  }
                </span>

              </div>


              <PriorityRecommendationList
                items={
                  recommendations.priority
                }
                analysisLanguage={
                  result.language
                }
                uiLanguage={language}
                navigate={navigate}
                t={t}
              />

            </section>
          )
        }

      </div>


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
                Number.isFinite(
                  Number(
                    prediction?.confidence
                  )
                )
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
                                qualityTone(name)
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