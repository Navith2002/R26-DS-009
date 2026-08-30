import { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/useApp";
import { predictReading } from "./api";
import "../../readingError.css";

/* =====================================================
   TAMIL QUESTIONS
===================================================== */

const tamilQuestions = {
  "Word 1 - அம்மா": "அம்மா",
  "Word 2 - அப்பா": "அப்பா",
  "Word 3 - வீடு": "வீடு",
  "Word 4 - பள்ளி": "பள்ளி",
  "Word 5 - மலர்": "மலர்",
  "Word 6 - மணி": "மணி",
  "Word 7 - கடை": "கடை",
  "Word 8 - நதி": "நதி",
  "Word 9 - மரம்": "மரம்",
  "Word 10 - மழை": "மழை",
  "Word 11 - காலை": "காலை",
  "Word 12 - நூல்": "நூல்",
  "Word 13 - தேநீர்": "தேநீர்",
  "Word 14 - ஆடு": "ஆடு",
  "Word 15 - ஊர்": "ஊர்",
  "Word 16 - லம்": "லம்",
  "Word 17 - ளம்": "ளம்",
  "Word 18 - ழம்": "ழம்",
  "Word 19 - அறம்": "அறம்",
  "Word 20 - இறை": "இறை",
  "Word 21 - நண்பன்": "நண்பன்",
  "Word 22 - ஆசிரியர்": "ஆசிரியர்",
  "Word 23 - முயற்சி": "முயற்சி",
  "Word 24 - வளர்ச்சி": "வளர்ச்சி",
  "Word 25 - அறிவியல்": "அறிவியல்",
  "Word 26 - குடம்": "குடம்",
  "Word 27 - பல்": "பல்",
  "Word 28 - நாய்": "நாய்",
  "Word 29 - பூ": "பூ",
  "Word 30 - விழி": "விழி",
  "Word 31 - குரல்": "குரல்",
  "Word 32 - நகர்": "நகர்",
  "Word 33 - குளம்": "குளம்",
  "Word 34 - படம்": "படம்",
  "Word 35 - கோடு": "கோடு",
  "Word 36 - பேனா": "பேனா",
  "Word 37 - தூண்": "தூண்",
  "Word 38 - நேரம்": "நேரம்",
  "Word 39 - சாலை": "சாலை",
  "Word 40 - லரி": "லரி",
  "Word 41 - ளரி": "ளரி",
  "Word 42 - ழரி": "ழரி",
  "Word 43 - அலை": "அலை",
  "Word 44 - அளை": "அளை",
  "Word 45 - கல்வி": "கல்வி",
  "Word 46 - செயலி": "செயலி",
  "Word 47 - வாசகர்": "வாசகர்",
  "Word 48 - பயணம்": "பயணம்",
  "Word 49 - உரையாடல்": "உரையாடல்",

  "Sentence 1": "அம்மா வீட்டிற்கு செல்கிறார்.",
  "Sentence 2": "அப்பா வேலைக்கு செல்கிறார்.",
  "Sentence 3": "மாணவன் புத்தகத்தை வாசிக்கிறான்.",
  "Sentence 4": "ஆசிரியர் பாடத்தை கற்பிக்கிறார்.",
  "Sentence 5": "குழந்தை தண்ணீர் குடிக்கிறது.",
  "Sentence 6": "நண்பன் பள்ளிக்கு செல்கிறான்.",
  "Sentence 7": "மாணவி வகுப்பில் கவனமாக கேட்கிறாள்.",
  "Sentence 8": "ஆசிரியர் மாணவர்களுக்கு கேள்வி கேட்கிறார்.",
  "Sentence 9": "குழந்தை பூங்காவில் மகிழ்ச்சியாக விளையாடுகிறது.",
  "Sentence 10": "நண்பர்கள் சேர்ந்து பாடம் படிக்கிறார்கள்.",
  "Sentence 11": "நாங்கள் மலைகள் உள்ள பிரதேசத்திற்குச் சென்றோம்.",
  "Sentence 12": "ஒரு மாதமாக மழை பெய்யவில்லை.",
  "Sentence 13": "அவன் வாளால் மரத்தை அரிந்தான்.",
  "Sentence 14":
    "அவன் பத்திரிகைகளை வாசித்து செய்திகளை அறிந்து கொண்டான்.",
  "Sentence 15": "தங்கை வாங்கிய கனிகள் நன்கு கனிந்திருந்தன.",
  "Sentence 16": "சோதிடர்கள் வருங்காலத்தை கணித்துக் கூறினர்.",
  "Sentence 17": "விவசாயிகள் மண்ணை வளமாக்கினர்.",
  "Sentence 18":
    "போக்குவரத்துப் பொலிசார் வலப்பக்கமாகச் செல்லுமாறு கூறினர்.",
  "Sentence 19": "அதிபர் காலையில் உரையாற்றினார்.",
  "Sentence 20": "எங்கள் வீட்டில் கணினி உண்டு.",
  "Sentence 21": "நான் மின்னஞ்சல் வாசித்தேன்.",
  "Sentence 22": "அந்தப் பாலம் மிகவும் சிறியது.",
  "Sentence 23": "குதிரைகள் மிக வேகமாக ஓடின.",
  "Sentence 24": "விமானம் வானில் பறந்தது.",
  "Sentence 25": "பேருந்து வேகமாக சென்றது.",
};

/* =====================================================
   SINHALA QUESTIONS
===================================================== */

const sinhalaQuestions = {
  "Sentence 1": "යාළුවෝ හැමදෙනාම නිදහස් උත්සවය බැලුවා",
  "Sentence 2": "කවිඳු යාළුවොත් එක්ක මිදුලේ සෙල්ලම් කරමින් සිටියා",
  "Sentence 3": "අපේ රටේ නිදහස් උත්සවය",
  "Sentence 4": "මම කෝෂය ඇතුලේ සති දෙකක් විතර හිටියා",
  "Sentence 5": "පොත් කියවීමෙන් මිනිසා සම්පූර්ණ වේ",
  "Sentence 6": "මුහුද හරිම ලස්සනයි",
  "Sentence 7": "හැමෝම එකට අත් අල්ලා ගන්න",
  "Sentence 8": "මම එහෙනම් නාගෙන එන්නම්",
  "Sentence 9": "අපි අද පොල් කැඩුවා",
  "Sentence 10": "ඇයි හිනා වෙන්නේ, මට රජ වෙන්න බැරිද",
  "Sentence 11": "දුව සටහන් පොතේ මොනවාද ලියා ගත්තේ",
  "Sentence 12": "ඉතින් මෙච්චර පරක්කු වුනේ ඇයි",
  "Sentence 13": "දවසක් අම්මා අශ්ව පැටියාගෙන් උදව්වක් ඉල්ලුවා",
  "Sentence 14": "ඔය ගඟ හරි ගැඹුරුයි",
  "Sentence 15":
    "අශ්ව පැටියා ඉක්මනින් ගෙදර එනවා දැකලා අම්මා පුදුම වුනා",
  "Sentence 16": "සිටුතුමනි, අපට අනුකම්පා කරනු මැනවි",
  "Sentence 17": "බරෙන් වැඩි වන්නේ ගසක මුල කොටසද",
  "Sentence 18":
    "රයිට් සහෝදරයන්ගේ පියා ඔවුන් පුංචිකාලයේ දී කඩදාසි සහ රබර් පටිවලින් සෙල්ලම් අහස් යානා තනා දුන්නේය",
  "Sentence 19": "පසු කලෙක ඔවුහු බයිසිකල් වැඩ වැඩපොළක් ඇරඹූහ",
  "Sentence 20": "දැන් හැමෝම වාඩිවෙන්න",
};

/* =====================================================
   APP
===================================================== */

export default function ReadingErrorApp() {
  /* =====================================================
     STATE
  ===================================================== */

  const [theme, setTheme] = useState("light");

  // WriteBright's global language toggle (header) only knows
  // 'sinhala' | 'tamil' -- this component's own logic/data (tamilQuestions/
  // sinhalaQuestions above, the backend's Tamil/Sinhala normalize_language_name)
  // expects the capitalized full words, so bridge at the edge here instead
  // of touching every call site below. There's no in-page language <select>
  // anymore (removed) -- the global header toggle drives this page, same
  // as the grammar-check and fluency-profiling components.
  const { language: appLanguage } = useApp();
  const language = appLanguage === "tamil" ? "Tamil" : "Sinhala";

  const [selectedTask, setSelectedTask] = useState(
    "Word 1 - அம்மா"
  );

  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [mascotMood, setMascotMood] = useState("ready");

  const [showFireworks, setShowFireworks] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const clapAudioRef = useRef(null);

  /* =====================================================
     QUESTIONS
  ===================================================== */

  const questions =
    language === "Tamil"
      ? tamilQuestions
      : sinhalaQuestions;

  const expectedText = questions[selectedTask];

  const taskKeys = Object.keys(questions);

  const currentTaskIndex = Math.max(
    taskKeys.indexOf(selectedTask),
    0
  );

  const progressPercent =
    ((currentTaskIndex + 1) / taskKeys.length) * 100;

  /* =====================================================
     LANGUAGE TEXT
  ===================================================== */

  const studentGuide =
    language === "Tamil"
      ? {
          appTitle: "தமிழ் வாசிப்பு நண்பன்",

          appSubtitle:
            "வாசிப்போம் • பயிற்சி செய்வோம் • முன்னேறுவோம்",

          chooseLanguage:
            "🌐 மொழியை தேர்வு செய்யவும்",

          chooseTask:
            "📖 வாசிப்பு பயிற்சியை தேர்வு செய்யவும்",

          title:
            "👧 மாணவர் வழிகாட்டல்",

          line1:
            "கீழே உள்ள உரையை கவனமாக பாருங்கள்.",

          line2:
            "மெதுவாகவும் தெளிவாகவும் வாசிக்கவும்.",

          line3:
            "பிறகு பொத்தானை அழுத்தி உங்கள் குரலை பதிவு செய்யவும்.",

          readTitle:
            "இந்த உரையை வாசிக்கவும்",

          recordTitle:
            "🎙 உங்கள் குரலை பதிவு செய்யவும்",

          startBtn:
            "🎤 வாசிக்க தொடங்கு",

          stopBtn:
            "⛔ பதிவு நிறுத்து",

          recordingText:
            "🔴 பதிவு செய்யப்படுகிறது... தெளிவாக வாசிக்கவும்!",

          audioText:
            "🔊 உங்கள் பதிவை கேட்கவும்",

          resultTitle:
            "📊 வாசிப்பு முடிவு",

          emptyTitle:
            "😊 தயார் தானே?",

          emptyText:
            "உங்கள் குரலை பதிவு செய்து வாசிப்பு மதிப்பெண்ணைப் பாருங்கள்.",

          analyzingText:
            "உங்கள் வாசிப்பு பகுப்பாய்வு செய்யப்படுகிறது...",

          expectedLabel:
            "எதிர்பார்க்கப்பட்ட உரை",

          predictedLabel:
            "கணிக்கப்பட்ட உரை",

          correctReading:
            "✅ சரியான வாசிப்பு",

          accuracyLabel:
            "வாசிப்பு துல்லியம்",

          readingTime:
            "வாசிப்பு நேரம்",

          wordsPerSecond:
            "வார்த்தைகள் / வினாடி",

          languageLabel:
            "மொழி",

          voiceAnalysis:
            "🎧 குரல் பகுப்பாய்வு",

          voiceEnergy:
            "குரல் வலிமை",

          confidence:
            "நம்பிக்கை நிலை",

          speechBehavior:
            "வாசிப்பு நடத்தை",

          errorType:
            "பிழை வகை",

          feedbackTitle:
            "💬 கருத்து",

          tipsTitle:
            "🌈 பயிற்சி குறிப்புகள்",

          tip1:
            "முதலில் மெதுவாக வாசிக்கவும்.",

          tip2:
            "ஒவ்வொரு வார்த்தையையும் தெளிவாக சொல்லவும்.",

          tip3:
            "மீண்டும் முயற்சி செய்து மதிப்பெண்ணை மேம்படுத்தவும்.",

          celebrationTitle:
            "அருமையான வாசிப்பு!",

          celebrationText:
            "நீங்கள் உரையை சரியாக வாசித்தீர்கள். மிகவும் நன்று!",
        }
      : {
          appTitle:
            "සිංහල කියවීමේ මිතුරා",

          appSubtitle:
            "කියවමු • පුහුණු වෙමු • ඉදිරියට යමු",

          chooseLanguage:
            "🌐 භාෂාව තෝරන්න",

          chooseTask:
            "📖 කියවීමේ කාර්යය තෝරන්න",

          title:
            "👧 සිසුන් සඳහා මඟ පෙන්වීම",

          line1:
            "පහත ඇති පාඨය හොඳින් බලන්න.",

          line2:
            "සෙමින් සහ පැහැදිලිව කියවන්න.",

          line3:
            "ඉන්පසු බොත්තම ඔබා ඔබේ හඬ පටිගත කරන්න.",

          readTitle:
            "මෙම පාඨය කියවන්න",

          recordTitle:
            "🎙 ඔබේ හඬ පටිගත කරන්න",

          startBtn:
            "🎤 කියවීම ආරම්භ කරන්න",

          stopBtn:
            "⛔ පටිගත කිරීම නවත්වන්න",

          recordingText:
            "🔴 පටිගත වෙමින් පවතී... පැහැදිලිව කියවන්න!",

          audioText:
            "🔊 ඔබේ පටිගත කිරීම අසන්න",

          resultTitle:
            "📊 කියවීමේ ප්‍රතිඵලය",

          emptyTitle:
            "😊 සූදානම්ද?",

          emptyText:
            "ඔබේ හඬ පටිගත කර කියවීමේ ලකුණු බලන්න.",

          analyzingText:
            "ඔබේ කියවීම විශ්ලේෂණය කරමින් පවතී...",

          expectedLabel:
            "අපේක්ෂිත පාඨය",

          predictedLabel:
            "අනාවැකි කළ පාඨය",

          correctReading:
            "✅ නිවැරදි කියවීම",

          accuracyLabel:
            "කියවීමේ නිරවද්‍යතාව",

          readingTime:
            "කියවීමේ කාලය",

          wordsPerSecond:
            "වචන / තත්පරය",

          languageLabel:
            "භාෂාව",

          voiceAnalysis:
            "🎧 හඬ විශ්ලේෂණය",

          voiceEnergy:
            "හඬ ශක්තිය",

          confidence:
            "විශ්වාස මට්ටම",

          speechBehavior:
            "කියවීමේ හැසිරීම",

          errorType:
            "දෝෂ වර්ගය",

          feedbackTitle:
            "💬 ප්‍රතිචාරය",

          tipsTitle:
            "🌈 පුහුණු උපදෙස්",

          tip1:
            "මුලින් සෙමින් කියවන්න.",

          tip2:
            "සෑම වචනයක්ම පැහැදිලිව කියන්න.",

          tip3:
            "නැවත උත්සාහ කර ඔබේ ලකුණු වැඩි කරගන්න.",

          celebrationTitle:
            "අති විශිෂ්ට කියවීමක්!",

          celebrationText:
            "ඔබ පාඨය නිවැරදිව කියවුවා. ඉතා හොඳයි!",
        };

  /* =====================================================
     CHILD TEXT
  ===================================================== */

  const childText =
    language === "Tamil"
      ? {
          progress:
            "உங்கள் முன்னேற்றம்",

          activity:
            "பயிற்சி",

          of:
            "இல்",

          ready:
            "வாசிக்க தயாரா? 😊",

          listening:
            "நான் கேட்கிறேன்! தெளிவாக வாசியுங்கள் 🎧",

          thinking:
            "சிறிது நேரம்... உங்கள் வாசிப்பை பார்க்கிறேன் 🔍",

          great:
            "அருமையான முயற்சி! 🌟",

          tryAgain:
            "நல்ல முயற்சி! இன்னொரு முறை முயற்சிப்போம் 💪",

          next:
            "அடுத்த பயிற்சி 🚀",

          retry:
            "மீண்டும் முயற்சி 🔁",

          stars:
            "நட்சத்திரங்கள்",
        }
      : {
          progress:
            "ඔබගේ ප්‍රගතිය",

          activity:
            "ක්‍රියාකාරකම",

          of:
            "න්",

          ready:
            "කියවන්න සූදානම්ද? 😊",

          listening:
            "මම අහගෙන ඉන්නේ! පැහැදිලිව කියවන්න 🎧",

          thinking:
            "මොහොතක්... ඔබේ කියවීම බලනවා 🔍",

          great:
            "ඉතා හොඳ උත්සාහයක්! 🌟",

          tryAgain:
            "හොඳ උත්සාහයක්! නැවත උත්සාහ කරමු 💪",

          next:
            "ඊළඟ පුහුණුව 🚀",

          retry:
            "නැවත උත්සාහ කරන්න 🔁",

          stars:
            "තරු",
        };

  /* =====================================================
     TRANSLATE BACKEND RESULT VALUES
  ===================================================== */

  const translateResultValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const normalizedValue = String(value)
      .trim()
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\s+/g, " ");

    /* =========================
       TAMIL TRANSLATIONS
    ========================= */

    const tamilTranslations = {
      /* VOICE ENERGY */
      "very low": "மிகக் குறைவு",
      low: "குறைவு",
      medium: "நடுத்தரம்",
      moderate: "நடுத்தரம்",
      high: "உயர்",
      "very high": "மிக உயர்ந்தது",

      /* CONFIDENCE */
      "low confidence":
        "குறைந்த நம்பிக்கை",

      "medium confidence":
        "நடுத்தர நம்பிக்கை",

      "moderate confidence":
        "நடுத்தர நம்பிக்கை",

      "high confidence":
        "உயர் நம்பிக்கை",

      "very high confidence":
        "மிக உயர்ந்த நம்பிக்கை",

      /* READING BEHAVIOUR */
      hesitant:
        "தயக்கத்துடன்",

      hesitation:
        "தயக்கம்",

      fluent:
        "சரளமாக",

      "very fluent":
        "மிகவும் சரளமாக",

      slow:
        "மெதுவாக",

      "very slow":
        "மிக மெதுவாக",

      fast:
        "வேகமாக",

      "very fast":
        "மிக வேகமாக",

      normal:
        "சாதாரணம்",

      steady:
        "சீரான வாசிப்பு",

      confident:
        "நம்பிக்கையுடன்",

      clear:
        "தெளிவாக",

      unclear:
        "தெளிவற்ற வாசிப்பு",

      "needs improvement":
        "மேம்பாடு தேவை",

      /* ERROR TYPES */
      correct:
        "சரியான வாசிப்பு",

      "correct reading":
        "சரியான வாசிப்பு",

      "pronunciation / word error":
        "உச்சரிப்பு / சொல் பிழை",

      "pronunciation/word error":
        "உச்சரிப்பு / சொல் பிழை",

      "pronunciation and word error":
        "உச்சரிப்பு / சொல் பிழை",

      "pronunciation error":
        "உச்சரிப்பு பிழை",

      pronunciation:
        "உச்சரிப்பு பிழை",

      "word error":
        "சொல் பிழை",

      substitution:
        "சொல் மாற்றுப் பிழை",

      "substitution error":
        "சொல் மாற்றுப் பிழை",

      deletion:
        "விடுபட்ட சொல் பிழை",

      "deletion error":
        "விடுபட்ட சொல் பிழை",

      insertion:
        "கூடுதல் சொல் பிழை",

      "insertion error":
        "கூடுதல் சொல் பிழை",

      mispronunciation:
        "தவறான உச்சரிப்பு",

      "mispronunciation error":
        "தவறான உச்சரிப்பு",

      omission:
        "விடுபட்ட சொல்",

      "omission error":
        "விடுபட்ட சொல் பிழை",

      repetition:
        "மீண்டும் கூறுதல்",

      "repetition error":
        "மீண்டும் கூறும் பிழை",

      "multiple errors":
        "பல பிழைகள்",

      "reading error":
        "வாசிப்பு பிழை",

      "no error":
        "பிழை இல்லை",

      "no speech detected":
        "குரல் கண்டறியப்படவில்லை",

      unknown:
        "தெரியவில்லை",
    };

    /* =========================
       SINHALA TRANSLATIONS
    ========================= */

    const sinhalaTranslations = {
      /* VOICE ENERGY */
      "very low":
        "ඉතා අඩු",

      low:
        "අඩු",

      medium:
        "මධ්‍යම",

      moderate:
        "මධ්‍යම",

      high:
        "ඉහළ",

      "very high":
        "ඉතා ඉහළ",

      /* CONFIDENCE */
      "low confidence":
        "අඩු විශ්වාස මට්ටම",

      "medium confidence":
        "මධ්‍යම විශ්වාස මට්ටම",

      "moderate confidence":
        "මධ්‍යම විශ්වාස මට්ටම",

      "high confidence":
        "ඉහළ විශ්වාස මට්ටම",

      "very high confidence":
        "ඉතා ඉහළ විශ්වාස මට්ටම",

      /* READING BEHAVIOUR */
      hesitant:
        "පැකිලෙන",

      hesitation:
        "පැකිලීම",

      fluent:
        "චතුර",

      "very fluent":
        "ඉතා චතුර",

      slow:
        "මන්දගාමී",

      "very slow":
        "ඉතා මන්දගාමී",

      fast:
        "වේගවත්",

      "very fast":
        "ඉතා වේගවත්",

      normal:
        "සාමාන්‍ය",

      steady:
        "ස්ථාවර කියවීම",

      confident:
        "විශ්වාසයෙන්",

      clear:
        "පැහැදිලි",

      unclear:
        "අපැහැදිලි කියවීම",

      "needs improvement":
        "වැඩිදියුණු කිරීම අවශ්‍යයි",

      /* ERROR TYPES */
      correct:
        "නිවැරදි කියවීම",

      "correct reading":
        "නිවැරදි කියවීම",

      "pronunciation / word error":
        "උච්චාරණ / වචන දෝෂය",

      "pronunciation/word error":
        "උච්චාරණ / වචන දෝෂය",

      "pronunciation and word error":
        "උච්චාරණ / වචන දෝෂය",

      "pronunciation error":
        "උච්චාරණ දෝෂය",

      pronunciation:
        "උච්චාරණ දෝෂය",

      "word error":
        "වචන දෝෂය",

      substitution:
        "වචන ප්‍රතිස්ථාපන දෝෂය",

      "substitution error":
        "වචන ප්‍රතිස්ථාපන දෝෂය",

      deletion:
        "වචනයක් මඟහැරීම",

      "deletion error":
        "වචනයක් මඟහැරීම",

      insertion:
        "අමතර වචන දෝෂය",

      "insertion error":
        "අමතර වචන දෝෂය",

      mispronunciation:
        "වැරදි උච්චාරණය",

      "mispronunciation error":
        "වැරදි උච්චාරණය",

      omission:
        "වචනයක් මඟහැරීම",

      "omission error":
        "වචනයක් මඟහැරීම",

      repetition:
        "වචනය නැවත කියවීම",

      "repetition error":
        "නැවත කියවීමේ දෝෂය",

      "multiple errors":
        "දෝෂ කිහිපයක්",

      "reading error":
        "කියවීමේ දෝෂය",

      "no error":
        "දෝෂයක් නොමැත",

      "no speech detected":
        "හඬ හඳුනාගත නොහැක",

      unknown:
        "නොදනී",
    };

    const translations =
      language === "Tamil"
        ? tamilTranslations
        : sinhalaTranslations;

    return (
      translations[normalizedValue] ||
      value
    );
  };

  /* =====================================================
     DISPLAY LANGUAGE NAME
  ===================================================== */

  const displayLanguage =
    language === "Tamil"
      ? "தமிழ்"
      : "සිංහල";

  /* =====================================================
     STARS
  ===================================================== */

  const earnedStars =
    result &&
    result.status === "success"
      ? result.accuracy >= 90
        ? 3
        : result.accuracy >= 70
        ? 2
        : 1
      : 0;

  /* =====================================================
     CORRECT ANSWER
  ===================================================== */

  const isCorrectAnswer =
    result &&
    result.status === "success" &&
    result.error_type === "Correct";

  /* =====================================================
     PREPARE APPLAUSE
  ===================================================== */

  const unlockClapSound = () => {
    try {
      if (!clapAudioRef.current) {
        clapAudioRef.current =
          new Audio("/sounds/applause.mp3");

        clapAudioRef.current.preload =
          "auto";

        clapAudioRef.current.volume =
          0.8;
      }

      const audio =
        clapAudioRef.current;

      audio.muted = true;
      audio.currentTime = 0;

      audio
        .play()
        .then(() => {
          audio.pause();

          audio.currentTime =
            0;

          audio.muted =
            false;

          console.log(
            "✅ Applause audio unlocked"
          );
        })
        .catch((error) => {
          console.log(
            "Audio unlock failed:",
            error
          );
        });
    } catch (error) {
      console.log(
        "Audio setup error:",
        error
      );
    }
  };

  /* =====================================================
     PLAY APPLAUSE
  ===================================================== */

  const playClapSound = () => {
    try {
      const audio =
        clapAudioRef.current;

      if (!audio) {
        console.log(
          "❌ Applause audio not initialized"
        );

        return;
      }

      audio.pause();

      audio.currentTime =
        0;

      audio.muted =
        false;

      audio.volume =
        0.8;

      audio
        .play()
        .then(() => {
          console.log(
            "👏 Applause playing"
          );
        })
        .catch((error) => {
          console.log(
            "❌ Applause play failed:",
            error
          );
        });
    } catch (error) {
      console.log(
        "Applause error:",
        error
      );
    }
  };

  /* =====================================================
     CORRECT ANSWER CELEBRATION
  ===================================================== */

  useEffect(() => {
    if (!isCorrectAnswer) {
      return;
    }

    setShowFireworks(true);

    playClapSound();

    const timer =
      setTimeout(() => {
        setShowFireworks(false);
      }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [isCorrectAnswer]);

  /* =====================================================
     THEME
  ===================================================== */

  const toggleTheme = () => {
    setTheme(
      theme === "dark"
        ? "light"
        : "dark"
    );
  };

  /* =====================================================
     LANGUAGE CHANGE
     Reacts to WriteBright's global language toggle instead of an
     in-page <select> (removed) -- same reset behavior as before,
     just triggered by the bridged `language` changing instead of
     a picker's onChange.
  ===================================================== */

  useEffect(() => {
    setSelectedTask(
      Object.keys(
        language === "Tamil" ? tamilQuestions : sinhalaQuestions
      )[0]
    );

    setResult(null);
    setAudioUrl("");
    setMascotMood("ready");
    // Only the language switching should trigger this reset, not every
    // render -- mirrors the original handler's scope exactly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  /* =====================================================
     START RECORDING
  ===================================================== */

  const startRecording = async () => {
    unlockClapSound();

    setResult(null);
    setAudioUrl("");
    setMascotMood(
      "listening"
    );

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const mediaRecorder =
        new MediaRecorder(
          stream
        );

      mediaRecorderRef.current =
        mediaRecorder;

      chunksRef.current =
        [];

      mediaRecorder.ondataavailable =
        (event) => {
          if (
            event.data &&
            event.data.size > 0
          ) {
            chunksRef.current.push(
              event.data
            );
          }
        };

      mediaRecorder.onstop =
        () => {
          const blob =
            new Blob(
              chunksRef.current,
              {
                type:
                  "audio/webm",
              }
            );

          const url =
            URL.createObjectURL(
              blob
            );

          setAudioUrl(
            url
          );

          predict(
            blob
          );

          stream
            .getTracks()
            .forEach(
              (track) => {
                track.stop();
              }
            );
        };

      mediaRecorder.start();

      setRecording(
        true
      );
    } catch (error) {
      console.error(
        error
      );

      setMascotMood(
        "ready"
      );

      alert(
        language === "Tamil"
          ? "மைக்ரோஃபோன் அனுமதி தேவை."
          : "මයික්‍රොෆෝන අවසරය අවශ්‍යයි."
      );
    }
  };

  /* =====================================================
     STOP RECORDING
  ===================================================== */

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !==
        "inactive"
    ) {
      mediaRecorderRef.current.stop();

      setRecording(
        false
      );

      setMascotMood(
        "thinking"
      );
    }
  };

  /* =====================================================
     BACKEND PREDICTION
  ===================================================== */

  const predict = async (blob) => {
    setLoading(
      true
    );

    try {
      const data =
        await predictReading({
          language,
          expectedText,
          audioBlob: blob,
        });

      setResult(
        data
      );

      if (
        data?.status ===
        "success"
      ) {
        setMascotMood(
          data
            .accuracy >=
            70
            ? "great"
            : "tryAgain"
        );
      } else {
        setMascotMood(
          "tryAgain"
        );
      }
    } catch (error) {
      console.error(
        error
      );

      setMascotMood(
        "tryAgain"
      );

      alert(
        language === "Tamil"
          ? "பகுப்பாய்வு தோல்வியடைந்தது. Backend server ஐ சரிபார்க்கவும்."
          : "විශ්ලේෂණය අසාර්ථකයි. Backend server එක පරීක්ෂා කරන්න."
      );
    } finally {
      setLoading(
        false
      );
    }
  };

  /* =====================================================
     FEEDBACK
  ===================================================== */

  const getFeedbackMessage = () => {
    if (
      !result ||
      result.status !==
        "success"
    ) {
      return "";
    }

    if (
      language ===
      "Tamil"
    ) {
      if (
        result.accuracy >=
        90
      ) {
        return "🌟 அருமை! நீங்கள் மிகவும் நன்றாக வாசித்தீர்கள். தொடர்ந்து பயிற்சி செய்யுங்கள்!";
      }

      if (
        result.accuracy >=
        70
      ) {
        return "👍 நல்ல முயற்சி! இன்னும் மெதுவாகவும் தெளிவாகவும் வாசிக்க முயற்சி செய்யுங்கள்.";
      }

      return "📚 கவலைப்பட வேண்டாம்! மீண்டும் பயிற்சி செய்து ஒவ்வொரு வார்த்தையையும் தெளிவாகச் சொல்லுங்கள்.";
    }

    if (
      result.accuracy >=
      90
    ) {
      return "🌟 ඉතා හොඳයි! ඔබ ඉතා පැහැදිලිව කියවුවා. තවදුරටත් පුහුණු වන්න!";
    }

    if (
      result.accuracy >=
      70
    ) {
      return "👍 හොඳ උත්සාහයක්! තවත් සෙමින් සහ පැහැදිලිව කියවීමට උත්සාහ කරන්න.";
    }

    return "📚 කණගාටු වෙන්න එපා! නැවත පුහුණු වී සෑම වචනයක්ම පැහැදිලිව කියන්න.";
  };

  /* =====================================================
     NEXT TASK
  ===================================================== */

  const goToNextTask = () => {
    const nextIndex =
      (currentTaskIndex +
        1) %
      taskKeys.length;

    setSelectedTask(
      taskKeys[nextIndex]
    );

    setResult(null);
    setAudioUrl("");

    setMascotMood(
      "ready"
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  };

  /* =====================================================
     RETRY
  ===================================================== */

  const retryCurrentTask = () => {
    setResult(null);

    setAudioUrl("");

    setMascotMood(
      "ready"
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div
      className={`page ${theme}`}
    >
      {/* =========================================
          FULL SCREEN CELEBRATION
      ========================================== */}

      {showFireworks && (
        <div
          className="clap-screen"
          aria-hidden="true"
        >
          {Array.from({
            length: 24,
          }).map(
            (_, index) => (
              <span
                key={
                  index
                }
                className={`clap-hand clap-${
                  index + 1
                }`}
              >
                👏
              </span>
            )
          )}

          <div className="clap-center">

            <div className="big-clap">
              👏
            </div>

            <h2>
              {language ===
              "Tamil"
                ? "அருமை! மிகச் சிறந்த வாசிப்பு!"
                : "අති විශිෂ්ටයි! ඉතා හොඳ කියවීමක්!"}
            </h2>

            <p>
              {language ===
              "Tamil"
                ? "தொடர்ந்து இப்படியே சிறப்பாக வாசியுங்கள்! 🌟"
                : "මේ වගේම හොඳින් කියවන්න! 🌟"}
            </p>

          </div>
        </div>
      )}

      {/* =========================================
          BACKGROUND ICONS
      ========================================== */}

      <div
        className="floating-fun"
        aria-hidden="true"
      >
        <span>⭐</span>
        <span>🌈</span>
        <span>✨</span>
        <span>🎈</span>
        <span>📚</span>
        <span>🪄</span>
      </div>

      {/* =========================================
          SMALL DYNAMIC HEADER
      ========================================== */}

      <header className="small-header">

        <div className="small-header-brand">

          <div className="small-header-icon">
            📖
          </div>

          <div className="small-header-text">

            <h1>
              {
                studentGuide.appTitle
              }
            </h1>

            <p>
              {
                studentGuide.appSubtitle
              }
            </p>

          </div>

        </div>

        <button
          className="small-theme-btn"
          onClick={
            toggleTheme
          }
        >
          {theme === "dark"
            ? language === "Tamil"
              ? "☀️ ஒளி"
              : "☀️ ආලෝක"
            : language === "Tamil"
              ? "🌙 இருள்"
              : "🌙 අඳුරු"}
        </button>

      </header>

      {/* =========================================
          GUIDE STEPS
      ========================================== */}

      <div className="guide-banner">

        <div className="guide-step">
          1️⃣{" "}
          {
            studentGuide.chooseTask
          }
        </div>

        <div className="guide-step">
          2️⃣{" "}
          {
            studentGuide.readTitle
          }
        </div>

        <div className="guide-step">
          3️⃣{" "}
          {
            studentGuide.recordTitle
          }
        </div>

        <div className="guide-step">
          4️⃣{" "}
          {
            studentGuide.resultTitle
          }
        </div>

      </div>

      {/* =========================================
          MAIN
      ========================================== */}

      <main className="container">

        {/* =====================================
            LEFT CARD
        ====================================== */}

        <section className="card child-card">

          {/* TASK -- language is chosen via WriteBright's own header
              toggle, not an in-page control here anymore. */}

          <h2>
            {
              studentGuide.chooseTask
            }
          </h2>

          <select
            value={
              selectedTask
            }
            onChange={(e) => {
              setSelectedTask(
                e.target.value
              );

              setResult(
                null
              );

              setAudioUrl(
                ""
              );

              setMascotMood(
                "ready"
              );
            }}
          >

            {taskKeys.map(
              (task) => (
                <option
                  key={
                    task
                  }
                  value={
                    task
                  }
                >
                  {
                    task
                  }
                </option>
              )
            )}

          </select>

          {/* =====================================
              PROGRESS
          ====================================== */}

          <div className="kid-progress-card">

            <div className="kid-progress-top">

              <strong>
                🏆{" "}
                {
                  childText.progress
                }
              </strong>

              <span>
                {
                  childText.activity
                }{" "}
                {
                  currentTaskIndex +
                  1
                }{" "}
                {
                  childText.of
                }{" "}
                {
                  taskKeys.length
                }
              </span>

            </div>

            <div className="kid-progress-track">

              <div
                className="kid-progress-fill"
                style={{
                  width:
                    `${progressPercent}%`,
                }}
              />

            </div>

          </div>

          {/* =====================================
              INSTRUCTION
          ====================================== */}

          <div className="instruction-box">

            <h3>
              {
                studentGuide.title
              }
            </h3>

            <p>
              {
                studentGuide.line1
              }
            </p>

            <p>
              {
                studentGuide.line2
              }
            </p>

            <p>
              {
                studentGuide.line3
              }
            </p>

          </div>

          {/* =====================================
              TEXT TO READ
          ====================================== */}

          <div
            className={`expected-box ${
              recording
                ? "reading-glow"
                : ""
            }`}
          >

            <h3>
              {
                studentGuide.readTitle
              }
            </h3>

            <p>
              {
                expectedText
              }
            </p>

          </div>

          {/* =====================================
              RECORDING TITLE
          ====================================== */}

          <h2>
            {
              studentGuide.recordTitle
            }
          </h2>

          {/* =====================================
              RECORDING
          ====================================== */}

          <div className="record-area">

            {!recording ? (

              <button
                className="start-btn"
                onClick={
                  startRecording
                }
              >
                {
                  studentGuide.startBtn
                }
              </button>

            ) : (

              <button
                className="stop-btn"
                onClick={
                  stopRecording
                }
              >
                {
                  studentGuide.stopBtn
                }
              </button>

            )}

            {recording && (
              <>

                <div
                  className="voice-animation"
                  aria-hidden="true"
                >
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <p className="recording-text">
                  {
                    studentGuide.recordingText
                  }
                </p>

              </>
            )}

          </div>

          {/* =====================================
              AUDIO PLAYBACK
          ====================================== */}

          {audioUrl && (

            <div className="audio-box">

              <p>
                {
                  studentGuide.audioText
                }
              </p>

              <audio
                controls
                src={
                  audioUrl
                }
              />

            </div>

          )}

        </section>

        {/* =====================================
            RESULT CARD
        ====================================== */}

        <section className="card result-card">

          <h2>
            {
              studentGuide.resultTitle
            }
          </h2>

          {/* =====================================
              LOADING
          ====================================== */}

          {loading && (

            <div className="loading-box">

              <div className="loader" />

              <p>
                {
                  studentGuide.analyzingText
                }
              </p>

            </div>

          )}

          {/* =====================================
              EMPTY RESULT
          ====================================== */}

          {!result &&
            !loading && (

              <div className="empty-result">

                <h3>
                  {
                    studentGuide.emptyTitle
                  }
                </h3>

                <p>
                  {
                    studentGuide.emptyText
                  }
                </p>

              </div>

            )}

          {/* =====================================
              SUCCESS
          ====================================== */}

          {result &&
            result.status ===
              "success" && (
              <>

                {/* =====================================
                    EXPECTED / PREDICTED TEXT
                ====================================== */}

                <div className="result-box">

                  <h3>
                    {
                      studentGuide.expectedLabel
                    }
                  </h3>

                  <p>
                    {
                      result.expected_text
                    }
                  </p>

                  <h3>
                    {
                      studentGuide.predictedLabel
                    }
                  </h3>

                  <p>
                    {
                      result.predicted_text
                    }
                  </p>

                </div>

                {/* =====================================
                    STATUS
                ====================================== */}

                <div className="status">

                  {result.error_type ===
                  "Correct" ? (

                    <span className="correct">
                      {
                        studentGuide.correctReading
                      }
                    </span>

                  ) : (

                    <span className="wrong">
                      ❌{" "}
                      {
                        translateResultValue(
                          result.error_type
                        )
                      }
                    </span>

                  )}

                </div>

                {/* =====================================
                    CELEBRATION CARD
                ====================================== */}

                {isCorrectAnswer && (

                  <div className="celebration-box">

                    <div className="confetti">

                      <span>⭐</span>
                      <span>🎉</span>
                      <span>🌟</span>
                      <span>👏</span>
                      <span>🎊</span>

                    </div>

                    <h2 className="celebration-title">
                      {
                        studentGuide.celebrationTitle
                      }
                    </h2>

                    <p className="celebration-text">
                      {
                        studentGuide.celebrationText
                      }
                    </p>

                  </div>

                )}

                {/* =====================================
                    ACCURACY SCORE
                ====================================== */}

                <div className="big-score">

                  <h3>
                    {
                      result.accuracy
                    }
                    %
                  </h3>

                  <p>
                    {
                      studentGuide.accuracyLabel
                    }
                  </p>

                  <div
                    className="earned-stars"
                    aria-label={`${earnedStars} ${childText.stars}`}
                  >

                    {[1, 2, 3].map(
                      (star) => (

                        <span
                          key={
                            star
                          }
                          className={
                            star <=
                            earnedStars
                              ? "star-earned"
                              : "star-empty"
                          }
                        >
                          ⭐
                        </span>

                      )
                    )}

                  </div>

                </div>

                {/* =====================================
                    READING METRICS
                ====================================== */}

                <div className="metrics">

                  {/* WER */}

                  <div>

                    <h3>
                      {
                        result.wer
                      }
                    </h3>

                    <p>
                      WER
                    </p>

                  </div>

                  {/* READING TIME */}

                  <div>

                    <h3>
                      {
                        result.duration
                      }
                      s
                    </h3>

                    <p>
                      {
                        studentGuide.readingTime
                      }
                    </p>

                  </div>

                  {/* SPEECH RATE */}

                  <div>

                    <h3>
                      {
                        result.speech_rate
                      }
                    </h3>

                    <p>
                      {
                        studentGuide.wordsPerSecond
                      }
                    </p>

                  </div>

                  {/* LANGUAGE */}

                  <div>

                    <h3>
                      {
                        displayLanguage
                      }
                    </h3>

                    <p>
                      {
                        studentGuide.languageLabel
                      }
                    </p>

                  </div>

                </div>

                {/* =====================================
                    VOICE ANALYSIS
                ====================================== */}

                <h2>
                  {
                    studentGuide.voiceAnalysis
                  }
                </h2>

                <div className="metrics">

                  {/* VOICE ENERGY */}

                  <div>

                    <h3>
                      {
                        translateResultValue(
                          result.voice_energy
                        )
                      }
                    </h3>

                    <p>
                      {
                        studentGuide.voiceEnergy
                      }
                    </p>

                  </div>

                  {/* CONFIDENCE */}

                  <div>

                    <h3>
                      {
                        translateResultValue(
                          result.confidence
                        )
                      }
                    </h3>

                    <p>
                      {
                        studentGuide.confidence
                      }
                    </p>

                  </div>

                  {/* SPEECH BEHAVIOUR */}

                  <div>

                    <h3>
                      {
                        translateResultValue(
                          result.speech_behavior
                        )
                      }
                    </h3>

                    <p>
                      {
                        studentGuide.speechBehavior
                      }
                    </p>

                  </div>

                  {/* ERROR TYPE */}

                  <div>

                    <h3>
                      {
                        translateResultValue(
                          result.error_type
                        )
                      }
                    </h3>

                    <p>
                      {
                        studentGuide.errorType
                      }
                    </p>

                  </div>

                </div>

                {/* =====================================
                    FEEDBACK
                ====================================== */}

                <div className="feedback-box">

                  <h3>
                    {
                      studentGuide.feedbackTitle
                    }
                  </h3>

                  <p>
                    {
                      getFeedbackMessage()
                    }
                  </p>

                </div>

                {/* =====================================
                    PRACTICE TIPS
                ====================================== */}

                <div className="practice-tips">

                  <h3>
                    {
                      studentGuide.tipsTitle
                    }
                  </h3>

                  <ul>

                    <li>
                      {
                        studentGuide.tip1
                      }
                    </li>

                    <li>
                      {
                        studentGuide.tip2
                      }
                    </li>

                    <li>
                      {
                        studentGuide.tip3
                      }
                    </li>

                  </ul>

                </div>

                {/* =====================================
                    BUTTONS
                ====================================== */}

                <div className="kid-actions">

                  <button
                    className="retry-btn"
                    onClick={
                      retryCurrentTask
                    }
                  >
                    {
                      childText.retry
                    }
                  </button>

                  <button
                    className="next-btn"
                    onClick={
                      goToNextTask
                    }
                  >
                    {
                      childText.next
                    }
                  </button>

                </div>

              </>
            )}

          {/* =====================================
              BACKEND ERROR
          ====================================== */}

          {result &&
            result.status ===
              "error" && (

              <p className="wrong">
                {language === "Tamil"
                  ? `பிழை: ${result.message}`
                  : `දෝෂය: ${result.message}`}
              </p>

            )}

        </section>

      </main>

    </div>
  );
}