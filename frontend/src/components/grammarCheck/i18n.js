export const ERROR_META = {
  correct:     { icon:'✓', label:'නිවැරදි අක්ෂර වින්‍යාස',                         cls:'err-correct',     color:'#1a9e5c' },
  retroflex:   { icon:'ළ', label:'සමාන අකුරු පටලැවීම',                cls:'err-retroflex',   color:'#d97706' },
  vowel:       { icon:'ී', label:'ස්වර ලකුණු වැරදීම',                  cls:'err-vowel',       color:'#7c3aed' },
  zwj:         { icon:'‍', label:'එකට ලියැවෙන අකුරු වැරදීම',          cls:'err-zwj',         color:'#2563eb' },
  boundary:    { icon:'↔', label:'වචන අතර හිස්තැන් වැරදීම',           cls:'err-boundary',    color:'#0891b2' },
  punctuation: { icon:'.', label:'විරාම ලකුණු වැරදීම',                cls:'err-punctuation', color:'#ea580c' },
  missing:     { icon:'+', label:'අකුරු හෝ වචන අඩුවීම',                cls:'err-missing',     color:'#d97706' },
  other:       { icon:'?', label:'වෙනත් වැරදීමක්',                    cls:'err-other',       color:'#d63b3b' },
};

export const ERROR_META_TA = {
  correct:     { icon:'✓', label:'சரி',                                cls:'err-correct',     color:'#1a9e5c' },
  retroflex:   { icon:'ழ', label:'ஒத்த எழுத்து குழப்பம்',              cls:'err-retroflex',   color:'#d97706' },
  vowel:       { icon:'ீ', label:'உயிர்க்குறி பிழை',                    cls:'err-vowel',       color:'#7c3aed' },
  // Tamil script has no ZWJ/conjunct-joiner concept the way Sinhala does
  // (see trusted_lexicon_ta.py) -- this key is kept only for structural
  // parity with ERROR_META; the backend never emits error_type "zwj" for
  // Tamil, so it never actually renders.
  zwj:         { icon:'‍', label:'இணைப்பு பிழை',                       cls:'err-zwj',         color:'#2563eb' },
  boundary:    { icon:'↔', label:'சொல் இடைவெளி பிழை',                  cls:'err-boundary',    color:'#0891b2' },
  punctuation: { icon:'.', label:'நிறுத்தற்குறி பிழை',                  cls:'err-punctuation', color:'#ea580c' },
  missing:     { icon:'+', label:'எழுத்து/சொல் குறைபாடு',               cls:'err-missing',     color:'#d97706' },
  other:       { icon:'?', label:'மற்ற பிழை',                           cls:'err-other',       color:'#d63b3b' },
};

// NOTE: these labels MUST match the backend's ERROR_PROFILE_LABELS exactly
// -- hybrid_corrector.py for Sinhala, hybrid_corrector_ta.py for Tamil --
// because skill_scores in the /analyze response is keyed by these same
// strings, and the skill chart below looks scores up by key.
export const ERROR_PROFILE_LABELS = {
  retroflex:   'සමාන අකුරු පටලැවීම - මූර්ධජ/ තාලුජ්/ මහප්‍රාණ අක්ෂ‍ර පටලැවීම (ල/ළ, න/ණ, ට/ත, ද/ඩ)',
  vowel:       'ස්වර ලකුණු වැරදීම  - ඉස්පිලි/ පාපිලි ආදී පිල්ලම් (කෙටි/දිගු -  ු   ූ  ්  ා  ැ  ි  ී)',
  zwj:         'එකට ලියැවෙන අකුරු වැරදීම  - ව්‍යාංජනාක්ෂර එකතු වී සෑදෙන සංයෝග අකුරු වැරදීම (ක්‍ර, ශ්‍ර, ක්‍ය වැනි)',
  boundary:    'වචන අතර හිස්තැන් වැරදීම',
  punctuation: 'විරාම ලකුණු වැරදීම (. , ?))',
  missing:     'අකුරු හෝ වචන අඩුවීම',
  other:       'වෙනත් වැරදීමක්',
};

