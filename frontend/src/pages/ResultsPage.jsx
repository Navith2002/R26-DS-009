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

function childIssueCopy(issueType, uiLanguage = 'en') {
  const copy = {
    en: {
      spacing: {
        title: 'Some word spaces are different',
        text: 'Some words are closer together and some are farther apart.',
      },
      word_spacing: {
        title: 'Some word spaces are different',
        text: 'Let’s try to leave a similar little space between each word.',
      },
      character_spacing: {
        title: 'Some characters need a little more space',
        text: 'Some characters are closer together or farther apart than others.',
      },
      baseline_alignment: {
        title: 'Some words move above and below the line',
        text: 'Let’s help the words sit nicely on the same writing line.',
      },
      local_baseline_drift: {
        title: 'The writing line moves up or down a little',
        text: 'Let’s try to keep each line moving straight across the page.',
      },
      size_variation: {
        title: 'Some characters are big and some are small',
        text: 'Let’s practise making similar characters about the same size.',
      },
      character_proportion: {
        title: 'Some character shapes look stretched or squashed',
        text: 'Let’s keep the height and width of similar characters more balanced.',
      },
      curve_smoothness: {
        title: 'Some curved parts are a little bumpy',
        text: 'Let’s make the curved parts slower and smoother.',
      },
      loop_roundness: {
        title: 'Some round shapes can be smoother',
        text: 'Let’s practise making the rounded parts clear and even.',
      },
      stroke_continuity: {
        title: 'Some strokes stop before they are finished',
        text: 'Let’s practise completing each stroke with one smooth movement.',
      },
      stroke_thickness: {
        title: 'Some strokes are thicker than others',
        text: 'Let’s use gentle, steady pencil pressure.',
      },
      density_distribution: {
        title: 'Some character parts look a little crowded',
        text: 'Let’s give every part of the character enough room.',
      },
      character_shape: {
        title: 'The same character changes shape a little',
        text: 'Let’s practise making the same character look similar each time.',
      },
      upper_lower_balance: {
        title: 'Some characters need better top-and-bottom balance',
        text: 'Let’s keep the upper and lower parts more even.',
      },
      slant: {
        title: 'Some characters lean in different directions',
        text: 'Let’s try to keep the writing direction more consistent.',
      },
      general: {
        title: 'Here is one small thing to practise',
        text: 'Take it slowly and work on one small improvement at a time.',
      },
    },

    si: {
      spacing: {
        title: 'වචන අතර ඉඩ ටිකක් වෙනස්',
        text: 'සමහර වචන ළඟින් තියෙනවා, සමහර වචන ටිකක් ඈතින් තියෙනවා.',
      },
      word_spacing: {
        title: 'වචන අතර ඉඩ ටිකක් වෙනස්',
        text: 'හැම වචනයක් අතරම සමාන පොඩි ඉඩක් තබමු.',
      },
      character_spacing: {
        title: 'සමහර අකුරු අතර ඉඩ ටිකක් වෙනස්',
        text: 'අකුරු එකිනෙකට වැඩිය ළඟ හෝ වැඩිය ඈත නොවෙන ලෙස ලියමු.',
      },
      baseline_alignment: {
        title: 'සමහර වචන පේළියට උඩට හෝ පහළට යනවා',
        text: 'වචන එකම ලියන පේළියේ තබාගෙන ලියන්න පුහුණු වෙමු.',
      },
      local_baseline_drift: {
        title: 'ලියන පේළිය ටිකක් උඩට හෝ පහළට යනවා',
        text: 'හැම පේළියක්ම කෙළින් ගෙන යන්න උත්සාහ කරමු.',
      },
      size_variation: {
        title: 'සමහර අකුරු ලොකුයි, සමහර අකුරු පොඩියි',
        text: 'සමාන අකුරු සමාන ප්‍රමාණයකින් ලියන්න පුහුණු වෙමු.',
      },
      character_proportion: {
        title: 'සමහර අකුරු දිගට හෝ පළලට වෙනස්',
        text: 'අකුරු වල උස සහ පළල සමාන ලෙස තබමු.',
      },
      curve_smoothness: {
        title: 'සමහර වක්‍ර කොටස් ටිකක් රළුයි',
        text: 'වක්‍ර කොටස් හෙමින් සහ මෘදු ලෙස ලියමු.',
      },
      loop_roundness: {
        title: 'වටකුරු කොටස් තවත් මෘදු කරමු',
        text: 'වට සහ ලූප් කොටස් පැහැදිලිව සමානව ලියන්න පුහුණු වෙමු.',
      },
      stroke_continuity: {
        title: 'සමහර රේඛා මැදින් නවතිනවා',
        text: 'එක් එක් රේඛාව එක මෘදු චලනයකින් අවසන් කරමු.',
      },
      stroke_thickness: {
        title: 'සමහර රේඛා වැඩිය ගැඹුරු හෝ තදයි',
        text: 'පැන්සලට සමාන මෘදු බලයක් දීලා ලියමු.',
      },
      density_distribution: {
        title: 'සමහර අකුරු ඇතුළේ කොටස් ටිකක් තදබදයි',
        text: 'අකුරේ හැම කොටසකටම ප්‍රමාණවත් ඉඩක් දෙමු.',
      },
      character_shape: {
        title: 'එකම අකුරේ හැඩය ටිකක් වෙනස් වෙනවා',
        text: 'එකම අකුර නැවත ලියන විට සමාන හැඩයක් තබමු.',
      },
      upper_lower_balance: {
        title: 'අකුරේ උඩ සහ යට කොටස් සමාන කරමු',
        text: 'උඩ සහ යට කොටස් හොඳින් සන්තුලිත කරමු.',
      },
      slant: {
        title: 'සමහර අකුරු වෙනස් දිශාවට නැමෙනවා',
        text: 'අකුරු සමාන දිශාවකට නැමෙන ලෙස ලියමු.',
      },
      general: {
        title: 'පුහුණු කරන්න පොඩි දෙයක් තියෙනවා',
        text: 'හෙමින් ලියලා එක පොඩි දියුණුවකට අවධානය දෙමු.',
      },
    },

    ta: {
      spacing: {
        title: 'சொற்களுக்கு இடையிலான இடைவெளி கொஞ்சம் மாறுகிறது',
        text: 'சில சொற்கள் அருகிலும் சில சொற்கள் அதிக இடைவெளியிலும் உள்ளன.',
      },
      word_spacing: {
        title: 'சொற்களுக்கு இடையிலான இடைவெளி கொஞ்சம் மாறுகிறது',
        text: 'ஒவ்வொரு சொல்லுக்கும் இடையில் ஒரே மாதிரியான சிறிய இடைவெளி விடுவோம்.',
      },
      character_spacing: {
        title: 'சில எழுத்துகளுக்கிடையிலான இடைவெளி மாறுகிறது',
        text: 'எழுத்துகள் மிகவும் அருகிலும் மிகவும் தூரமாகவும் இல்லாமல் எழுதிப் பழகுவோம்.',
      },
      baseline_alignment: {
        title: 'சில சொற்கள் வரிக்கு மேலே அல்லது கீழே செல்கின்றன',
        text: 'எல்லா சொற்களையும் ஒரே எழுதும் வரியில் வைத்துப் பயிற்சி செய்வோம்.',
      },
      local_baseline_drift: {
        title: 'எழுதும் வரி கொஞ்சம் மேலே அல்லது கீழே செல்கிறது',
        text: 'ஒவ்வொரு வரியையும் நேராகக் கொண்டு செல்ல முயற்சி செய்வோம்.',
      },
      size_variation: {
        title: 'சில எழுத்துகள் பெரியதாகவும் சில சிறியதாகவும் உள்ளன',
        text: 'ஒத்த எழுத்துகளை ஒரே அளவில் எழுதப் பயிற்சி செய்வோம்.',
      },
      character_proportion: {
        title: 'சில எழுத்துகள் நீளமாக அல்லது அகலமாக மாறுகின்றன',
        text: 'ஒத்த எழுத்துகளின் உயரமும் அகலமும் சமமாக இருக்க முயற்சி செய்வோம்.',
      },
      curve_smoothness: {
        title: 'சில வளைவுகள் கொஞ்சம் கரடுமுரடாக உள்ளன',
        text: 'வளைந்த பகுதிகளை மெதுவாகவும் மென்மையாகவும் எழுதிப் பழகுவோம்.',
      },
      loop_roundness: {
        title: 'சில வட்ட வடிவங்களை இன்னும் மென்மையாக்கலாம்',
        text: 'வட்ட மற்றும் வளைய பகுதிகளை தெளிவாக எழுதிப் பழகுவோம்.',
      },
      stroke_continuity: {
        title: 'சில கோடுகள் முடிவதற்கு முன் நிற்கின்றன',
        text: 'ஒவ்வொரு கோட்டையும் மென்மையான ஒரே இயக்கத்தில் முடிப்போம்.',
      },
      stroke_thickness: {
        title: 'சில கோடுகள் மற்றவற்றை விட தடிமனாக உள்ளன',
        text: 'பென்சிலில் மெதுவான ஒரே அழுத்தத்தைப் பயன்படுத்துவோம்.',
      },
      density_distribution: {
        title: 'சில எழுத்துகளின் உள்ளே இடம் நெருக்கமாக உள்ளது',
        text: 'எழுத்தின் ஒவ்வொரு பகுதிக்கும் போதுமான இடம் கொடுப்போம்.',
      },
      character_shape: {
        title: 'அதே எழுத்தின் வடிவம் கொஞ்சம் மாறுகிறது',
        text: 'அதே எழுத்தை ஒவ்வொரு முறையும் ஒரே மாதிரி எழுதிப் பழகுவோம்.',
      },
      upper_lower_balance: {
        title: 'எழுத்தின் மேல் மற்றும் கீழ் பகுதிகளை சமப்படுத்துவோம்',
        text: 'மேல் மற்றும் கீழ் பகுதிகளை சமமாக வைத்துப் பயிற்சி செய்வோம்.',
      },
      slant: {
        title: 'சில எழுத்துகள் வேறு திசையில் சாய்கின்றன',
        text: 'எழுத்துகளை ஒரே திசையில் சாய்த்துப் பழகுவோம்.',
      },
      general: {
        title: 'பயிற்சி செய்ய ஒரு சிறிய விஷயம் உள்ளது',
        text: 'மெதுவாக எழுதுங்கள்; ஒரு சிறிய முன்னேற்றத்தில் கவனம் செலுத்துங்கள்.',
      },
    },
  };

  const selected = copy[uiLanguage] || copy.en;
  return selected[issueType] || selected.general;
}

