import { localeFor, qualityLabelText, translate } from '../i18n/translations';

export const labelRank = {
  Poor: 1,
  'Below Average': 2,
  Average: 3,
  Good: 4,
  'Very Good': 5,
};

export function resultPercent(result) {
  const fromModel = result?.quality_prediction?.display_score_percent;
  if (Number.isFinite(Number(fromModel))) {
    return Math.max(0, Math.min(100, Number(fromModel)));
  }
  return null;
}

export function formatNumber(value, digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toFixed(digits);
}

export function prettyFeatureName(name = '') {
  return String(name)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDate(dateValue, language = 'sinhala') {
  const date = dateValue ? new Date(dateValue) : new Date();
  return new Intl.DateTimeFormat(localeFor(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function stageStatus(result) {
  return result?.input_validation?.status || result?.analysis_status || 'Unknown';
}

export function qualityLabel(result) {
  const reported =
    result?.quality_prediction?.reported_label ||
    result?.quality_prediction?.final_label ||
    result?.ml_prediction?.reported_label ||
    result?.ml_prediction?.label ||
    null;

  if (reported && reported !== 'Needs Teacher Review') return reported;
  return null;
}

export function mostLikelyLabel(result) {
  return (
    result?.quality_prediction?.most_likely_label ||
    result?.quality_prediction?.predicted_label ||
    result?.ml_prediction?.most_likely_label ||
    result?.ml_prediction?.label ||
    null
  );
}

export function analysisStatus(result) {
  const reportedStatus = result?.analysis_status;
  const label = qualityLabel(result);

  // Low confidence is advisory only when the model still returned a label.
  if (reportedStatus === 'NEEDS_TEACHER_REVIEW' && label) return 'COMPLETED';
  if (reportedStatus) return reportedStatus;
  if (result?.input_validation?.valid_for_stage2 === false) return 'INPUT_RETAKE_REQUIRED';
  if (label) return 'COMPLETED';
  return 'UNKNOWN';
}

export function isAcceptedQualityResult(result) {
  const status = analysisStatus(result);
  const prediction = result?.quality_prediction || {};
  return (
    status === 'COMPLETED' &&
    prediction?.accepted !== false &&
    Boolean(qualityLabel(result))
  );
}

export function qualityTone(label = '') {
  switch (label) {
    case 'Very Good':
    case 'Good':
      return 'good';
    case 'Average':
      return 'average';
    case 'Below Average':
      return 'below-average';
    case 'Poor':
      return 'poor';
    default:
      return 'neutral';
  }
}

export function qualityMessage(label = '', language = 'sinhala') {
  switch (label) {
    case 'Very Good':
      return { title: translate(language, 'quality.veryGoodTitle'), text: translate(language, 'quality.veryGoodText') };
    case 'Good':
      return { title: translate(language, 'quality.goodTitle'), text: translate(language, 'quality.goodText') };
    case 'Average':
      return { title: translate(language, 'quality.averageTitle'), text: translate(language, 'quality.averageText') };
    case 'Below Average':
      return { title: translate(language, 'quality.belowTitle'), text: translate(language, 'quality.belowText') };
    case 'Poor':
      return { title: translate(language, 'quality.poorTitle'), text: translate(language, 'quality.poorText') };
    default:
      return { title: translate(language, 'quality.defaultTitle'), text: translate(language, 'quality.defaultText') };
  }
}

export function friendlyStatus(result, language = 'sinhala') {
  const status = analysisStatus(result);
  if (status === 'NEEDS_TEACHER_REVIEW') {
    return { tone: 'review', title: translate(language, 'status.reviewTitle'), text: translate(language, 'status.reviewText') };
  }
  if (status === 'SEGMENTATION_UNRELIABLE') {
    return { tone: 'retake', title: translate(language, 'status.segTitle'), text: translate(language, 'status.segText') };
  }
  if (status === 'INPUT_RETAKE_REQUIRED') {
    return { tone: 'retake', title: translate(language, 'status.inputTitle'), text: translate(language, 'status.inputText') };
  }
  if (status === 'MODEL_ERROR') {
    return { tone: 'retake', title: translate(language, 'status.errorTitle'), text: translate(language, 'status.errorText') };
  }
  return null;
}

export { qualityLabelText };