// Mirrors hybrid_corrector_ta.py's ERROR_PROFILE_LABELS values character
// for character -- if that Python dict's text ever changes, update here
// too or the Tamil skill chart's colors/ordering silently stop matching.
export const ERROR_PROFILE_LABELS_TA = {
  retroflex:   'ஒத்த எழுத்துக்கள் குழப்பம் - மூர்த்தன்ய/பல்/மகாபிராண எழுத்துக்கள் குழப்பம் (ண/ந/ன, ள/ழ/ல, ட/த, ர/ற)',
  vowel:       'உயிர்க்குறிகள் தவறுதல் - குறில்/நெடில் உயிர்க்குறிகள் மற்றும் மாத்திரைகள் (ி/ீ, ு/ூ, ெ/ே, ொ/ோ)',
  boundary:    'சொற்களுக்கு இடையிலான இடைவெளி தவறுதல்',
  punctuation: 'நிறுத்தற்குறிகள் தவறுதல் (. , ?)',
  missing:     'எழுத்துக்கள் அல்லது சொற்கள் விடுபடுதல்',
  other:       'வேறு வகையான தவறு',
};

export const SKILL_COLORS = {
  [ERROR_PROFILE_LABELS.retroflex]:   '#d97706',
  [ERROR_PROFILE_LABELS.vowel]:       '#7c3aed',
  [ERROR_PROFILE_LABELS.zwj]:         '#2563eb',
  [ERROR_PROFILE_LABELS.boundary]:    '#0891b2',
  [ERROR_PROFILE_LABELS.punctuation]: '#ea580c',
  [ERROR_PROFILE_LABELS.missing]:     '#d97706',
  [ERROR_PROFILE_LABELS.other]:       '#d63b3b',
};

export const SKILL_COLORS_TA = {
  [ERROR_PROFILE_LABELS_TA.retroflex]:   '#d97706',
  [ERROR_PROFILE_LABELS_TA.vowel]:       '#7c3aed',
  [ERROR_PROFILE_LABELS_TA.boundary]:    '#0891b2',
  [ERROR_PROFILE_LABELS_TA.punctuation]: '#ea580c',
  [ERROR_PROFILE_LABELS_TA.missing]:     '#d97706',
  [ERROR_PROFILE_LABELS_TA.other]:       '#d63b3b',
};