function childQualityCopy(label, uiLanguage = 'en') {
  const normalized = String(label || '').trim().toLowerCase();

  const copy = {
    en: {
      'very good': {
        title: 'Super Star! 🌟',
        text: 'Your handwriting is looking very strong. Keep it up!',
      },
      good: {
        title: 'Great Writing! ⭐',
        text: 'You did a nice job on this page. Let’s make it even better.',
      },
      average: {
        title: 'Growing Well! 🌱',
        text: 'You’re making progress. A little focused practice will help.',
      },
      'below average': {
        title: 'Keep Practising! ✏️',
        text: 'You’re learning. Let’s work on a few small things together.',
      },
      poor: {
        title: 'Let’s Practise Together! 💪',
        text: 'We found a few skills to practise. You can improve them one at a time.',
      },
    },
    si: {
      'very good': {
        title: 'සුපිරි! 🌟',
        text: 'ඔයාගේ අත්අකුරු ගොඩක් හොඳයි. මෙහෙමම ඉදිරියට යමු!',
      },
      good: {
        title: 'හොඳ ලිවීමක්! ⭐',
        text: 'මේ පිටුව හොඳට ලියලා තියෙනවා. තවත් ලස්සන කරමු.',
      },
      average: {
        title: 'හොඳින් දියුණු වෙමින්! 🌱',
        text: 'ඔයා දියුණු වෙමින් ඉන්නවා. පොඩි පුහුණුවක් තවත් උදව් කරයි.',
      },
      'below average': {
        title: 'තව ටිකක් පුහුණු වෙමු! ✏️',
        text: 'ඔයා ඉගෙන ගනිමින් ඉන්නවා. පොඩි දේවල් කිහිපයක් එකට පුහුණු වෙමු.',
      },
      poor: {
        title: 'එකට පුහුණු වෙමු! 💪',
        text: 'පුහුණු කරන්න දේවල් කිහිපයක් තියෙනවා. එකින් එක දියුණු කරමු.',
      },
    },
    ta: {
      'very good': {
        title: 'சூப்பர் ஸ்டார்! 🌟',
        text: 'உங்கள் கையெழுத்து மிகவும் நன்றாக இருக்கிறது. இதேபோல் தொடருங்கள்!',
      },
      good: {
        title: 'அருமையான எழுத்து! ⭐',
        text: 'இந்தப் பக்கத்தை நன்றாக எழுதியுள்ளீர்கள். இன்னும் சிறப்பாக்கலாம்.',
      },
      average: {
        title: 'நன்றாக முன்னேறுகிறீர்கள்! 🌱',
        text: 'நீங்கள் முன்னேறுகிறீர்கள். சிறிய பயிற்சி இன்னும் உதவும்.',
      },
      'below average': {
        title: 'இன்னும் கொஞ்சம் பயிற்சி செய்வோம்! ✏️',
        text: 'நீங்கள் கற்றுக்கொண்டு இருக்கிறீர்கள். சில சிறிய விஷயங்களை ஒன்றாகப் பயிற்சி செய்வோம்.',
      },
      poor: {
        title: 'ஒன்றாகப் பயிற்சி செய்வோம்! 💪',
        text: 'பயிற்சி செய்ய சில திறன்கள் உள்ளன. ஒவ்வொன்றாக மேம்படுத்தலாம்.',
      },
    },
  };

  const selected = copy[uiLanguage] || copy.en;
  return selected[normalized] || selected.average;
}