// ── Static upload/loading/dashboard chrome in both languages. Everything
// the BACKEND produces (feedback_si/feedback_en/grammar_note/error labels)
// already comes back in the right language per request -- see
// hybrid_corrector_ta.py's module docstring -- so only this hardcoded
// HTML/JS-generated text needs a manual translation table.
export const UI_TEXT = {
  si: {
    eyebrow: 'ශිෂ්‍යයාගේ ලිවීම විශ්ලේෂණය කිරීම',
    title: 'අක්ෂර වින්‍යාස, ව්‍යාකරණ පරීක්ෂාව',
    // history page (HistoryPage.jsx's grammar-check section)
    historyHeading: 'අක්ෂර වින්‍යාස, ව්‍යාකරණ දෝෂ පරීක්ෂණ',
    historyLabel: 'අක්ෂර වින්‍යාස, ව්‍යාකරණ දෝෂ පරීක්ෂාව',
    photoHeading: 'ඡායාරූපය එක් කරන්න',
    dropTitle: 'ඡායාරූපය මෙතැනට දමන්න',
    takePhoto: 'ඡායාරූපයක් ගන්න',
    choosePhoto: 'ඡායාරූපයක් තෝරන්න',
    submit: 'පරීක්ෂා කරන්න',
    // loading screen
    loadingText: 'අත්අකුරු විශ්ලේෂණය කරමින්…',
    loadingSub: 'මඳක් රැඳී සිටින්න…',
    steps: ['පිටුවෙන් පේළි වෙන් කරමින්', 'එක් එක් පේළිය කියවමින්',
            'අක්ෂර වින්‍යාසය නිවැරදි කරමින්', 'වැරදි වර්ග වර්ගීකරණය කරමින්',
            'කුසලතා පුවරුව සකසමින්'],
    // dashboard/results screen chrome
    dashTitle: 'ලිවීමේ විශ්ලේෂණ වාර්තාව',
    dashSub: 'සිසුවාගේ අත්අකුරු වැරදි සොයාගෙන කුසලතා පෙන්වයි',
    btnNewPage: '+ නව පිටුවක්',
    btnNewPageTitle: 'තවත් පිටුවක් උඩුගත කරන්න — කුසලතා පැතිකඩ එකතු වේ',
    btnNewSession: '↺ නව සැසියක්',
    btnNewSessionTitle: 'සැසි ඉතිහාසය මකා අලුතින් ආරම්භ කරන්න',
    skillSectionTitle: 'කුසලතා පැතිකඩ',
    skillSectionSub: '— පසුගිය දින 30 තුළ ලියූ ගණනට සාපේක්ෂව වැරදි නැවත නැවත සිදුවන ප්‍රමාණය (%)',
    errorSectionTitle: 'මෑත අක්ෂර වින්‍යාස දෝෂ ප්‍රතිඵල',
    tipsTitle: 'සංශෝධන ඉඟි',
    encourageTitle: 'දිගටම ලියන්න!',
    encourageSub: 'සෑම දිනකම ටිකක් ලියන එක ඔබව දක්ෂ කරයි.',
    linesSectionTitle: 'අක්ෂර වින්‍යාස දෝෂ පරීක්ෂාව',
    sessionBadge: (n) => `— උඩුගත කිරීම් ${n}ක එකතුව`,
    scoreCards: (accuracy, total, correct) => [
      { label:'නිරවද්‍යතාවය', value:`${accuracy}%`, sub:`මුළු පේළි ${total}න් ${correct}ක් නිවැරදියි` },
      { label:'මුළු පේළි ගණන', value:total, sub:'විශ්ලේෂණය කළ පේළි' },
      { label:'නිවැරදි පේළි', value:correct, sub:'හරියටම ලියා ඇත' },
      { label:'හමු වූ වැරදි', value:total-correct, sub:'අවධානය යොමු කළ යුතු පේළි' },
    ],
    noAnalysisFallback: 'විශ්ලේෂණය සම්පූර්ණයි',
    noErrorsFound: '🎉 වැරදි කිසිවක් හමු නොවීය!',
    machineRead: 'දරුවා ලියා ඇත්තේ :',
    linesHeader: ['', 'අක්ෂර වින්‍යාස දෝෂ පරීක්ෂාව', 'වැරදි වර්ගය', 'වෙනස්කම්'],
    sentencesTitle: 'ව්‍යාකරණ දෝෂ පරීක්ෂාව',
    sentencesSub: '— වඩාත් නිවැරදි හා අර්ථවත් වාක්‍ය ලියමු.',
    linesMerged: 'පේළි ගළපා ඇත',
    singleWordNote: 'තනි වචනයක් — සම්පූර්ණ වාක්‍යයක් නොවේ',
    // Translates the backend's fixed-format English correction_note for
    // DISPLAY only (the English text itself is also pattern-matched for
    // error classification server-side, so its format can't change).
    notePhrases: [
      [/^dataset:[a-z_]+:\s*/i, ''],
      [/ZWJ inserted:/gi,        'සංයෝග ලකුණ එකතු කළා:'],
      [/Moved leading '(.+?)' to end/gi, "විරාම ලකුණ '$1' අගට ගෙන ගියා"],
      [/Word boundary:/gi,       'වචන බෙදීම:'],
      [/^spell:\s*/gi,           'අක්ෂර වින්‍යාසය: '],
      [/no changes/gi,           'වෙනසක් නැත'],
      [/empty/gi,                ''],
    ],
  },
  ta: {
    // upload screen -- same photo-upload copy as WriteBright's own
    // AnalyzePage (analyze.photoHeading/dropTitle/takePhoto/choosePhoto/
    // submit in i18n/translations.js), reused verbatim since this screen
    // now shares that exact layout/styling; eyebrow/title stay specific
    // to this component's own topic.
    eyebrow: 'மாணவரின் எழுத்தை பகுப்பாய்வு செய்தல்',
    title: 'எழுத்துப் பிழை, இலக்கணப் பிழை சரிபார்ப்பு',
    // history page (HistoryPage.jsx's grammar-check section)
    historyHeading: 'எழுத்துப் பிழை, இலக்கணப் பிழை பரிசோதனைகள்',
    historyLabel: 'எழுத்துப் பிழை, இலக்கணப் பிழை சரிபார்ப்பு',
    photoHeading: 'புகைப்படத்தைச் சேர்க்கவும்',
    dropTitle: 'புகைப்படத்தை இங்கே விடுங்கள்',
    takePhoto: 'புகைப்படம் எடு',
    choosePhoto: 'புகைப்படம் தேர்வு செய்',
    submit: 'சரிபார்',
    // loading screen
    loadingText: 'கையெழுத்தை பகுப்பாய்வு செய்கிறது…',
    loadingSub: 'சிறிது நேரம் காத்திருக்கவும்…',
    steps: ['பக்கத்திலிருந்து வரிகளை பிரிக்கிறது', 'ஒவ்வொரு வரியையும் படிக்கிறது',
            'எழுத்துப் பிழைகளை திருத்துகிறது', 'பிழை வகைகளை வகைப்படுத்துகிறது',
            'திறன் பலகையை தயார் செய்கிறது'],
    // dashboard/results screen chrome
    dashTitle: 'எழுத்து பகுப்பாய்வு அறிக்கை',
    dashSub: 'மாணவரின் கையெழுத்துப் பிழைகளை கண்டறிந்து திறன்களைக் காட்டுகிறது',
    btnNewPage: '+ புதிய பக்கம்',
    btnNewPageTitle: 'மேலும் ஒரு பக்கத்தை பதிவேற்றவும் — திறன் விவரக்குறிப்பு சேர்க்கப்படும்',
    btnNewSession: '↺ புதிய அமர்வு',
    btnNewSessionTitle: 'அமர்வு வரலாற்றை அழித்து புதிதாக தொடங்கவும்',
    skillSectionTitle: 'திறன் விவரக்குறிப்பு',
    skillSectionSub: '— கடந்த 30 நாட்களில் எழுதிய எழுத்துக்களுக்கு ஒப்பீட்டில் அந்த வகை பிழை மீண்டும் மீண்டும் நிகழும் அளவு (%)',
    errorSectionTitle: 'பிழை வகை வாரியான எண்ணிக்கை',
    tipsTitle: 'திருத்த குறிப்புகள்',
    encourageTitle: 'தொடர்ந்து எழுதுங்கள்!',
    encourageSub: 'ஒவ்வொரு நாளும் கொஞ்சம் எழுதுவது உங்களை திறமையாக்கும்.',
    linesSectionTitle: 'வரி வாரியான பகுப்பாய்வு',
    sessionBadge: (n) => `— ${n} பதிவேற்றங்களின் கூட்டுத்தொகை`,
    scoreCards: (accuracy, total, correct) => [
      { label:'துல்லியம்', value:`${accuracy}%`, sub:`மொத்தம் ${total} வரிகளில் ${correct} சரியானவை` },
      { label:'மொத்த வரிகள்', value:total, sub:'பகுப்பாய்வு செய்யப்பட்ட வரிகள்' },
      { label:'சரியான வரிகள்', value:correct, sub:'சரியாக எழுதப்பட்டவை' },
      { label:'கண்டறியப்பட்ட பிழைகள்', value:total-correct, sub:'கவனம் தேவைப்படும் வரிகள்' },
    ],
    noAnalysisFallback: 'பகுப்பாய்வு முடிந்தது',
    noErrorsFound: '🎉 எந்த பிழையும் கிடைக்கவில்லை!',
    machineRead: 'இயந்திரம் படித்தது:',
    linesHeader: ['#', 'வரி படம் + திருத்தப்பட்ட உரை', 'பிழை வகை', 'மாற்றங்கள்'],
    sentencesTitle: 'முழு வாக்கியங்கள்',
    sentencesSub: '— வரிகளை இணைத்து முழு வாக்கியங்களாக்கி, இலக்கணம் சரிபார்க்கப்பட்டது',
    linesMerged: 'வரிகள் இணைக்கப்பட்டன',
    singleWordNote: 'தனி வார்த்தை — முழு வாக்கியம் அல்ல',
    notePhrases: [
      [/^dataset:[a-z_]+:\s*/i, ''],
      [/Moved leading '(.+?)' to end/gi, "நிறுத்தற்குறி '$1' முடிவுக்கு நகர்த்தப்பட்டது"],
      [/Word boundary:/gi,       'சொல் இடைவெளி:'],
      [/^spell:\s*/gi,           'எழுத்துப் பிழை: '],
      [/no changes/gi,           'மாற்றம் இல்லை'],
      [/empty/gi,                ''],
    ],
  },
};