function feedbackCopy(feedbackStatus, uiLanguage = 'en') {
  const status = String(feedbackStatus || '').toUpperCase();

  const copy = {
    en: {
      unavailableTitle: 'Detailed tips are not available right now',
      unavailableText: 'Your handwriting level was checked, but we could not safely create detailed practice tips for this sample.',
      noIssuesTitle: 'Nice work! 🌟',
      noIssuesText: 'We checked the available handwriting features and did not find a major area that needs practice.',
      partialTitle: 'Here are the clearest tips we found',
      partialText: 'We could check most handwriting areas. These are the most useful things to practise first.',
    },
    si: {
      unavailableTitle: 'විස්තරාත්මක උපදෙස් මේ වෙලාවේ ලබාගන්න බැහැ',
      unavailableText: 'අත්අකුරු මට්ටම පරීක්ෂා කළා. නමුත් මේ සාම්පලයට විශ්වාසදායක පුහුණු උපදෙස් සකස් කරන්න බැරි වුණා.',
      noIssuesTitle: 'හොඳ වැඩක්! 🌟',
      noIssuesText: 'පරීක්ෂා කළ හැකි අත්අකුරු අංග වලින් ප්‍රධාන දුර්වලතාවයක් හමු වුණේ නැහැ.',
      partialTitle: 'අපට හොඳින් හඳුනාගත හැකි උපදෙස් මෙන්න',
      partialText: 'බොහෝ අත්අකුරු අංග පරීක්ෂා කළා. මුලින් පුහුණු කරන්න හොඳම දේවල් මෙන්න.',
    },
    ta: {
      unavailableTitle: 'விரிவான பயிற்சி குறிப்புகள் இப்போது கிடைக்கவில்லை',
      unavailableText: 'கையெழுத்து நிலை மதிப்பிடப்பட்டது. ஆனால் இந்த மாதிரிக்கான நம்பகமான விரிவான பயிற்சி குறிப்புகளை உருவாக்க முடியவில்லை.',
      noIssuesTitle: 'நல்ல வேலை! 🌟',
      noIssuesText: 'சரிபார்க்க முடிந்த கையெழுத்து அம்சங்களில் பெரிய பயிற்சி குறைபாடு எதுவும் கண்டுபிடிக்கப்படவில்லை.',
      partialTitle: 'நாங்கள் தெளிவாக கண்ட பயிற்சி குறிப்புகள் இவை',
      partialText: 'பெரும்பாலான கையெழுத்து பகுதிகளைச் சரிபார்த்தோம். முதலில் பயிற்சி செய்ய வேண்டிய முக்கிய விஷயங்கள் இவை.',
    },
  };

  const selected = copy[uiLanguage] || copy.en;

  if (status === 'UNAVAILABLE' || status === 'NOT_RUN') {
    return {
      kind: 'unavailable',
      title: selected.unavailableTitle,
      text: selected.unavailableText,
    };
  }

  if (status === 'PARTIAL') {
    return {
      kind: 'partial',
      title: selected.partialTitle,
      text: selected.partialText,
    };
  }

  return {
    kind: 'available',
    title: '',
    text: '',
  };
}

function normalizeRecommendations(result) {
  const structured = Array.isArray(result?.recommendations)
    ? result.recommendations
    : [];

  const texts = Array.isArray(result?.recommendation_texts)
    ? result.recommendation_texts
    : [];

  const priority = [];
  const normal = [];
  const seen = new Set();

  const add = (target, item) => {
    const signature = `${item.issueType || 'general'}|${String(item.text || '').trim()}`
      .toLowerCase();

    if (!item.text || seen.has(signature)) return;

    seen.add(signature);
    target.push(item);
  };

  if (structured.length && typeof structured[0] === 'object') {
    structured.slice(0, 3).forEach((item, index) => {
      add(priority, {
        id: `${item.issue_type || item.issueType || item.type || 'practice'}-priority-${index}`,
        issueType: item.issue_type || item.issueType || item.type || 'general',
        practiceFocus:
          item.practice_focus
          || item.practiceFocus
          || item.issue_type
          || item.issueType
          || item.type
          || 'general',
        childTitle: item.child_title || item.childTitle || '',
        title: item.title || '',
        text:
          item.primary
          || item.text
          || item.recommendations?.[0]
          || '',
        secondary:
          item.secondary
          || item.recommendations?.[1]
          || '',
        severity: item.severity || 'low',
        reliability: item.reliability || 'unknown',
      });
    });

    structured.forEach((item, index) => {
      if (normal.length >= 2) return;

      const secondary =
        item.secondary
        || item.recommendations?.[1];

      if (!secondary) return;

      add(normal, {
        id: `${item.issue_type || item.issueType || item.type || 'practice'}-extra-${index}`,
        issueType: item.issue_type || item.issueType || item.type || 'general',
        practiceFocus:
          item.practice_focus
          || item.practiceFocus
          || item.issue_type
          || item.issueType
          || item.type
          || 'general',
        childTitle: item.child_title || item.childTitle || '',
        title: item.title || '',
        text: secondary,
        secondary: '',
        severity: item.severity || 'low',
        reliability: item.reliability || 'unknown',
      });
    });
  } else {
    const source = texts.length ? texts : structured;

    source.slice(0, 3).forEach((text, index) => {
      const value =
        typeof text === 'string'
          ? text
          : text?.primary || text?.text || '';

      if (!value) return;

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

function normalizeFeedbackStatus(result) {
  const explicit = String(
    result?.feedback_status || ''
  ).trim().toUpperCase();

  if (explicit) return explicit;

  const explainability = result?.explainability || {};

  if (explainability?.available === false) {
    return 'UNAVAILABLE';
  }

  if (explainability?.partial_feedback === true) {
    return 'PARTIAL';
  }

  if (explainability?.available === true) {
    return 'AVAILABLE';
  }

  return 'NOT_RUN';
}

function recommendationForIssue(issue, recommendations) {
  const issueType = normalizeIssueType(issue);

  return recommendations.priority.find(
    (item) => item.issueType === issueType
  ) || recommendations.normal.find(
    (item) => item.issueType === issueType
  ) || null;
}

export default function ResultsPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    history,
    latestResult,
    language,
    t,
  } = useApp();

  const result =
    location.state?.result
    || (
      latestResult?.analysis_id === id
        ? latestResult
        : null
    )
    || history.find(
      (item) => item.id === id
    );

  const preview = location.state?.preview;

  if (!result) {
    return (
      <div className="not-found-card">
        <h2>{t('results.resultNotFound')}</h2>
        <p>{t('results.resultNotFoundText')}</p>

        <button
          className="primary-action"
          onClick={() => navigate('/analyze')}
        >
          {t('results.newCheck')}
        </button>
      </div>
    );
  }

  const status = analysisStatus(result);
  const legacyLabel = qualityLabel(result);
  const prediction = mergedPrediction(result);
  const finalModelLabel =
    prediction?.label
    || legacyLabel
    || mostLikelyLabel(result);
  const tone = qualityTone(finalModelLabel);

  const validation = result?.input_validation || {};
  const segmentation = result?.segmentation_reliability || {};

  const issues = Array.isArray(result?.issues)
    ? result.issues
    : Array.isArray(result?.explainability?.issues)
      ? result.explainability.issues
      : [];

  const recommendations = normalizeRecommendations(
    result
  );

  const probabilities = prediction?.probabilities || {};
  const features = result?.raw_features || {};
  const outputs = result?.output_files || {};
  const debug = result?.debug || {};

  const explainability = result?.explainability || {};
  const feedbackStatus = normalizeFeedbackStatus(result);
  const feedbackAvailable =
    feedbackStatus === 'AVAILABLE'
    || feedbackStatus === 'PARTIAL'
    || explainability?.available === true;

  const partialFeedback =
    feedbackStatus === 'PARTIAL'
    || explainability?.partial_feedback === true;

  const feedbackMessage = feedbackCopy(
    feedbackStatus,
    language
  );

  const statusInfo = friendlyStatus(
    result,
    language
  );

  const reviewRecommended = Boolean(
    prediction?.review_recommended
  );

  const confidence = Number(
    prediction?.confidence
  );

  const topProbability = Object.entries(
    probabilities
  ).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  );

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
          id={result.analysis_id || id}
          t={t}
        />

        <section
          className={`kid-result-hero tone-${statusInfo?.tone || 'retake'}`}
        >
          <div className="kid-result-copy">
            <span className="eyebrow">
              {t('results.yourCheck')}
            </span>

            <h2>
              {statusInfo?.title || t('results.tryAgain')}
            </h2>

            <p>{statusInfo?.text}</p>

            <div className="result-action-row">
              <button
                className="primary-action"
                onClick={() => navigate('/analyze')}
              >
                <RefreshCcw size={17} />
                {isModelError
                  ? t('results.tryAgain')
                  : t('results.retake')}
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

        {reasons.length > 0 && (
          <section className="result-card child-card">
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
              {reasons.slice(0, 4).map(
                (reason, index) => (
                  <div
                    className="friendly-reason"
                    key={`${reason}-${index}`}
                  >
                    <AlertTriangle size={17} />
                    <span>
                      {childReason(reason, t)}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {retryRecommendations.length > 0 && (
          <section className="result-card recommendation-card child-card">
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
              items={retryRecommendations}
              analysisLanguage={result.language}
              uiLanguage={language}
              navigate={navigate}
              t={t}
            />
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
          explainability={explainability}
          feedbackStatus={feedbackStatus}
          uiLanguage={language}
          t={t}
        />
      </div>
    );
  }

  const rawDisplayLabel =
    finalModelLabel;

  const childQuality = childQualityCopy(
    rawDisplayLabel,
    language
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

  const visibleIssues = issues.slice(0, 3);

  return (
    <div className="results-page page-stack">
      <ResultTopbar
        navigate={navigate}
        id={result.analysis_id || id}
        t={t}
      />

      <section
        className={`kid-result-hero quality-result-hero tone-${tone}`}
      >
        <div className="kid-result-copy">
          <span className="result-language">
            {languageName(
              result.language,
              language
            )}
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

          <div className="child-model-level">
            <span>
              {language === 'si'
                ? 'අත්අකුරු මට්ටම'
                : language === 'ta'
                  ? 'கையெழுத்து நிலை'
                  : 'Handwriting level'}
            </span>

            <strong>
              {displayLabel}
            </strong>
          </div>

          {reviewRecommended && (
            <div
              className="teacher-review-inline"
              role="note"
            >
              <span>🧑‍🏫</span>

              <div>
                <strong>
                  {t('results.teacherReview')}
                </strong>
              </div>
            </div>
          )}

          {(visibleIssues.length > 0 || recommendations.priority.length > 0) && (
            <div className="result-action-row">
              <button
                className="primary-action"
                onClick={() =>
                  navigate(
                    '/practice',
                    {
                      state: {
                        focus: primaryFocus,
                        language: result.language,
                      },
                    }
                  )
                }
              >
                <Sparkles size={17} />
                {t('results.topTip')}
              </button>
            </div>
          )}
        </div>

        <div
          className="kid-result-mascot quality-mascot"
          aria-hidden="true"
        >
          {String(rawDisplayLabel || '').toLowerCase() === 'very good'
            ? '🌟'
            : String(rawDisplayLabel || '').toLowerCase() === 'good'
              ? '⭐'
              : String(rawDisplayLabel || '').toLowerCase() === 'average'
                ? '🌱'
                : String(rawDisplayLabel || '').toLowerCase() === 'below average'
                  ? '✏️'
                  : '💪'}
        </div>
      </section>

      <div className="child-results-grid single-result-column">

        {!feedbackAvailable && (
          <section className="result-card child-card feedback-unavailable-card">
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
        )}

        {feedbackAvailable && partialFeedback && (
          <section className="result-card child-card partial-feedback-card">
            <div className="feedback-state-row">
              <Sparkles size={23} />

              <div>
                <h3>
                  {feedbackCopy('PARTIAL', language).title}
                </h3>

                <p>
                  {feedbackCopy('PARTIAL', language).text}
                </p>
              </div>
            </div>
          </section>
        )}

        {feedbackAvailable && visibleIssues.length > 0 && (
          <section className="result-card child-card child-issues-card">
            <div className="card-heading-row">
              <div>
                <span className="eyebrow">
                  {language === 'si'
                    ? 'මම දැක්ක දේ'
                    : language === 'ta'
                      ? 'நான் கவனித்தது'
                      : 'What I noticed'}
                </span>

                <h3>
                  {language === 'si'
                    ? 'මුලින් මේ දේවල් ටික පුහුණු වෙමු'
                    : language === 'ta'
                      ? 'முதலில் இந்த விஷயங்களைப் பயிற்சி செய்வோம்'
                      : 'Let’s work on these first'}
                </h3>
              </div>

              <span className="count-badge">
                {visibleIssues.length}
              </span>
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

        {feedbackAvailable && visibleIssues.length === 0 && (
          <section className="result-card child-card">
            <div className="positive-state">
              <CheckCircle2 size={28} />

              <div>
                <h4>
                  {feedbackCopy('AVAILABLE', language).title
                    || feedbackCopy('AVAILABLE', language).noIssuesTitle
                    || (
                      language === 'si'
                        ? 'හොඳ වැඩක්! 🌟'
                        : language === 'ta'
                          ? 'நல்ல வேலை! 🌟'
                          : 'Nice work! 🌟'
                    )}
                </h4>

                <p>
                  {language === 'si'
                    ? 'පරීක්ෂා කළ හැකි අත්අකුරු අංග වලින් ප්‍රධාන දුර්වලතාවයක් හමු වුණේ නැහැ.'
                    : language === 'ta'
                      ? 'சரிபார்க்க முடிந்த கையெழுத்து அம்சங்களில் பெரிய பயிற்சி குறைபாடு எதுவும் கண்டுபிடிக்கப்படவில்லை.'
                      : 'We checked the available handwriting features and did not find a major area that needs practice.'}
                </p>
              </div>
            </div>
          </section>
        )}

        {feedbackAvailable && recommendations.priority.length > 0 && visibleIssues.length === 0 && (
          <section className="result-card child-card recommendations-showcase">
            <div className="card-heading-row">
              <div>
                <h3>
                  {t('results.planTitle')}
                </h3>
              </div>

              <span className="count-badge">
                {recommendations.priority.length}
              </span>
            </div>

            <PriorityRecommendationList
              items={recommendations.priority}
              analysisLanguage={result.language}
              uiLanguage={language}
              navigate={navigate}
              t={t}
            />
          </section>
        )}

      </div>

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
        explainability={explainability}
        feedbackStatus={feedbackStatus}
        uiLanguage={language}
        t={t}
      />
    </div>
  );
}

function ResultTopbar({
  navigate,
  id,
  t,
}) {
  return (
    <div className="results-topbar results-topbar-with-language">
      <button
        onClick={() => navigate('/analyze')}
      >
        <ArrowLeft size={19} />
        {t('results.newCheck')}
      </button>

      <div className="results-topbar-right">
        <span className="analysis-id">
          {t('results.checkId', { id })}
        </span>

        <LanguageToggle compact />
      </div>
    </div>
  );
}

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
      {issues.map(
        (issue, index) => {
          const issueType =
            normalizeIssueType(issue);

          const copy =
            childIssueCopy(
              issueType,
              uiLanguage
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
                recommendation.childTitle || recommendation.title,
                recommendation.text
              )
              : null;

          return (
            <article
              className={`child-issue-card severity-${issue?.severity || 'low'}`}
              key={`${issue?.feature || issueType}-${index}`}
            >
              <div className="child-issue-icon">
                {childIssueIcon(issueType)}
              </div>

              <div className="child-issue-copy">
                <h4>
                  {copy.title}
                </h4>

                <p>
                  {copy.text}
                </p>

                {recommendation && (
                  <div className="child-try-this">
                    <strong>
                      {uiLanguage === 'si'
                        ? '💡 මේක කරලා බලමු'
                        : uiLanguage === 'ta'
                          ? '💡 இதை முயற்சி செய்வோம்'
                          : '💡 Try this'}
                    </strong>

                    <p>
                      {recommendationCopy?.text
                        || recommendation.text}
                    </p>
                  </div>
                )}
              </div>

              <button
                className="issue-practice-button"
                onClick={() =>
                  navigate(
                    '/practice',
                    {
                      state: {
                        focus: practiceFocus,
                        language: analysisLanguage,
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
      )}
    </div>
  );
}

function PriorityRecommendationList({
  items,
  analysisLanguage,
  uiLanguage,
  navigate,
  t,
}) {
  return (
    <div className="kid-recommendation-list">
      {items.slice(0, 3).map(
        (item, index) => {
          const copy =
            localizedRecommendation(
              item.issueType,
              uiLanguage,
              item.childTitle || item.title,
              item.text
            );

          return (
            <article
              className={`kid-recommendation priority-recommendation severity-${item.severity || 'low'}`}
              key={item.id}
            >
              <span className="recommendation-number">
                {index + 1}
              </span>

              <div>
                <div className="recommendation-title-row">
                  <h4>
                    {item.childTitle || copy.title}
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
                        language: analysisLanguage,
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
      )}
    </div>
  );
}

function NormalRecommendationList({
  items,
  analysisLanguage,
  uiLanguage,
  navigate,
  t,
}) {
  if (!items?.length) return null;

  return (
    <div className="normal-recommendation-list">
      {items.slice(0, 2).map(
        (item, index) => {
          const copy =
            localizedRecommendation(
              item.issueType,
              uiLanguage,
              item.childTitle || item.title,
              item.text
            );

          return (
            <article
              className="normal-recommendation"
              key={item.id}
            >
              <span className="normal-tip-icon">
                {index + 1}
              </span>

              <div>
                <h4>
                  {item.childTitle
                    || copy.title
                    || t('results.extraTip')}
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
                        language: analysisLanguage,
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
      )}
    </div>
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
        <div className="teacher-stat-grid">
          <div>
            <span>{t('results.analysisStatus')}</span>
            <strong>
              {result?.analysis_status || '—'}
            </strong>
          </div>

          <div>
            <span>Feedback status</span>
            <strong>
              {feedbackStatus || '—'}
            </strong>
          </div>

          <div>
            <span>{t('results.confidence')}</span>
            <strong>
              {Number.isFinite(
                Number(prediction?.confidence)
              )
                ? `${formatNumber(prediction.confidence, 1)}%`
                : '—'}
            </strong>
          </div>

          <div>
            <span>{t('results.modelClass')}</span>
            <strong>
              {rawModelLabel
                ? qualityLabelText(
                  rawModelLabel,
                  uiLanguage
                )
                : '—'}
            </strong>
          </div>

          <div>
            <span>{t('results.review')}</span>
            <strong>
              {prediction?.review_recommended
                ? t('results.recommended')
                : t('results.notRequired')}
            </strong>
          </div>

          <div>
            <span>{t('results.lines')}</span>
            <strong>
              {debug?.line_count ?? '—'}
            </strong>
          </div>

          <div>
            <span>{t('results.words')}</span>
            <strong>
              {debug?.word_count ?? '—'}
            </strong>
          </div>

          <div>
            <span>{t('results.characters')}</span>
            <strong>
              {debug?.character_region_count ?? '—'}
            </strong>
          </div>

          <div>
            <span>{t('results.segGate')}</span>
            <strong>
              {segmentation?.status || '—'}
            </strong>
          </div>
        </div>

        {topProbability?.length > 0 && (
          <section className="teacher-subsection">
            <h4>
              {t('results.probabilities')}
            </h4>

            <div className="probability-list">
              {topProbability.map(
                ([name, value]) => (
                  <div
                    className="probability-row"
                    key={name}
                  >
                    <div className="probability-label">
                      <span>
                        {qualityLabelText(
                          name,
                          uiLanguage
                        )}
                      </span>

                      <strong>
                        {Number(value).toFixed(1)}%
                      </strong>
                    </div>

                    <div className="probability-track">
                      <div
                        className={`probability-fill tone-${qualityTone(name)}`}
                        style={{
                          width: `${Math.max(
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
              )}
            </div>
          </section>
        )}

        {issues.length > 0 && (
          <section className="teacher-subsection">
            <h4>
              {t('results.issueExplanations')}
            </h4>

            <div className="issue-list">
              {issues.map(
                (issue, index) => {
                  const issueType =
                    normalizeIssueType(issue);

                  const childCopy =
                    childIssueCopy(
                      issueType,
                      uiLanguage
                    );

                  return (
                    <div
                      className={`issue-item ${toneForSeverity(issue.severity)}`}
                      key={`${issue.feature || issue.type}-${index}`}
                    >
                      <div className="issue-severity">
                        {severityText(
                          issue.severity,
                          uiLanguage
                        )}
                      </div>

                      <div>
                        <h4>
                          {childCopy.title
                            || featureNameText(
                              issue.feature || issue.type,
                              uiLanguage
                            )}
                        </h4>

                        <p>
                          {issue.message || childCopy.text}
                        </p>

                        <small>
                          {issue.feature
                            ? `${featureNameText(
                              issue.feature,
                              uiLanguage
                            )}: ${formatNumber(issue.value)}`
                            : ''}
                        </small>

                        <div className="teacher-issue-meta">
                          <small>
                            Reliability: {issue.reliability || 'unknown'}
                          </small>

                          {Number.isFinite(
                            Number(
                              issue.spearman_teacher_correlation
                            )
                          ) && (
                            <small>
                              Teacher correlation: {formatNumber(
                                issue.spearman_teacher_correlation,
                                3
                              )}
                            </small>
                          )}

                          <small>
                            Source: {issue.threshold_source || '—'}
                          </small>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        )}

        {(suppressedFeatures.length > 0
          || softWarnings.length > 0
          || missingFeatures.length > 0) && (
          <section className="teacher-subsection">
            <h4>Explainability diagnostics</h4>

            <div className="feature-table">
              <div className="feature-row">
                <span>Suppressed features</span>
                <strong>{suppressedFeatures.length}</strong>
              </div>

              <div className="feature-row">
                <span>Soft-warning features</span>
                <strong>{softWarnings.length}</strong>
              </div>

              <div className="feature-row">
                <span>Missing features</span>
                <strong>{missingFeatures.length}</strong>
              </div>
            </div>
          </section>
        )}

        {Object.keys(
          validation?.features || {}
        ).length > 0 && (
          <section className="teacher-subsection">
            <h4>
              {t('results.inputMeasurements')}
            </h4>

            <div className="feature-table">
              {Object.entries(
                validation.features
              ).map(
                ([name, value]) => (
                  <div
                    className="feature-row"
                    key={name}
                  >
                    <span>
                      {featureNameText(
                        name,
                        uiLanguage
                      )}
                    </span>

                    <strong>
                      {formatNumber(value)}
                    </strong>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {Object.keys(
          features || {}
        ).length > 0 && (
          <section className="teacher-subsection">
            <h4>
              {t('results.structuralFeatures')}
            </h4>

            <div className="feature-grid">
              {Object.entries(
                features
              ).map(
                ([name, value]) => (
                  <div
                    className="feature-tile"
                    key={name}
                  >
                    <span>
                      {featureNameText(
                        name,
                        uiLanguage
                      )}
                    </span>

                    <strong>
                      {formatNumber(value)}
                    </strong>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        <OutputGallery
          outputs={outputs}
          preview={preview}
          t={t}
        />
      </div>
    </details>
  );
}

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
    <section className="teacher-subsection">
      <h4>
        {t('results.processingOutputs')}
      </h4>

      <div className="output-gallery">
        {items.map(
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
              <figure key={title}>
                <div className="output-image">
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
        )}
      </div>
    </section>
  );
}