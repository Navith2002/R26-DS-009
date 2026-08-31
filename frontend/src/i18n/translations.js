export const UI_LANGUAGES = {
  sinhala: { code: 'sinhala', native: 'සිංහල', short: 'සිං' },
  tamil: { code: 'tamil', native: 'தமிழ்', short: 'தமி' },
};

const translations = {
  sinhala: {
    // Global / navigation
    'nav.home': 'මුල් පිටුව',
    'nav.check': 'මගේ ලිවීම පරීක්ෂා කරන්න',
    'nav.checkShort': 'පරීක්ෂා',
    'nav.progress': 'මගේ ප්‍රගතිය',
    'nav.progressShort': 'ප්‍රගතිය',
    'nav.practice': 'පුහුණුව',
    'nav.history': 'ඉතිහාසය',
    'nav.grammarCheck': 'අක්ෂර වින්‍යාස, ව්‍යාකරණ පරීක්ෂාව',
    'nav.grammarCheckShort': 'දෝෂ පරීක්ෂාව',
    'nav.fluency': 'කියවුම් හැකියාව',
    'nav.fluencyShort': 'කියවුම',
    'nav.readingError': 'කියවීම් දෝෂ පරීක්ෂාව',
    'nav.readingErrorShort': 'දෝෂ',
    'nav.profile': 'පැතිකඩ',
    'header.ready': 'පුංචි පුහුණුවකට සූදානම්ද? 👋',
    'header.hi': 'හෙලෝ, {name}!',
    'header.learner': 'ඉගෙනුම්කරු',
    'header.student': 'ශිෂ්‍යයා',
    'header.teacher': 'ගුරුවරයා',
    'header.parent': 'දෙමාපිය',
    'header.researcher': 'පර්යේෂකයා',
    'header.notifications': 'දැනුම්දීම්',
    'sidebar.helpTitle': 'පුංචි පියවර, ලොකු ප්‍රගතියක්!',
    'sidebar.helpText': 'එක් කුඩා කුසලතාවක් පුහුණු කරලා, ඔබේ ලිවීම නැවත පරීක්ෂා කරන්න.',
    'language.switchLabel': 'භාෂාව සහ ලිවීමේ මාදිලිය',
    'language.sinhala': 'සිංහල',
    'language.tamil': 'தமிழ்',
    'language.sinhalaModel': 'සිංහල අත්අකුරු මාදිලිය',
    'language.tamilModel': 'දෙමළ අත්අකුරු මාදිලිය',

    // Home
    'home.badge': 'ඉගෙන ගන්න · දියුණු වන්න',
    'home.title': 'අත්අකුරු පරීක්ෂා කරමු',
    'home.subtitle': 'ලියන්න, පැහැදිලි ඡායාරූපයක් ගන්න, ඊළඟ පුහුණුවට හිතකාමී උපදෙස් ලබා ගන්න.',
    'home.check': 'පරීක්ෂා කරන්න',
    'home.practice': 'පුහුණුව',
    'home.whatDo': 'ආරම්භ කරන්න',
    'home.practiceGames': 'පුහුණු ක්‍රියාකාරකම් බලන්න',
    'home.checkSinhala': 'සිංහල අත්අකුරු පරීක්ෂා කරන්න',
    'home.checkTamil': 'දෙමළ අත්අකුරු පරීක්ෂා කරන්න',
    'home.takePhoto': 'ඡායාරූපයක් ගන්න',
    'home.takePhotoText': 'ලියා අවසන් වූ පසු කැමරාව භාවිතා කරන්න',
    'home.choosePhoto': 'ඡායාරූපයක් තෝරන්න',
    'home.choosePhotoText': 'දැනටමත් තිබෙන අත්අකුරු ඡායාරූපයක් තෝරන්න',
    'home.journey': 'ප්‍රගතිය',
    'home.viewProgress': 'මගේ ප්‍රගතිය බලන්න',
    'home.latestLevel': 'අවසන් පිළිගත් අත්අකුරු මට්ටම',
    'home.readyBegin': 'ආරම්භ කිරීමට සූදානම්!',
    'home.firstResult': 'ඔබේ පළමු සම්පූර්ණ ප්‍රතිඵලය මෙහි පෙන්වයි.',
    'home.completedChecks': 'සම්පූර්ණ කළ ලිවීමේ පරීක්ෂණ',
    'home.goodResults': 'හොඳ හෝ ඉතා හොඳ ප්‍රතිඵල',
    'home.activity': 'ලිවීමේ ක්‍රියාකාරකම්',
    'home.recentTries': 'මෑත උත්සාහ',
    'home.total': 'මුළු',
    'home.finished': 'සම්පූර්ණ',
    'home.tryAgain': 'නැවත උත්සාහ',
    'home.recentWriting': 'මෑත අත් අකුරු ප්‍රතිඵල',
    'home.seeAll': 'සියල්ල බලන්න',
    'home.teacherReview': 'ගුරු සමාලෝචනය',
    'home.completed': 'සම්පූර්ණයි',
    'home.tryAgainShort': 'නැවත උත්සාහ කරන්න',
    'home.noChecks': 'තවම ලිවීමේ පරීක්ෂණ නැහැ',
    'home.noChecksText': 'ඔබේ මෑත අත්අකුරු ප්‍රතිඵල මෙහි පෙන්වයි.',
    'home.tipTitle': 'අද පුංචි උපදෙස',
    'home.tipText': 'වචන අතර ඉඩ සමානව තබන්න. කුඩා, සමාන ඉඩ ලිවීම කියවීමට පහසු කරයි.',

    // Analyze
    'analyze.eyebrow': 'මගේ ලිවීම පරීක්ෂා කරන්න',
    'analyze.title': 'අත්අකුරු පරීක්ෂාව',
    'analyze.subtitle': 'ඉහළ දකුණු කෙළවරේ තෝරා ඇති භාෂාවට ගැළපෙන අත්අකුරු මාදිලිය භාවිතා කරයි. පැහැදිලි ඡායාරූපයක් එක් කරන්න; භාවිතයට සුදුසු නම් ප්‍රතිඵලය සහ විශ්වාස ප්‍රතිශතය පෙන්වයි.',
    'analyze.ready': 'පරීක්ෂා කිරීමට සූදානම්!',
    'analyze.notReady': 'තවම සූදානම් නැහැ',
    'analyze.chooseBegin': 'ආරම්භ කිරීමට ඡායාරූපයක් තෝරන්න',
    'analyze.connectionHelp': 'යෙදුමේ සම්බන්ධතාවය ගුරුවරයෙකු හෝ දෙමාපියෙකු සමඟ පරීක්ෂා කරන්න',
    'analyze.modelHeading': 'තෝරාගත් අත්අකුරු මාදිලිය',
    'analyze.modelText': 'ඉහළ භාෂා බොත්තම මාරු කළ විට UI සහ විශ්ලේෂණ මාදිලිය දෙකම මාරු වේ.',
    'analyze.photoHeading': 'ඡායාරූපය එක් කරන්න',
    'analyze.photoText': 'සම්පූර්ණ ලිවීමේ පිටුව ඡායාරූපයේ ඇතුළත තබන්න.',
    'analyze.dropTitle': 'ඡායාරූපය මෙතැනට දමන්න',
    'analyze.orChoose': 'නැත්නම් පහත විකල්පයකින් තෝරන්න',
    'analyze.takePhoto': 'ඡායාරූපයක් ගන්න',
    'analyze.choosePhoto': 'ඡායාරූපයක් තෝරන්න',
    'analyze.maxFile': 'PNG, JPG/JPEG, BMP, TIF/TIFF · උපරිම 10 MB',
    'analyze.selectedAlt': 'තෝරාගත් අත්අකුරු ඡායාරූපය',
    'analyze.removePhoto': 'තෝරාගත් ඡායාරූපය ඉවත් කරන්න',
    'analyze.changePhoto': 'වෙනත් ඡායාරූපයක් තෝරන්න',
    'analyze.bestPhoto': 'පැහැදිලි ඡායාරූපයක් භාවිතා කරන්න',
    'analyze.bestPhotoText': 'ඉහළින් සෘජුව ඡායාරූපය ගන්න, පිටුව හොඳින් ආලෝකමත් කරන්න, සෙවනැලි වළක්වන්න, ලිවීම බොඳ හෝ කපා නොතිබෙන බව බලන්න.',
    'analyze.checking': 'ඔබේ ලිවීම පරීක්ෂා කරමින්…',
    'analyze.submit': 'පරීක්ෂා කරන්න',
    'analyze.errNoFile': 'පළමුව අත්අකුරු ඡායාරූපයක් තෝරන්න.',
    'analyze.errLarge': 'මෙම ඡායාරූපය විශාල වැඩියි. 10 MB ට අඩු රූපයක් තෝරන්න.',
    'analyze.errType': 'PNG, JPG/JPEG, BMP, TIF හෝ TIFF රූපයක් භාවිතා කරන්න.',
    'analyze.errGeneric': 'දැනට මෙම අත්අකුරු පරීක්ෂා කිරීමට නොහැකි විය. නැවත උත්සාහ කරන්න.',

    // Results
    'results.newCheck': 'නව ලිවීමක් පරීක්ෂා කරන්න',
    'results.checkId': 'ලිවීමේ පරීක්ෂණය {id}',
    'results.level': 'අත්අකුරු මට්ටම',
    'results.confidence': 'විශ්වාසය',
    'results.teacherReview': 'ගුරු සමාලෝචනය',
    'results.teacherReviewText': 'මාදිලියේ ප්‍රතිඵලය ඉහළින් පෙන්වා ඇත; අඩු විශ්වාසයක් ඇති නිසා ගුරුවරයෙකුට එය තහවුරු කළ හැක.',
    'results.topTip': 'පුහුණු කරන්න',
    'results.seeProgress': 'මගේ ප්‍රගතිය බලන්න',
    'results.best3': 'ප්‍රධාන 3',
    'results.extra2': 'අමතර 2',
    'results.noWeakness': 'මෙම නියැදිය සඳහා විශේෂ අත්අකුරු දුර්වලතාවක් හඳුනාගෙන නැහැ.',
    'results.keepGood': 'හොඳ වැඩ දිගටම කරගෙන යන්න!',
    'results.nextStep': 'ඊළඟ පියවර',
    'results.practiceAgain': 'පුහුණු වී නැවත උත්සාහ කරන්න',
    'results.practiceAgainText': 'පළමු ප්‍රමුඛ උපදෙසෙන් ආරම්භ කර විනාඩි කිහිපයක් පුහුණු වී පසුව තවත් අත්අකුරු නියැදියක් පරීක්ෂා කරන්න.',
    'results.goPractice': 'පුහුණුවට යන්න →',
    'results.priority': 'ප්‍රමුඛ',
    'results.practice': 'පුහුණු කරන්න →',
    'results.extraTip': 'අමතර පුහුණු උපදෙස',
    'results.tryIt': 'උත්සාහ කරන්න',
    'results.segEyebrow': 'කොටස් වෙන් කිරීමේ පරීක්ෂාව',
    'results.segTitle': 'වෙන්කිරීම',
    'results.views': 'දසුන් {count}',
    'results.segHelper': 'මෙම පෙරදසුන් මඟින් ව්‍යුහාත්මක විශ්ලේෂණයට භාවිතා කළ පේළි, වචන සහ අකුරු/අක්ෂර කලාප වෙන් කිරීම පරීක්ෂා කළ හැක.',
    'results.lines': 'පේළි',
    'results.words': 'වචන',
    'results.characters': 'අකුරු / අක්ෂර කලාප',
    'results.combined': 'එකතුව',
    'results.lineRegions': 'වාක්‍ය / පේළි කලාප',
    'results.wordRegions': 'හඳුනාගත් වචන කලාප',
    'results.characterRegions': 'ව්‍යුහාත්මක අක්ෂර කලාප',
    'results.combinedRegions': 'පේළි, වචන සහ අක්ෂර කලාප එකට',
    'results.teacherDetails': 'ගුරු / පර්යේෂණ විස්තර',
    'results.analysisStatus': 'විශ්ලේෂණ තත්ත්වය',
    'results.modelClass': 'මාදිලි පන්තිය',
    'results.review': 'ගුරු සමාලෝචනය',
    'results.recommended': 'නිර්දේශිතයි',
    'results.notRequired': 'අවශ්‍ය නැහැ',
    'results.segGate': 'වෙන්කිරීමේ තත්ත්වය',
    'results.probabilities': 'පන්ති සම්භාවිතා බෙදාහැරීම',
    'results.issueExplanations': 'විශේෂාංග මට්ටමේ ගැටලු පැහැදිලි කිරීම',
    'results.inputMeasurements': 'ආදාන-ගුණාත්මක මිනුම්',
    'results.structuralFeatures': 'ලබාගත් ව්‍යුහාත්මක විශේෂාංග',
    'results.processingOutputs': 'සැකසුම් ප්‍රතිදාන',
    'results.uploaded': 'උඩුගත කළ රූපය',
    'results.skewCorrected': 'ඇලවීම නිවැරදි කළ',
    'results.shadowRemoved': 'සෙවනැලි ඉවත් කළ',
    'results.contrastEnhanced': 'කොන්ත්‍රාස්ට් වැඩි කළ',
    'results.binarized': 'ද්විමය රූපය',
    'results.ruledRemoved': 'රේඛා ඉවත් කළ',
    'results.lineSeg': 'පේළි වෙන්කිරීම',
    'results.wordSeg': 'වචන වෙන්කිරීම',
    'results.charSeg': 'අකුරු / අක්ෂර කලාප වෙන්කිරීම',
    'results.combinedSeg': 'එකතු වෙන්කිරීම',
    'results.retake': 'වෙනත් ඡායාරූපයක් ගන්න',
    'results.back': 'ආපසු',
    'results.resultNotFound': 'ප්‍රතිඵලය හමු නොවීය',
    'results.resultNotFoundText': 'මෙම බ්‍රවුසරයේ ඉතිහාසය තුළ මෙම ප්‍රතිඵලය නොමැත.',
    'results.yourCheck': 'ඔබේ ලිවීමේ පරීක්ෂණය',
    'results.tryAgain': 'නැවත උත්සාහ කරන්න',
    'results.photoTips': 'ඡායාරූප උපදෙස්',
    'results.whatFix': 'අපි නිවැරදි කළ හැක්කේ මොනවාද?',
    'results.nextPhoto': 'ඊළඟ ඡායාරූපයට',
    'results.helpfulTips': 'ප්‍රයෝජනවත් උපදෙස්',
    'results.modelResult': 'ප්‍රතිඵලය',
    'results.personalPlan': 'පුද්ගලික පුහුණු සැලැස්ම',
    'results.planTitle': 'නිර්දේශ',
    'results.reasonBlur': 'ඡායාරූපය ටිකක් බොඳයි.',
    'results.reasonContrast': 'ලිවීම සහ කඩදාසිය අතර වෙනස තවත් පැහැදිලි විය යුතුයි.',
    'results.reasonInk': 'ඡායාරූපයේ තවත් පැහැදිලි අත්අකුරු අවශ්‍යයි.',
    'results.reasonVisibility': 'ලිවීමේ කොටස් කිහිපයක් පැහැදිලිව පෙනෙන්නේ නැහැ.',
    'results.reasonWord': 'ප්‍රමාණවත් පැහැදිලි ලිවීමේ කලාප හඳුනාගත නොහැකි විය.',
    'results.reasonDefault': 'ඡායාරූපය තවත් පැහැදිලි විය යුතුයි.',

        // =========================================================
    // NEW RESULTS PAGE — CHILD FEEDBACK / EXPLAINABILITY
    // =========================================================

    // Child result headings
    'results.handwritingLevel': 'අත්අකුරු මට්ටම',
    'results.whatINoticed': 'මම දැක්ක දේ',
    'results.workOnFirst': 'මුලින් මේ දේවල් ටික පුහුණු වෙමු',
    'results.tryThis': '💡 මේක කරලා බලමු',

    // Child-friendly quality presentation
    'results.childVeryGoodTitle': 'සුපිරි! 🌟',
    'results.childVeryGoodText': 'ඔයාගේ අත්අකුරු ගොඩක් හොඳයි. මෙහෙමම ඉදිරියට යමු!',

    'results.childGoodTitle': 'හොඳ ලිවීමක්! ⭐',
    'results.childGoodText': 'මේ පිටුව හොඳට ලියලා තියෙනවා. තවත් ලස්සන කරමු.',

    'results.childAverageTitle': 'හොඳින් දියුණු වෙමින්! 🌱',
    'results.childAverageText': 'ඔයා දියුණු වෙමින් ඉන්නවා. පොඩි අවධානයක් සහිත පුහුණුවක් තවත් උදව් කරයි.',

    'results.childBelowAverageTitle': 'තව ටිකක් පුහුණු වෙමු! ✏️',
    'results.childBelowAverageText': 'ඔයා ඉගෙන ගනිමින් ඉන්නවා. පොඩි දේවල් කිහිපයක් එකට පුහුණු වෙමු.',

    'results.childPoorTitle': 'එකට පුහුණු වෙමු! 💪',
    'results.childPoorText': 'පුහුණු කරන්න දේවල් කිහිපයක් තියෙනවා. එකින් එක දියුණු කරමු.',


    // Feedback availability
    'results.feedbackUnavailableTitle': 'විස්තරාත්මක උපදෙස් මේ වෙලාවේ ලබාගන්න බැහැ',
    'results.feedbackUnavailableText':
      'අත්අකුරු මට්ටම පරීක්ෂා කළා. නමුත් මේ නියැදිය සඳහා විශ්වාසදායක විස්තරාත්මක පුහුණු උපදෙස් සකස් කිරීමට නොහැකි වුණා.',

    'results.partialFeedbackTitle': 'අපට පැහැදිලිව හඳුනාගත හැකි උපදෙස් මෙන්න',
    'results.partialFeedbackText':
      'බොහෝ අත්අකුරු අංග පරීක්ෂා කළා. මුලින් පුහුණු කරන්න වඩාත් ප්‍රයෝජනවත් දේවල් මෙන්න.',

    'results.noIssueTitle': 'හොඳ වැඩක්! 🌟',
    'results.noIssueText':
      'පරීක්ෂා කළ හැකි අත්අකුරු අංග වලින් ප්‍රධාන වශයෙන් පුහුණු කළ යුතු දුර්වලතාවක් හමු වුණේ නැහැ.',


    // ---------------------------------------------------------
    // Child-friendly issue descriptions
    // ---------------------------------------------------------

    'issue.spacing.title': 'සමහර වචන අතර ඉඩ වෙනස්',
    'issue.spacing.text':
      'සමහර වචන ළඟින් තියෙනවා, තවත් සමහර වචන ටිකක් ඈතින් තියෙනවා.',

    'issue.word_spacing.title': 'සමහර වචන අතර ඉඩ වෙනස්',
    'issue.word_spacing.text':
      'හැම වචනයක් අතරම සමාන පොඩි ඉඩක් තබන්න පුහුණු වෙමු.',

    'issue.character_spacing.title': 'සමහර අකුරු අතර ඉඩ වෙනස්',
    'issue.character_spacing.text':
      'සමහර අකුරු එකිනෙකට වැඩිය ළඟ හෝ වැඩිය ඈතින් තියෙනවා.',

    'issue.baseline_alignment.title': 'සමහර වචන පේළියට උඩට හෝ පහළට යනවා',
    'issue.baseline_alignment.text':
      'වචන එකම ලියන පේළියේ තබාගෙන ලියන්න පුහුණු වෙමු.',

    'issue.local_baseline_drift.title': 'ලියන පේළිය ටිකක් උඩට හෝ පහළට යනවා',
    'issue.local_baseline_drift.text':
      'හැම ලියන පේළියක්ම කෙළින් ගෙන යන්න උත්සාහ කරමු.',

    'issue.size_variation.title': 'සමහර අකුරු ලොකුයි, සමහර අකුරු පොඩියි',
    'issue.size_variation.text':
      'සමාන අකුරු සමාන ප්‍රමාණයකින් ලියන්න පුහුණු වෙමු.',

    'issue.character_proportion.title': 'සමහර අකුරු දිගට හෝ පළලට වෙනස්',
    'issue.character_proportion.text':
      'සමාන අකුරුවල උස සහ පළල වඩාත් සමබරව තබමු.',

    'issue.curve_smoothness.title': 'සමහර වක්‍ර කොටස් ටිකක් රළුයි',
    'issue.curve_smoothness.text':
      'වක්‍ර කොටස් හෙමින් සහ මෘදු ලෙස ලියන්න පුහුණු වෙමු.',

    'issue.loop_roundness.title': 'සමහර වටකුරු කොටස් තවත් මෘදු කළ හැක',
    'issue.loop_roundness.text':
      'වට සහ ලූප් කොටස් පැහැදිලිව සහ සමානව ලියන්න පුහුණු වෙමු.',

    'issue.stroke_continuity.title': 'සමහර රේඛා අවසන් වීමට කලින් නවතිනවා',
    'issue.stroke_continuity.text':
      'එක් එක් රේඛාව එක මෘදු චලනයකින් සම්පූර්ණ කරන්න පුහුණු වෙමු.',

    'issue.stroke_thickness.title': 'සමහර රේඛා අනෙක් ඒවාට වඩා තදයි',
    'issue.stroke_thickness.text':
      'පැන්සලට මෘදු සහ සමාන පීඩනයක් දීලා ලියමු.',

    'issue.density_distribution.title': 'සමහර අකුරු ඇතුළේ කොටස් ටිකක් තදබදයි',
    'issue.density_distribution.text':
      'අකුරේ හැම කොටසකටම ප්‍රමාණවත් ඉඩක් දෙමු.',

    'issue.character_shape.title': 'එකම අකුරේ හැඩය ටිකක් වෙනස් වෙනවා',
    'issue.character_shape.text':
      'එකම අකුර නැවත ලියන විට සමාන හැඩයක් තබන්න පුහුණු වෙමු.',

    'issue.upper_lower_balance.title': 'අකුරේ උඩ සහ යට කොටස් තවත් සමබර කළ හැක',
    'issue.upper_lower_balance.text':
      'ඉහළ සහ පහළ කොටස් වඩාත් සමානව තබන්න පුහුණු වෙමු.',

    'issue.slant.title': 'සමහර අකුරු වෙනස් දිශාවලට නැමෙනවා',
    'issue.slant.text':
      'අකුරු සමාන දිශාවකට නැමෙන ලෙස ලියන්න පුහුණු වෙමු.',

    'issue.general.title': 'පුහුණු කරන්න පොඩි දෙයක් තියෙනවා',
    'issue.general.text':
      'හෙමින් ලියලා එක පොඩි දියුණුවකට අවධානය දෙමු.',


    // ---------------------------------------------------------
    // Teacher / Research details
    // ---------------------------------------------------------

    'results.feedbackStatus': 'ප්‍රතිපෝෂණ තත්ත්වය',
    'results.reliability': 'විශ්වාසනීයතාව',
    'results.teacherCorrelation': 'ගුරු ඇගයීම සමඟ සම්බන්ධතාව',
    'results.thresholdSource': 'සීමා අගයේ මූලාශ්‍රය',

    'results.explainabilityDiagnostics': 'පැහැදිලි කිරීමේ පද්ධති පරීක්ෂණ',
    'results.suppressedFeatures': 'භාවිතයෙන් ඉවත් කළ විශේෂාංග',
    'results.softWarningFeatures': 'මෘදු අනතුරු ඇඟවීම් සහිත විශේෂාංග',
    'results.missingFeatures': 'නොමැති විශේෂාංග',

    // Reliability values
    'reliability.strong': 'ඉතා විශ්වාසනීය',
    'reliability.moderate': 'මධ්‍යම',
    'reliability.weak': 'අඩු',
    'reliability.unknown': 'නොදනී',

    // Feedback status values
    'feedback.AVAILABLE': 'ලබා ගත හැක',
    'feedback.PARTIAL': 'අර්ධ වශයෙන් ලබා ගත හැක',
    'feedback.UNAVAILABLE': 'ලබා ගත නොහැක',
    'feedback.NOT_RUN': 'ක්‍රියාත්මක කර නැහැ',

    // Threshold source
    'threshold.teacher_calibrated': 'ගුරු ඇගයීම් මත සකස් කළ',
    // Progress
    'progress.emptyTitle': 'තවම ප්‍රගතියක් නැහැ',
    'progress.emptyText': 'ප්‍රගති ගමන ආරම්භ කිරීමට පළමු අත්අකුරු පරීක්ෂණය සම්පූර්ණ කරන්න.',
    'progress.check': 'මගේ ලිවීම පරීක්ෂා කරන්න',
    'progress.eyebrow': 'මගේ ප්‍රගතිය',
    'progress.title': 'ඔබේ ලිවීම වර්ධනය වන ආකාරය බලන්න 🌱',
    'progress.text': 'මෙහි භාවිතා කරන්නේ සම්පූර්ණ අත්අකුරු ප්‍රතිඵල පමණි. බොඳ ඡායාරූප සහ අසාර්ථක පරීක්ෂණ ප්‍රගතියට ගණන් නොගනී.',
    'progress.latest': 'අවසන් මට්ටම',
    'progress.best': 'මෙතෙක් හොඳම මට්ටම',
    'progress.completed': 'සම්පූර්ණ පරීක්ෂණ',
    'progress.languages': 'පුහුණු කළ භාෂා',
    'progress.recentJourney': 'මෑත ගමන',
    'progress.lastResults': 'අවසන් අත්අකුරු පරීක්ෂණ සම්පූර්ණ ප්‍රතිඵල {count}',
    'progress.chartNote': 'තීරුවේ උස දුර්වල සිට ඉතා හොඳ දක්වා අත්අකුරු මට්ටම් 5 පෙන්වයි. මෙය 0–100 ලකුණු නොවේ.',
    'progress.recentWriting': 'මෑත සම්පූර්ණ ලිවීම්',
    'progress.noCompletedTitle': 'තවම සම්පූර්ණ ලිවීමේ ප්‍රතිඵල නැහැ',
    'progress.noCompletedText': 'නැවත ඡායාරූප ගත් උත්සාහ ඉතිහාසයේ සුරකින අතර ප්‍රගතිය ආරම්භ වන්නේ සම්පූර්ණ අත්අකුරු ප්‍රතිඵලයකින් පසුවය.',
    'progress.tryClear': 'පැහැදිලි ඡායාරූපයක් උත්සාහ කරන්න',

    // History
    'history.emptyTitle': 'තවම ඉතිහාසයක් නැහැ',
    'history.emptyText': 'ඔබේ අත්අකුරු පරීක්ෂණ මෙහි පෙන්වයි.',
    'history.eyebrow': 'ඉතිහාසය',
    'history.title': 'ඔබේ අත් අකුරු ලිවීමේ පරීක්ෂණ',
    'history.text': 'සම්පූර්ණ ප්‍රතිඵල සහ නැවත ඡායාරූප උත්සාහ මෙම බ්‍රවුසරයේ සුරකින අතර පසුව නැවත විවෘත කළ හැක.',
    'history.clear': 'ඉතිහාසය මකන්න',
    'history.clearConfirm': 'මෙම බ්‍රවුසරයෙන් සුරකින සියලු අත්අකුරු ඉතිහාසය මකා දමන්නද?',
    'history.tryPhoto': 'වෙනත් ඡායාරූපයක් උත්සාහ කරන්න',
    'history.notFinished': 'පරීක්ෂණය අවසන් නොවීය',
    'history.writingCheck': 'ලිවීමේ පරීක්ෂණය',
    'history.sinhalaWriting': 'සිංහල ලිවීම',
    'history.tamilWriting': 'දෙමළ ලිවීම',

    // Practice
    'practice.eyebrow': 'පුහුණුව',
    'practice.title': 'විනෝද ලිවීමේ ක්‍රියාකාරකමක් තෝරන්න ✏️',
    'practice.text': 'බලන්න, පිටපත් කරන්න, ලියන්න, නැවත උත්සාහ කරන්න. දිගු පිටුවක් ඉක්මනින් ලියනවාට වඩා කෙටි පුහුණුව හොඳයි.',
    'practice.languageLabel': 'පුහුණු භාෂාව',
    'practice.focus': 'ඔබේ පුහුණු අවධානය',
    'practice.pictureWrite': 'පින්තූරය සහ ලියන්න',
    'practice.words': 'වචන',
    'practice.sentences': 'වාක්‍ය',
    'practice.paragraphs': 'ඡේද',
    'practice.chooseOne': 'එකක් තෝරන්න',
    'practice.practiceSuffix': 'පුහුණුව',
    'practice.lookExample': 'උදාහරණය බලන්න',
    'practice.copyCarefully': 'දැන් සැලකිල්ලෙන් පිටපත් කරන්න',
    'practice.pictureAlt': 'පුහුණු පින්තූරය',
    'practice.next': 'ඊළඟ එක →',
    'practice.checkWriting': 'මගේ ලිවීම පරීක්ෂා කරන්න',
    'practice.tip': '⭐ උපදෙස: මන්දගාමීව ලියන්න. වේගයෙන් ලියනවාට වඩා පිළිවෙලට කරන පුහුණුව වඩා ප්‍රයෝජනවත්.',

    // Profile / not found / logo
    'profile.eyebrow': 'පැතිකඩ',
    'profile.title': 'මගේ පැතිකඩ 🙂',
    'profile.text': 'WriteBright ඔබව පිළිගන්නා විට භාවිතා කළ යුතු නම තෝරන්න.',
    'profile.displayName': 'පෙන්වන නම',
    'profile.namePlaceholder': 'ඉගෙනුම්කරුගේ නම',
    'profile.role': 'මම WriteBright භාවිතා කරන්නේ',
    'profile.saved': 'සුරකින ලදී!',
    'profile.save': 'පැතිකඩ සුරකින්න',
    'notFound.title': 'පිටුව හමු නොවීය',
    'notFound.text': 'ඔබ ඉල්ලා ඇති පිටුව නොමැත.',
    'notFound.home': 'මුල් පිටුවට යන්න',
    'logo.tagline': 'ඉගෙන ගන්න · දියුණු වන්න',

    // Quality labels/messages
    'quality.Poor': 'දුර්වල',
    'quality.Below Average': 'සාමාන්‍යයට වඩා අඩු',
    'quality.Average': 'සාමාන්‍ය',
    'quality.Good': 'හොඳ',
    'quality.Very Good': 'ඉතා හොඳ',
    'quality.Needs Teacher Review': 'ගුරු සමාලෝචනය අවශ්‍යයි',
    'quality.veryGoodTitle': 'අතිශය හොඳ ලිවීමක්! 🌟',
    'quality.veryGoodText': 'ඔබේ ලිවීම පැහැදිලි සහ සමානයි. මේ මට්ටම පවත්වා ගැනීමට පුහුණුව දිගටම කරගෙන යන්න.',
    'quality.goodTitle': 'විශිෂ්ටයි! 🎉',
    'quality.goodText': 'ඔබේ ලිවීම හොඳ තත්ත්වයේ ඇත. ටිකක් අවධානයෙන් පුහුණු වීමෙන් තවත් දියුණු කළ හැක.',
    'quality.averageTitle': 'හොඳ උත්සාහයක්! 🙂',
    'quality.averageText': 'ඔබ හොඳින් කරගෙන යනවා. ලිවීම තවත් පැහැදිලි කිරීමට කුඩා දේවල් කිහිපයක් පුහුණු කරමු.',
    'quality.belowTitle': 'හොඳ උත්සාහයක්! ✏️',
    'quality.belowText': 'ඔබ ඉගෙන ගනිමින් සිටිනවා. පහත පුහුණු උපදෙස් මත අවධානය යොමු කර කෙටි පුහුණුවකින් පසු නැවත උත්සාහ කරන්න.',
    'quality.poorTitle': 'අපි එකට පුහුණු වෙමු! 💪',
    'quality.poorText': 'මෙය පුහුණු ප්‍රතිඵලයක් පමණි. ප්‍රධාන උපදෙස් මත වැඩ කර පසුව තවත් නියැදියක් උත්සාහ කරන්න.',
    'quality.defaultTitle': 'ඔබේ ලිවීමේ ප්‍රතිඵලය',
    'quality.defaultText': 'සෑම දිනකම ටිකක් පුහුණු වන්න.',

    // Status / retake
    'status.reviewTitle': 'ගුරුවරයෙකුගෙන් බලමු 🧑‍🏫',
    'status.reviewText': 'මෙම නියැදිය සඳහා මාදිලියට ප්‍රමාණවත් විශ්වාසයක් නොමැති නිසා ගුරුවරයෙකුට තහවුරු කළ හැක.',
    'status.segTitle': 'වෙනත් ඡායාරූපයක් උත්සාහ කරමු 📷',
    'status.segText': 'ලිවීම පෙනෙන නමුත් පේළි/වචන/අක්ෂර කලාප විශ්වාසයෙන් වෙන් කිරීමට නොහැකි විය.',
    'status.inputTitle': 'තවත් ඡායාරූපයක් ගමු 📸',
    'status.inputText': 'අත්අකුරු පරීක්ෂා කිරීමට ඡායාරූපය තවත් පැහැදිලි විය යුතුය.',
    'status.errorTitle': 'මෙම පරීක්ෂණය අවසන් කිරීමට නොහැකි විය',
    'status.errorText': 'නැවත උත්සාහ කරන්න. නැවතත් සිදුවේ නම් යෙදුම් සම්බන්ධතාවය ගුරුවරයෙකු හෝ දෙමාපියෙකු සමඟ පරීක්ෂා කරන්න.',

    // Practice recommendation copy keyed by issue type
    'rec.spacing.title': 'වචන අතර ඉඩ සමාන කරන්න',
    'rec.spacing.text': 'කෙටි වාක්‍යයක් මන්දගාමීව ලියා සෑම වචනයක් අතරම එකම වගේ කුඩා ඉඩක් තබන්න.',
    'rec.character_spacing.title': 'අකුරු අතර ඉඩ පාලනය කරන්න',
    'rec.character_spacing.text': 'අසල්වැසි අක්ෂර කලාප අතර ඉඩ ඉතා තද හෝ ඉතා විශාල නොවන ලෙස සමානව තබන්න.',
    'rec.baseline_alignment.title': 'පේළිය මත ලියන්න',
    'rec.baseline_alignment.text': 'වචන ඉහළට හෝ පහළට යාම අඩු කර එකම පදනම් පේළිය මත තබා ලියන්න.',
    'rec.local_baseline_drift.title': 'පේළිය ස්ථාවරව තබන්න',
    'rec.local_baseline_drift.text': 'එක් කෙටි පේළියක් වරකට ලියා ලිවීම ක්‍රමයෙන් ඉහළට හෝ පහළට ගමන් නොකරන ලෙස බලන්න.',
    'rec.size_variation.title': 'අකුරු ප්‍රමාණය සමාන කරන්න',
    'rec.size_variation.text': 'මාර්ගෝපදේශ පෙට්ටි හෝ රේඛා භාවිතා කර අක්ෂරවල උස සමානව තබන්න.',
    'rec.character_proportion.title': 'අක්ෂර හැඩයේ අනුපාත සමබර කරන්න',
    'rec.character_proportion.text': 'උස හා පළල ඉතා වෙනස් නොවන ලෙස අක්ෂර හැඩය මාර්ගෝපදේශ පෙට්ටිය තුළ පුහුණු කරන්න.',
    'rec.curve_smoothness.title': 'වක්‍ර රේඛා මෘදු කරන්න',
    'rec.curve_smoothness.text': 'වටකුරු හැඩ මන්දගාමීව අඳිමින් කැඩීම් සහ හදිසි දිශා වෙනස්වීම් අඩු කරන්න.',
    'rec.loop_roundness.title': 'වටකුරු ලූප් හොඳින් සාදන්න',
    'rec.loop_roundness.text': 'ලූප් සහ වටකුරු කොටස් සමාන වක්‍රයකින් ලියන පුහුණුව කරන්න.',
    'rec.stroke_continuity.title': 'රේඛා ගමන සුමට කරන්න',
    'rec.stroke_continuity.text': 'අනවශ්‍ය නවත්වීම් අඩු කර ස්ථාවර අත් ගමනකින් අක්ෂර ලියන්න.',
    'rec.character_shape.title': 'අක්ෂර හැඩය නිවැරදිව පිටපත් කරන්න',
    'rec.character_shape.text': 'උදාහරණ අක්ෂරය හොඳින් බලා එහි ප්‍රධාන හැඩය සමානව පවත්වාගෙන පිටපත් කරන්න.',
    'rec.upper_lower_balance.title': 'ඉහළ සහ පහළ කොටස් සමබර කරන්න',
    'rec.upper_lower_balance.text': 'මැද මාර්ගෝපදේශය භාවිතා කර අක්ෂරයේ ඉහළ හා පහළ කොටස් සමබරව තබන්න.',
    'rec.slant.title': 'එකම ලිවීමේ කෝණය තබන්න',
    'rec.slant.text': 'පේළිය පුරා අක්ෂර එකම ආසන්න කෝණයකින් ලියන්න.',
    'rec.stroke_thickness.title': 'පෑන පීඩනය සමාන කරන්න',
    'rec.stroke_thickness.text': 'පෑන සැහැල්ලුවෙන් අල්ලා රේඛා ඝනකම වැඩි වශයෙන් වෙනස් නොවන ලෙස ලියන්න.',
    'rec.density_distribution.title': 'අක්ෂර ඇතුළත ඉඩ පැහැදිලි කරන්න',
    'rec.density_distribution.text': 'වටකුරු කොටස් ඇතුළත ප්‍රමාණවත් හිස් ඉඩ තබා රේඛා එකට ගැටෙන්නේ නැති ලෙස ලියන්න.',
    'rec.general.title': 'කෙටි පුහුණු වේලාවක්',
    'rec.general.text': 'කෙටි ක්‍රියාකාරකමක් තෝරා මන්දගාමීව සහ සැලකිල්ලෙන් ලියන්න.',

    // Practice focus titles/instructions
    'skill.spacing.title': 'වචන අතර ඉඩ',
    'skill.spacing.instruction': 'වාක්‍යයක් පිටපත් කර සෑම වචනයක් අතරම සමාන කුඩා ඉඩක් තබන්න.',
    'skill.character_spacing.title': 'අකුරු අතර ඉඩ',
    'skill.character_spacing.instruction': 'මන්දගාමීව ලියා අසල්වැසි අක්ෂර කලාප අතර ඉඩ සමානව තබන්න.',
    'skill.baseline_alignment.title': 'පේළිය මත තබන්න',
    'skill.baseline_alignment.instruction': 'මාර්ගෝපදේශ පේළිය භාවිතා කර වචන එය මත තබා ලියන්න.',
    'skill.local_baseline_drift.title': 'පේළිය ස්ථාවරව තබන්න',
    'skill.local_baseline_drift.instruction': 'එක් කෙටි පේළියක් වරකට ලියා ඉහළට හෝ පහළට ගමන් නොකරන්න.',
    'skill.size_variation.title': 'සමාන ප්‍රමාණයේ ලිවීම',
    'skill.size_variation.instruction': 'මාර්ගෝපදේශ පෙට්ටි භාවිතා කර අක්ෂර උස සමානව තබන්න.',
    'skill.character_proportion.title': 'සමබර හැඩ',
    'skill.character_proportion.instruction': 'එක් එක් හැඩය මාර්ගෝපදේශ පෙට්ටිය තුළ පිටපත් කර උස සහ පළල සමබර කරන්න.',
    'skill.curve_smoothness.title': 'මෘදු වක්‍ර',
    'skill.curve_smoothness.instruction': 'වටකුරු හැඩ මන්දගාමීව අනුගමනය කර පසුව නොබලා පිටපත් කරන්න.',
    'skill.loop_roundness.title': 'වටකුරු ලූප්',
    'skill.loop_roundness.instruction': 'සුමට, සමාන වක්‍රයකින් වටකුරු ලූප් චලන පුහුණු කරන්න.',
    'skill.stroke_continuity.title': 'සුමට රේඛා',
    'skill.stroke_continuity.instruction': 'අනවශ්‍ය නවත්වීම් අඩු කර ස්ථාවර චලනයකින් රේඛා ලියන්න.',
    'skill.character_shape.title': 'හැඩය පිටපත් කරන්න',
    'skill.character_shape.instruction': 'උදාහරණය හොඳින් බලා තුන් වතාවක් පිටපත් කර හැඩ සසඳන්න.',
    'skill.upper_lower_balance.title': 'සමබර ලිවීම',
    'skill.upper_lower_balance.instruction': 'මැද මාර්ගෝපදේශය භාවිතා කර ඉහළ හා පහළ කොටස් සමබර කරන්න.',
    'skill.slant.title': 'එකම කෝණය තබන්න',
    'skill.slant.instruction': 'මන්දගාමීව ලියා පේළිය පුරා ලිවීමේ කෝණය සමානව තබන්න.',
    'skill.stroke_thickness.title': 'සැහැල්ලු පෑන පීඩනය',
    'skill.stroke_thickness.instruction': 'සැහැල්ලු ග්‍රහණයක් භාවිතා කර පෑන පීඩනය සමානව තබන්න.',
    'skill.density_distribution.title': 'පැහැදිලි හැඩ',
    'skill.density_distribution.instruction': 'වටකුරු හැඩ ඇතුළත ඉඩ තබා රේඛා තදින් ගැටෙන්නේ නැති ලෙස ලියන්න.',
    'skill.general.title': 'පුහුණු වේලාව',
    'skill.general.instruction': 'පහත කෙටි ක්‍රියාකාරකමක් තෝරා මන්දගාමීව සහ සැලකිල්ලෙන් ලියන්න.',
  },

  tamil: {
    // Global / navigation
    'nav.home': 'முகப்பு',
    'nav.check': 'என் எழுத்தைச் சரிபார்',
    'nav.checkShort': 'சரிபார்',
    'nav.progress': 'என் முன்னேற்றம்',
    'nav.progressShort': 'முன்னேற்றம்',
    'nav.practice': 'பயிற்சி',
    'nav.history': 'வரலாறு',
    'nav.grammarCheck': 'எழுத்துப் பிழை, இலக்கணப் பிழை சரிபார்ப்பு',
    'nav.grammarCheckShort': 'பிழை சரிபார்ப்பு',
    'nav.fluency': 'படிக்கும் திறன்',
    'nav.fluencyShort': 'படிப்பு',
    'nav.readingError': 'வாசிப்புப் பிழை சரிபார்ப்பு',
    'nav.readingErrorShort': 'பிழைகள்',
    'nav.profile': 'சுயவிவரம்',
    'header.ready': 'சிறிய பயிற்சிக்கு தயாரா? 👋',
    'header.hi': 'வணக்கம், {name}!',
    'header.learner': 'கற்றுக்கொள்பவர்',
    'header.student': 'மாணவர்',
    'header.teacher': 'ஆசிரியர்',
    'header.parent': 'பெற்றோர்',
    'header.researcher': 'ஆராய்ச்சியாளர்',
    'header.notifications': 'அறிவிப்புகள்',
    'sidebar.helpTitle': 'சிறிய படிகள், பெரிய முன்னேற்றம்!',
    'sidebar.helpText': 'ஒரு சிறிய திறனைப் பயிற்சி செய்து, பிறகு உங்கள் எழுத்தை மீண்டும் சரிபாருங்கள்.',
    'language.switchLabel': 'மொழி மற்றும் எழுத்து மாதிரி',
    'language.sinhala': 'සිංහල',
    'language.tamil': 'தமிழ்',
    'language.sinhalaModel': 'சிங்கள கையெழுத்து மாதிரி',
    'language.tamilModel': 'தமிழ் கையெழுத்து மாதிரி',

    // Home
    'home.badge': 'கையெழுத்துப் பயிற்சி',
    'home.title': 'கையெழுத்தைச் சரிபார்ப்போம்',
    'home.subtitle': 'எழுதி, தெளிவான புகைப்படம் எடுத்து, அடுத்த பயிற்சிக்கான எளிய ஆலோசனைகளைப் பெறுங்கள்.',
    'home.check': 'சரிபார்',
    'home.practice': 'பயிற்சி',
    'home.whatDo': 'தொடங்கு',
    'home.practiceGames': 'பயிற்சி செயல்களைப் பாருங்கள்',
    'home.checkSinhala': 'சிங்கள கையெழுத்தைச் சரிபார்',
    'home.checkTamil': 'தமிழ் கையெழுத்தைச் சரிபார்',
    'home.takePhoto': 'புகைப்படம் எடு',
    'home.takePhotoText': 'எழுதி முடித்ததும் கேமராவைப் பயன்படுத்துங்கள்',
    'home.choosePhoto': 'புகைப்படத்தைத் தேர்வு செய்',
    'home.choosePhotoText': 'ஏற்கனவே உள்ள கையெழுத்துப் புகைப்படத்தைத் தேர்வு செய்',
    'home.journey': 'முன்னேற்றம்',
    'home.viewProgress': 'என் முன்னேற்றத்தைப் பார்',
    'home.latestLevel': 'கடைசியாக ஏற்றுக்கொள்ளப்பட்ட கையெழுத்து நிலை',
    'home.readyBegin': 'தொடங்க தயாராக இருக்கிறீர்கள்!',
    'home.firstResult': 'உங்கள் முதல் முடிக்கப்பட்ட பெறுபேறு இங்கே காணப்படும்.',
    'home.completedChecks': 'முடிக்கப்பட்ட எழுத்துச் சரிபார்ப்புகள்',
    'home.goodResults': 'நன்று அல்லது மிக நன்று பெறுபேறுகள்',
    'home.activity': 'எழுத்துச் செயல்பாடு',
    'home.recentTries': 'சமீப முயற்சிகள்',
    'home.total': 'மொத்தம்',
    'home.finished': 'முடிந்தவை',
    'home.tryAgain': 'மீண்டும் முயற்சி',
    'home.recentWriting': 'சமீப பெறுபேறுகள்',
    'home.seeAll': 'அனைத்தையும் பார்',
    'home.teacherReview': 'ஆசிரியர் மதிப்பாய்வு',
    'home.completed': 'முடிந்தது',
    'home.tryAgainShort': 'மீண்டும் முயற்சி',
    'home.noChecks': 'இன்னும் எழுத்துச் சரிபார்ப்புகள் இல்லை',
    'home.noChecksText': 'உங்கள் சமீப கையெழுத்துப் பெறுபேறுகள் இங்கே காணப்படும்.',
    'home.tipTitle': 'இன்றைய சிறிய ஆலோசனை',
    'home.tipText': 'சொற்களுக்கிடையிலான இடைவெளியை ஒரே மாதிரி வைத்துக் கொள்ளுங்கள். சமமான இடைவெளி எழுத்தை வாசிக்க எளிதாக்கும்.',

    // Analyze
    'analyze.eyebrow': 'என் எழுத்தைச் சரிபார்',
    'analyze.title': 'கையெழுத்துச் சரிபார்ப்பு',
    'analyze.subtitle': 'மேல் வலது மூலையில் தேர்ந்தெடுத்த மொழிக்கேற்ற கையெழுத்து மாதிரி பயன்படுத்தப்படும். தெளிவான புகைப்படத்தைச் சேர்க்கவும்; பயன்பாட்டுக்கு ஏற்றிருந்தால் மாதிரி பெறுபேறும் நம்பிக்கை சதவீதமும் காட்டப்படும்.',
    'analyze.ready': 'சரிபார்க்க தயாராக உள்ளது!',
    'analyze.notReady': 'இன்னும் தயாராக இல்லை',
    'analyze.chooseBegin': 'தொடங்க ஒரு புகைப்படத்தைத் தேர்வு செய்யுங்கள்',
    'analyze.connectionHelp': 'பயன்பாட்டு இணைப்பை ஆசிரியர் அல்லது பெற்றோருடன் சரிபாருங்கள்',
    'analyze.modelHeading': 'தேர்ந்தெடுக்கப்பட்ட கையெழுத்து மாதிரி',
    'analyze.modelText': 'மேலுள்ள மொழி மாற்றியை மாற்றினால் UI மற்றும் பகுப்பாய்வு மாதிரி இரண்டும் உடனே மாறும்.',
    'analyze.photoHeading': 'புகைப்படத்தைச் சேர்க்கவும்',
    'analyze.photoText': 'முழு எழுத்துப் பக்கமும் புகைப்படத்துக்குள் இருப்பதை உறுதிசெய்யுங்கள்.',
    'analyze.dropTitle': 'புகைப்படத்தை இங்கே விடுங்கள்',
    'analyze.orChoose': 'அல்லது கீழே ஒன்றைத் தேர்வு செய்யுங்கள்',
    'analyze.takePhoto': 'புகைப்படம் எடு',
    'analyze.choosePhoto': 'புகைப்படம் தேர்வு செய்',
    'analyze.maxFile': 'PNG, JPG/JPEG, BMP, TIF/TIFF · அதிகபட்சம் 10 MB',
    'analyze.selectedAlt': 'தேர்ந்தெடுத்த கையெழுத்துப் புகைப்படம்',
    'analyze.removePhoto': 'தேர்ந்தெடுத்த புகைப்படத்தை நீக்கு',
    'analyze.changePhoto': 'வேறு புகைப்படத்தைத் தேர்வு செய்',
    'analyze.bestPhoto': 'தெளிவான புகைப்படத்தைப் பயன்படுத்தவும்',
    'analyze.bestPhotoText': 'பக்கத்தின் மேலிருந்து நேராக படம் எடுக்கவும், நல்ல வெளிச்சம் இருக்கட்டும், நிழலைத் தவிர்க்கவும், எழுத்து மங்கலாகவோ வெட்டப்பட்டதாகவோ இருக்கக் கூடாது.',
    'analyze.checking': 'உங்கள் எழுத்தைச் சரிபார்க்கிறது…',
    'analyze.submit': 'சரிபார்',
    'analyze.errNoFile': 'முதலில் ஒரு கையெழுத்துப் புகைப்படத்தைத் தேர்வு செய்யுங்கள்.',
    'analyze.errLarge': 'இந்தப் படம் மிகப் பெரியது. 10 MB க்குக் குறைவான படத்தைத் தேர்வு செய்யுங்கள்.',
    'analyze.errType': 'PNG, JPG/JPEG, BMP, TIF அல்லது TIFF படத்தைப் பயன்படுத்துங்கள்.',
    'analyze.errGeneric': 'இப்போது இந்தக் கையெழுத்தைச் சரிபார்க்க முடியவில்லை. மீண்டும் முயற்சி செய்யுங்கள்.',

    // Results
    'results.newCheck': 'புதிய எழுத்தைச் சரிபார்',
    'results.checkId': 'எழுத்துச் சரிபார்ப்பு {id}',
    'results.level': 'கையெழுத்து நிலை',
    'results.confidence': 'நம்பிக்கை',
    'results.teacherReview': 'ஆசிரியர் மதிப்பாய்வு',
    'results.teacherReviewText': 'மாதிரி பெறுபேறு மேலே காட்டப்பட்டுள்ளது; நம்பிக்கை குறைவாக இருப்பதால் ஆசிரியர் அதை உறுதிப்படுத்தலாம்.',
    'results.topTip': 'பயிற்சி செய்',
    'results.seeProgress': 'என் முன்னேற்றத்தைப் பார்',
    'results.best3': 'முக்கிய 3',
    'results.extra2': 'கூடுதல் 2',
    'results.noWeakness': 'இந்த மாதிரியில் குறிப்பிட்ட கையெழுத்து பலவீனம் எதுவும் திருப்பி அளிக்கப்படவில்லை.',
    'results.keepGood': 'நல்ல வேலை தொடரட்டும்!',
    'results.nextStep': 'அடுத்த படி',
    'results.practiceAgain': 'பயிற்சி செய்து மீண்டும் முயற்சி செய்',
    'results.practiceAgainText': 'முதல் முன்னுரிமை ஆலோசனையிலிருந்து தொடங்கி சில நிமிடங்கள் பயிற்சி செய்து பிறகு மற்றொரு கையெழுத்து மாதிரியைச் சரிபாருங்கள்.',
    'results.goPractice': 'பயிற்சிக்கு செல் →',
    'results.priority': 'முன்னுரிமை',
    'results.practice': 'பயிற்சி செய் →',
    'results.extraTip': 'கூடுதல் பயிற்சி ஆலோசனை',
    'results.tryIt': 'முயற்சி செய்',
    'results.segEyebrow': 'பிரிப்பு சரிபார்ப்பு',
    'results.segTitle': 'பிரித்தல்',
    'results.views': '{count} காட்சிகள்',
    'results.segHelper': 'கட்டமைப்பு பகுப்பாய்வில் பயன்படுத்தப்பட்ட வரி, சொல் மற்றும் எழுத்து/அட்சரப் பகுதி பிரிப்பை இப்பார்வைகள் மூலம் சரிபார்க்கலாம்.',
    'results.lines': 'வரிகள்',
    'results.words': 'சொற்கள்',
    'results.characters': 'எழுத்துகள் / அட்சரப் பகுதிகள்',
    'results.combined': 'ஒன்றிணைந்தது',
    'results.lineRegions': 'வாக்கியம் / வரிப் பகுதிகள்',
    'results.wordRegions': 'கண்டறியப்பட்ட சொல் பகுதிகள்',
    'results.characterRegions': 'கட்டமைப்பு அட்சரப் பகுதிகள்',
    'results.combinedRegions': 'வரிகள், சொற்கள் மற்றும் அட்சரப் பகுதிகள் ஒன்றாக',
    'results.teacherDetails': 'ஆசிரியர் / ஆராய்ச்சி விவரங்கள்',
    'results.analysisStatus': 'பகுப்பாய்வு நிலை',
    'results.modelClass': 'மாதிரி வகுப்பு',
    'results.review': 'ஆசிரியர் மதிப்பாய்வு',
    'results.recommended': 'பரிந்துரைக்கப்பட்டது',
    'results.notRequired': 'தேவையில்லை',
    'results.segGate': 'பிரிப்பு நிலை',
    'results.probabilities': 'வகுப்பு நிகழ்தகவு விநியோகம்',
    'results.issueExplanations': 'அம்ச நிலை சிக்கல் விளக்கங்கள்',
    'results.inputMeasurements': 'உள்ளீட்டு தர அளவீடுகள்',
    'results.structuralFeatures': 'பெறப்பட்ட கட்டமைப்பு அம்சங்கள்',
    'results.processingOutputs': 'செயலாக்க வெளியீடுகள்',
    'results.uploaded': 'பதிவேற்றிய படம்',
    'results.skewCorrected': 'சாய்வு திருத்தப்பட்டது',
    'results.shadowRemoved': 'நிழல் நீக்கப்பட்டது',
    'results.contrastEnhanced': 'மாறுபாடு மேம்படுத்தப்பட்டது',
    'results.binarized': 'இரும படிமம்',
    'results.ruledRemoved': 'வழிகாட்டி கோடுகள் நீக்கப்பட்டன',
    'results.lineSeg': 'வரி பிரிப்பு',
    'results.wordSeg': 'சொல் பிரிப்பு',
    'results.charSeg': 'எழுத்து / அட்சரப் பகுதி பிரிப்பு',
    'results.combinedSeg': 'ஒன்றிணைந்த பிரிப்பு',
    'results.retake': 'வேறு புகைப்படத்தை எடு',
    'results.back': 'பின்செல்',
    'results.resultNotFound': 'பெறுபேறு கிடைக்கவில்லை',
    'results.resultNotFoundText': 'இந்த உலாவி வரலாற்றில் இந்தப் பெறுபேறு இல்லை.',
    'results.yourCheck': 'உங்கள் எழுத்துச் சரிபார்ப்பு',
    'results.tryAgain': 'மீண்டும் முயற்சி செய்',
    'results.photoTips': 'புகைப்பட ஆலோசனைகள்',
    'results.whatFix': 'எதைச் சரிசெய்யலாம்?',
    'results.nextPhoto': 'அடுத்த புகைப்படத்திற்கு',
    'results.helpfulTips': 'பயனுள்ள ஆலோசனைகள்',
    'results.modelResult': 'பெறுபேறு',
    'results.personalPlan': 'தனிப்பட்ட பயிற்சி திட்டம்',
    'results.planTitle': 'பரிந்துரைகள்',
    'results.reasonBlur': 'புகைப்படம் சிறிது மங்கலாக உள்ளது.',
    'results.reasonContrast': 'எழுத்தும் காகிதமும் இன்னும் தெளிவாக வேறுபட வேண்டும்.',
    'results.reasonInk': 'புகைப்படத்தில் இன்னும் தெளிவான கையெழுத்து தேவை.',
    'results.reasonVisibility': 'எழுத்தின் சில பகுதிகள் தெளிவாகத் தெரியவில்லை.',
    'results.reasonWord': 'போதுமான தெளிவான எழுத்துப் பகுதிகளை கண்டறிய முடியவில்லை.',
    'results.reasonDefault': 'புகைப்படம் இன்னும் தெளிவாக இருக்க வேண்டும்.',

    // =========================================================
    // NEW RESULTS PAGE — CHILD FEEDBACK / EXPLAINABILITY
    // =========================================================

    // Child result headings
    'results.handwritingLevel': 'கையெழுத்து நிலை',
    'results.whatINoticed': 'நான் கவனித்தது',
    'results.workOnFirst': 'முதலில் இவற்றைப் பயிற்சி செய்வோம்',
    'results.tryThis': '💡 இதை முயற்சி செய்வோம்',

    // Child-friendly quality presentation
    'results.childVeryGoodTitle': 'சூப்பர் ஸ்டார்! 🌟',
    'results.childVeryGoodText':
      'உங்கள் கையெழுத்து மிகவும் நன்றாக இருக்கிறது. இதேபோல் தொடருங்கள்!',

    'results.childGoodTitle': 'அருமையான எழுத்து! ⭐',
    'results.childGoodText':
      'இந்தப் பக்கத்தை நன்றாக எழுதியுள்ளீர்கள். இன்னும் சிறப்பாக்கலாம்.',

    'results.childAverageTitle': 'நன்றாக முன்னேறுகிறீர்கள்! 🌱',
    'results.childAverageText':
      'நீங்கள் முன்னேறுகிறீர்கள். சிறிது கவனமான பயிற்சி இன்னும் உதவும்.',

    'results.childBelowAverageTitle': 'இன்னும் கொஞ்சம் பயிற்சி செய்வோம்! ✏️',
    'results.childBelowAverageText':
      'நீங்கள் கற்றுக்கொண்டு இருக்கிறீர்கள். சில சிறிய விஷயங்களை ஒன்றாகப் பயிற்சி செய்வோம்.',

    'results.childPoorTitle': 'ஒன்றாகப் பயிற்சி செய்வோம்! 💪',
    'results.childPoorText':
      'பயிற்சி செய்ய சில திறன்கள் உள்ளன. ஒவ்வொன்றாக மேம்படுத்தலாம்.',


    // Feedback availability
    'results.feedbackUnavailableTitle':
      'விரிவான பயிற்சி குறிப்புகள் இப்போது கிடைக்கவில்லை',

    'results.feedbackUnavailableText':
      'கையெழுத்து நிலை மதிப்பிடப்பட்டது. ஆனால் இந்த மாதிரிக்கான நம்பகமான விரிவான பயிற்சி குறிப்புகளை உருவாக்க முடியவில்லை.',

    'results.partialFeedbackTitle':
      'நாங்கள் தெளிவாக கண்ட பயிற்சி குறிப்புகள் இவை',

    'results.partialFeedbackText':
      'பெரும்பாலான கையெழுத்து பகுதிகளைச் சரிபார்த்தோம். முதலில் பயிற்சி செய்ய மிகவும் பயனுள்ள விஷயங்கள் இவை.',

    'results.noIssueTitle': 'நல்ல வேலை! 🌟',

    'results.noIssueText':
      'சரிபார்க்க முடிந்த கையெழுத்து அம்சங்களில் முக்கியமாகப் பயிற்சி செய்ய வேண்டிய குறைபாடு எதுவும் கண்டுபிடிக்கப்படவில்லை.',


    // ---------------------------------------------------------
    // Child-friendly issue descriptions
    // ---------------------------------------------------------

    'issue.spacing.title':
      'சில சொற்களுக்கு இடையிலான இடைவெளி மாறுகிறது',

    'issue.spacing.text':
      'சில சொற்கள் அருகிலும் சில சொற்கள் அதிக இடைவெளியிலும் உள்ளன.',

    'issue.word_spacing.title':
      'சில சொற்களுக்கு இடையிலான இடைவெளி மாறுகிறது',

    'issue.word_spacing.text':
      'ஒவ்வொரு சொல்லுக்கும் இடையில் ஒரே மாதிரியான சிறிய இடைவெளியை விட்டு எழுதிப் பழகுவோம்.',

    'issue.character_spacing.title':
      'சில எழுத்துகளுக்கிடையிலான இடைவெளி மாறுகிறது',

    'issue.character_spacing.text':
      'சில எழுத்துகள் மிகவும் அருகிலும் சில எழுத்துகள் அதிக தூரத்திலும் உள்ளன.',

    'issue.baseline_alignment.title':
      'சில சொற்கள் வரிக்கு மேலே அல்லது கீழே செல்கின்றன',

    'issue.baseline_alignment.text':
      'எல்லா சொற்களையும் ஒரே எழுதும் வரியில் வைத்துப் பயிற்சி செய்வோம்.',

    'issue.local_baseline_drift.title':
      'எழுதும் வரி கொஞ்சம் மேலே அல்லது கீழே செல்கிறது',

    'issue.local_baseline_drift.text':
      'ஒவ்வொரு எழுதும் வரியையும் நேராகக் கொண்டு செல்ல முயற்சி செய்வோம்.',

    'issue.size_variation.title':
      'சில எழுத்துகள் பெரியதாகவும் சில சிறியதாகவும் உள்ளன',

    'issue.size_variation.text':
      'ஒத்த எழுத்துகளை ஒரே அளவில் எழுதப் பயிற்சி செய்வோம்.',

    'issue.character_proportion.title':
      'சில எழுத்துகள் நீளமாக அல்லது அகலமாக மாறுகின்றன',

    'issue.character_proportion.text':
      'ஒத்த எழுத்துகளின் உயரத்தையும் அகலத்தையும் சமமாக வைத்துப் பயிற்சி செய்வோம்.',

    'issue.curve_smoothness.title':
      'சில வளைந்த பகுதிகள் கொஞ்சம் கரடுமுரடாக உள்ளன',

    'issue.curve_smoothness.text':
      'வளைந்த பகுதிகளை மெதுவாகவும் மென்மையாகவும் எழுதிப் பழகுவோம்.',

    'issue.loop_roundness.title':
      'சில வட்ட வடிவங்களை இன்னும் மென்மையாக்கலாம்',

    'issue.loop_roundness.text':
      'வட்ட மற்றும் வளைய பகுதிகளை தெளிவாகவும் சீராகவும் எழுதிப் பழகுவோம்.',

    'issue.stroke_continuity.title':
      'சில கோடுகள் முடிவதற்கு முன் நிற்கின்றன',

    'issue.stroke_continuity.text':
      'ஒவ்வொரு கோட்டையும் ஒரே மென்மையான இயக்கத்தில் முடிக்கப் பயிற்சி செய்வோம்.',

    'issue.stroke_thickness.title':
      'சில கோடுகள் மற்றவற்றை விட தடிமனாக உள்ளன',

    'issue.stroke_thickness.text':
      'பென்சிலில் மென்மையான மற்றும் சீரான அழுத்தத்தைப் பயன்படுத்துவோம்.',

    'issue.density_distribution.title':
      'சில எழுத்துகளின் உள்ளே பகுதிகள் நெருக்கமாக உள்ளன',

    'issue.density_distribution.text':
      'எழுத்தின் ஒவ்வொரு பகுதிக்கும் போதுமான இடம் கொடுப்போம்.',

    'issue.character_shape.title':
      'அதே எழுத்தின் வடிவம் கொஞ்சம் மாறுகிறது',

    'issue.character_shape.text':
      'அதே எழுத்தை ஒவ்வொரு முறையும் ஒரே மாதிரி எழுதிப் பழகுவோம்.',

    'issue.upper_lower_balance.title':
      'சில எழுத்துகளின் மேல் மற்றும் கீழ் பகுதிகளை இன்னும் சமப்படுத்தலாம்',

    'issue.upper_lower_balance.text':
      'மேல் மற்றும் கீழ் பகுதிகளை சமமாக வைத்துப் பயிற்சி செய்வோம்.',

    'issue.slant.title':
      'சில எழுத்துகள் வேறு திசைகளில் சாய்கின்றன',

    'issue.slant.text':
      'எழுத்துகளை ஒரே திசையில் சாய்த்துப் பழகுவோம்.',

    'issue.general.title':
      'பயிற்சி செய்ய ஒரு சிறிய விஷயம் உள்ளது',

    'issue.general.text':
      'மெதுவாக எழுதுங்கள்; ஒரு சிறிய முன்னேற்றத்தில் கவனம் செலுத்துங்கள்.',


    // ---------------------------------------------------------
    // Teacher / Research details
    // ---------------------------------------------------------

    'results.feedbackStatus': 'பின்னூட்ட நிலை',

    'results.reliability': 'நம்பகத்தன்மை',

    'results.teacherCorrelation':
      'ஆசிரியர் மதிப்பீட்டுடனான தொடர்பு',

    'results.thresholdSource':
      'வரம்பு மதிப்பின் மூலம்',

    'results.explainabilityDiagnostics':
      'விளக்கத்திறன் கண்டறிதல் விவரங்கள்',

    'results.suppressedFeatures':
      'பயன்பாட்டிலிருந்து நீக்கப்பட்ட அம்சங்கள்',

    'results.softWarningFeatures':
      'மென்மையான எச்சரிக்கை கொண்ட அம்சங்கள்',

    'results.missingFeatures':
      'கிடைக்காத அம்சங்கள்',

    // Reliability values
    'reliability.strong': 'உயர் நம்பகத்தன்மை',
    'reliability.moderate': 'மிதமான நம்பகத்தன்மை',
    'reliability.weak': 'குறைந்த நம்பகத்தன்மை',
    'reliability.unknown': 'தெரியவில்லை',

    // Feedback status values
    'feedback.AVAILABLE': 'கிடைக்கிறது',
    'feedback.PARTIAL': 'பகுதியளவில் கிடைக்கிறது',
    'feedback.UNAVAILABLE': 'கிடைக்கவில்லை',
    'feedback.NOT_RUN': 'இயக்கப்படவில்லை',

    // Threshold source
    'threshold.teacher_calibrated':
      'ஆசிரியர் மதிப்பீட்டின் அடிப்படையில் அளவமைக்கப்பட்டது',
    // Progress
    'progress.emptyTitle': 'இன்னும் முன்னேற்றம் இல்லை',
    'progress.emptyText': 'உங்கள் முன்னேற்றப் பயணத்தைத் தொடங்க முதல் கையெழுத்துச் சரிபார்ப்பை முடிக்கவும்.',
    'progress.check': 'என் எழுத்தைச் சரிபார்',
    'progress.eyebrow': 'என் முன்னேற்றம்',
    'progress.title': 'உங்கள் எழுத்து வளர்வதைப் பாருங்கள் 🌱',
    'progress.text': 'முடிக்கப்பட்ட கையெழுத்துப் பெறுபேறுகள் மட்டுமே இங்கே கணக்கிடப்படும். மங்கலான படங்கள் மற்றும் தோல்வியுற்ற சரிபார்ப்புகள் முன்னேற்றத்தில் சேர்க்கப்படாது.',
    'progress.latest': 'சமீப நிலை',
    'progress.best': 'இதுவரை சிறந்த நிலை',
    'progress.completed': 'முடிக்கப்பட்ட சரிபார்ப்புகள்',
    'progress.languages': 'பயிற்சி செய்த மொழிகள்',
    'progress.recentJourney': 'சமீபப் பயணம்',
    'progress.lastResults': 'கடைசி {count} முடிக்கப்பட்ட பெறுபேறுகள்',
    'progress.chartNote': 'பட்டையின் உயரம் குறைவு முதல் மிக நன்று வரை 5 கையெழுத்து நிலைகளை காட்டுகிறது. இது 0–100 மதிப்பெண் அல்ல.',
    'progress.recentWriting': 'சமீப முடிக்கப்பட்ட எழுத்துகள்',
    'progress.noCompletedTitle': 'இன்னும் முடிக்கப்பட்ட எழுத்துப் பெறுபேறுகள் இல்லை',
    'progress.noCompletedText': 'மீண்டும் புகைப்படம் எடுத்த முயற்சிகள் வரலாற்றில் சேமிக்கப்படும்; ஒரு முழுமையான கையெழுத்துப் பெறுபேற்றுக்குப் பிறகே முன்னேற்றம் தொடங்கும்.',
    'progress.tryClear': 'தெளிவான புகைப்படம் முயற்சி செய்',

    // History
    'history.emptyTitle': 'இன்னும் வரலாறு இல்லை',
    'history.emptyText': 'உங்கள் கையெழுத்துச் சரிபார்ப்புகள் இங்கே காணப்படும்.',
    'history.eyebrow': 'வரலாறு',
    'history.title': 'உங்கள் எழுத்துச் சரிபார்ப்புகள்',
    'history.text': 'முடிக்கப்பட்ட பெறுபேறுகள் மற்றும் மீண்டும் புகைப்படம் எடுத்த முயற்சிகள் இந்த உலாவியில் சேமிக்கப்படும்; பிறகு மீண்டும் திறக்கலாம்.',
    'history.clear': 'வரலாற்றை அழி',
    'history.clearConfirm': 'இந்த உலாவியில் சேமிக்கப்பட்ட அனைத்து கையெழுத்து வரலாறையும் அழிக்கவா?',
    'history.tryPhoto': 'வேறு புகைப்படம் முயற்சி செய்',
    'history.notFinished': 'சரிபார்ப்பு முடிக்கப்படவில்லை',
    'history.writingCheck': 'எழுத்துச் சரிபார்ப்பு',
    'history.sinhalaWriting': 'சிங்கள எழுத்து',
    'history.tamilWriting': 'தமிழ் எழுத்து',

    // Practice
    'practice.eyebrow': 'பயிற்சி',
    'practice.title': 'ஒரு வேடிக்கையான எழுத்துப் பயிற்சியைத் தேர்வு செய் ✏️',
    'practice.text': 'பார், நகலெடு, எழுது, மீண்டும் முயற்சி செய். நீண்ட பக்கத்தை அவசரமாக எழுதுவதைவிட குறுகிய பயிற்சி சிறந்தது.',
    'practice.languageLabel': 'பயிற்சி மொழி',
    'practice.focus': 'உங்கள் பயிற்சி கவனம்',
    'practice.pictureWrite': 'படம் & எழுது',
    'practice.words': 'சொற்கள்',
    'practice.sentences': 'வாக்கியங்கள்',
    'practice.paragraphs': 'பத்திகள்',
    'practice.chooseOne': 'ஒன்றைத் தேர்வு செய்',
    'practice.practiceSuffix': 'பயிற்சி',
    'practice.lookExample': 'உதாரணத்தைப் பார்',
    'practice.copyCarefully': 'இப்போது கவனமாக நகலெடு',
    'practice.pictureAlt': 'பயிற்சி படம்',
    'practice.next': 'அடுத்தது →',
    'practice.checkWriting': 'என் எழுத்தைச் சரிபார்',
    'practice.tip': '⭐ ஆலோசனை: மெதுவாக எழுதுங்கள். வேகமான பயிற்சியை விட ஒழுங்கான பயிற்சி பயனுள்ளதாகும்.',

    // Profile / not found / logo
    'profile.eyebrow': 'சுயவிவரம்',
    'profile.title': 'என் சுயவிவரம் 🙂',
    'profile.text': 'WriteBright உங்களை வரவேற்கும்போது பயன்படுத்த வேண்டிய பெயரைத் தேர்வு செய்யுங்கள்.',
    'profile.displayName': 'காட்சிப் பெயர்',
    'profile.namePlaceholder': 'கற்றுக்கொள்பவரின் பெயர்',
    'profile.role': 'நான் WriteBright ஐ பயன்படுத்துவது',
    'profile.saved': 'சேமிக்கப்பட்டது!',
    'profile.save': 'சுயவிவரத்தைச் சேமி',
    'notFound.title': 'பக்கம் கிடைக்கவில்லை',
    'notFound.text': 'நீங்கள் கேட்ட பக்கம் இல்லை.',
    'notFound.home': 'முகப்பிற்கு செல்',
    'logo.tagline': 'கற்று · எழுது · மேம்படு',

    // Quality labels/messages
    'quality.Poor': 'குறைவு',
    'quality.Below Average': 'சராசரிக்குக் கீழ்',
    'quality.Average': 'சராசரி',
    'quality.Good': 'நன்று',
    'quality.Very Good': 'மிக நன்று',
    'quality.Needs Teacher Review': 'ஆசிரியர் மதிப்பாய்வு தேவை',
    'quality.veryGoodTitle': 'அருமையான எழுத்து! 🌟',
    'quality.veryGoodText': 'உங்கள் எழுத்து தெளிவாகவும் சீராகவும் உள்ளது. இதே தரத்தைத் தொடர பயிற்சி செய்யுங்கள்.',
    'quality.goodTitle': 'சிறந்த வேலை! 🎉',
    'quality.goodText': 'உங்கள் எழுத்து நன்றாக உள்ளது. சிறிது கவனமான பயிற்சி அதை இன்னும் மேம்படுத்தும்.',
    'quality.averageTitle': 'நல்ல முயற்சி! 🙂',
    'quality.averageText': 'நீங்கள் நன்றாக செய்து வருகிறீர்கள். எழுத்தை இன்னும் தெளிவாக்க சில சிறிய திறன்களைப் பயிற்சி செய்வோம்.',
    'quality.belowTitle': 'நல்ல முயற்சி! ✏️',
    'quality.belowText': 'நீங்கள் கற்றுக்கொண்டு வருகிறீர்கள். கீழுள்ள பயிற்சி ஆலோசனைகளில் கவனம் செலுத்தி, சிறிய பயிற்சிக்குப் பிறகு மீண்டும் முயற்சி செய்யுங்கள்.',
    'quality.poorTitle': 'நாம் சேர்ந்து பயிற்சி செய்வோம்! 💪',
    'quality.poorText': 'இது ஒரு பயிற்சி பெறுபேறு மட்டுமே. முக்கிய ஆலோசனைகளைப் பயிற்சி செய்து பிறகு மற்றொரு மாதிரியை முயற்சி செய்யுங்கள்.',
    'quality.defaultTitle': 'உங்கள் எழுத்துப் பெறுபேறு',
    'quality.defaultText': 'ஒவ்வொரு நாளும் சிறிது பயிற்சி செய்யுங்கள்.',

    // Status / retake
    'status.reviewTitle': 'ஆசிரியரிடம் பார்க்கலாம் 🧑‍🏫',
    'status.reviewText': 'இந்த மாதிரிக்கான நம்பிக்கை குறைவாக இருப்பதால் ஆசிரியர் பெறுபேற்றை உறுதிப்படுத்தலாம்.',
    'status.segTitle': 'வேறு புகைப்படம் முயற்சி செய்வோம் 📷',
    'status.segText': 'எழுத்து தெரிகிறது; ஆனால் வரி/சொல்/எழுத்துப் பகுதிகளை நம்பகமாகப் பிரிக்க முடியவில்லை.',
    'status.inputTitle': 'இன்னொரு புகைப்படம் எடுப்போம் 📸',
    'status.inputText': 'கையெழுத்தைச் சரிபார்க்க படம் இன்னும் தெளிவாக இருக்க வேண்டும்.',
    'status.errorTitle': 'இந்தச் சரிபார்ப்பை முடிக்க முடியவில்லை',
    'status.errorText': 'மீண்டும் முயற்சி செய்யுங்கள். தொடர்ந்து ஏற்பட்டால் ஆசிரியர் அல்லது பெற்றோருடன் பயன்பாட்டு இணைப்பைச் சரிபாருங்கள்.',

    // Practice recommendation copy keyed by issue type
    'rec.spacing.title': 'சொல் இடைவெளியைச் சீராக்கு',
    'rec.spacing.text': 'ஒரு குறுகிய வாக்கியத்தை மெதுவாக எழுதி, ஒவ்வொரு சொல்லுக்கும் இடையில் ஒரே மாதிரி சிறிய இடைவெளி வையுங்கள்.',
    'rec.character_spacing.title': 'எழுத்து இடைவெளியைச் சீராக்கு',
    'rec.character_spacing.text': 'அடுத்தடுத்த எழுத்து/அட்சரப் பகுதிகளுக்கிடையிலான இடைவெளியை மிகச் சுருக்கமாகவோ மிகப் பெரியதாகவோ இல்லாமல் வைத்துக் கொள்ளுங்கள்.',
    'rec.baseline_alignment.title': 'வரியில் நிலையாக எழுது',
    'rec.baseline_alignment.text': 'சொற்கள் மேலே கீழே செல்லாமல் ஒரே அடிப்படை வரியில் அமருமாறு எழுதுங்கள்.',
    'rec.local_baseline_drift.title': 'வரி நிலைத்தன்மையைப் பயிற்சி செய்',
    'rec.local_baseline_drift.text': 'ஒரு குறுகிய வரியை ஒரே நேரத்தில் எழுதி, எழுத்து மெதுவாக மேலே அல்லது கீழே நகராமல் பார்த்துக் கொள்ளுங்கள்.',
    'rec.size_variation.title': 'எழுத்து அளவை ஒரே மாதிரி வைத்துக் கொள்',
    'rec.size_variation.text': 'வழிகாட்டுப் பெட்டிகள் அல்லது வரிகளைப் பயன்படுத்தி எழுத்துகளின் உயரத்தைச் சீராக வைத்துக் கொள்ளுங்கள்.',
    'rec.character_proportion.title': 'எழுத்து விகிதத்தைச் சமநிலைப்படுத்து',
    'rec.character_proportion.text': 'எழுத்தின் உயரமும் அகலமும் மிக அதிகமாக மாறாமல் வழிகாட்டுப் பெட்டிக்குள் பயிற்சி செய்யுங்கள்.',
    'rec.curve_smoothness.title': 'வளைவுகளை மென்மையாக்கு',
    'rec.curve_smoothness.text': 'வட்ட வடிவங்களை மெதுவாக எழுதிப், திடீர் திசைமாற்றங்களையும் உடைபாடுகளையும் குறைக்கவும்.',
    'rec.loop_roundness.title': 'வட்ட வளைகளை தெளிவாக எழுது',
    'rec.loop_roundness.text': 'வளை மற்றும் வட்டப் பகுதிகளை ஒரே மாதிரி மென்மையான வளைவில் எழுதப் பயிற்சி செய்யுங்கள்.',
    'rec.stroke_continuity.title': 'கோடுகளைச் சீராக தொடரு',
    'rec.stroke_continuity.text': 'தேவையற்ற நிறுத்தங்களை குறைத்து, நிலையான கை இயக்கத்துடன் எழுத்துகளை எழுதுங்கள்.',
    'rec.character_shape.title': 'எழுத்து வடிவத்தை கவனமாக நகலெடு',
    'rec.character_shape.text': 'மாதிரி எழுத்தின் முக்கிய வடிவத்தை கவனித்து, அதே வடிவத்தைத் தொடர்ந்து நகலெடுக்கவும்.',
    'rec.upper_lower_balance.title': 'மேல்-கீழ் பகுதிகளைச் சமநிலைப்படுத்து',
    'rec.upper_lower_balance.text': 'நடுத்தர வழிகாட்டியைப் பயன்படுத்தி எழுத்தின் மேல் மற்றும் கீழ் பகுதிகளைச் சமமாக வைத்துக் கொள்ளுங்கள்.',
    'rec.slant.title': 'ஒரே சாய்வு கோணத்தை வைத்துக் கொள்',
    'rec.slant.text': 'முழு வரியிலும் எழுத்துகளை ஒரே போன்ற சாய்வு கோணத்தில் எழுதுங்கள்.',
    'rec.stroke_thickness.title': 'பேனா அழுத்தத்தைச் சீராக்கு',
    'rec.stroke_thickness.text': 'பேனாவை தளர்வாகப் பிடித்து, கோடுகளின் தடிமன் அதிகமாக மாறாமல் எழுதுங்கள்.',
    'rec.density_distribution.title': 'எழுத்து உள்ளக இடத்தை தெளிவாக்கு',
    'rec.density_distribution.text': 'வட்ட பகுதிகளுக்குள் போதுமான வெற்றிடத்தை விட்டு, கோடுகள் நெரிசலாகத் தெரியாமல் எழுதுங்கள்.',
    'rec.general.title': 'சிறிய பயிற்சி நேரம்',
    'rec.general.text': 'ஒரு குறுகிய செயலைத் தேர்ந்தெடுத்து மெதுவாகவும் கவனமாகவும் எழுதுங்கள்.',

    // Practice focus titles/instructions
    'skill.spacing.title': 'சொல் இடைவெளி',
    'skill.spacing.instruction': 'ஒரு வாக்கியத்தை நகலெடுத்து ஒவ்வொரு சொல்லுக்கும் இடையில் ஒரே மாதிரி சிறிய இடைவெளி வையுங்கள்.',
    'skill.character_spacing.title': 'எழுத்து இடைவெளி',
    'skill.character_spacing.instruction': 'மெதுவாக எழுதி, அடுத்தடுத்த எழுத்துப் பகுதிகளுக்கிடையிலான இடைவெளியைச் சீராக வைத்துக் கொள்ளுங்கள்.',
    'skill.baseline_alignment.title': 'வரியில் நிலையாக எழுது',
    'skill.baseline_alignment.instruction': 'வழிகாட்டி வரியைப் பயன்படுத்தி சொற்கள் அதன்மீது அமருமாறு எழுதுங்கள்.',
    'skill.local_baseline_drift.title': 'வரியைச் சீராக வைத்துக் கொள்',
    'skill.local_baseline_drift.instruction': 'ஒரு குறுகிய வரியை ஒரே நேரத்தில் எழுதி, மேலே கீழே நகராமல் பார்த்துக் கொள்ளுங்கள்.',
    'skill.size_variation.title': 'ஒரே அளவு எழுத்து',
    'skill.size_variation.instruction': 'வழிகாட்டுப் பெட்டிகளைப் பயன்படுத்தி எழுத்து உயரத்தை ஒரே மாதிரி வைத்துக் கொள்ளுங்கள்.',
    'skill.character_proportion.title': 'சமநிலை வடிவங்கள்',
    'skill.character_proportion.instruction': 'ஒவ்வொரு வடிவத்தையும் வழிகாட்டுப் பெட்டிக்குள் நகலெடுத்து உயரம், அகலம் ஆகியவற்றைச் சமப்படுத்துங்கள்.',
    'skill.curve_smoothness.title': 'மென்மையான வளைவுகள்',
    'skill.curve_smoothness.instruction': 'வட்ட வடிவங்களை மெதுவாகப் பின்தொடர்ந்து, பிறகு பின்தொடராமல் நகலெடுக்கவும்.',
    'skill.loop_roundness.title': 'வட்ட வளைகள்',
    'skill.loop_roundness.instruction': 'மென்மையான, சீரான வளைவில் வட்ட வளைய இயக்கங்களைப் பயிற்சி செய்யுங்கள்.',
    'skill.stroke_continuity.title': 'சீரான கோடுகள்',
    'skill.stroke_continuity.instruction': 'தேவையற்ற நிறுத்தங்களை குறைத்து நிலையான இயக்கத்துடன் எழுதுங்கள்.',
    'skill.character_shape.title': 'வடிவத்தை நகலெடு',
    'skill.character_shape.instruction': 'மாதிரியை கவனமாகப் பார்த்து மூன்று முறை நகலெடுத்து வடிவங்களை ஒப்பிடுங்கள்.',
    'skill.upper_lower_balance.title': 'சமநிலை எழுத்து',
    'skill.upper_lower_balance.instruction': 'நடுத்தர வழிகாட்டியைப் பயன்படுத்தி மேல் மற்றும் கீழ் பகுதிகளைச் சமப்படுத்துங்கள்.',
    'skill.slant.title': 'ஒரே கோணத்தை வைத்துக் கொள்',
    'skill.slant.instruction': 'மெதுவாக எழுதி, முழு வரியிலும் சாய்வு கோணத்தை ஒரே மாதிரி வைத்துக் கொள்ளுங்கள்.',
    'skill.stroke_thickness.title': 'மென்மையான பேனா அழுத்தம்',
    'skill.stroke_thickness.instruction': 'தளர்வான பிடிப்புடன் பேனா அழுத்தத்தைச் சீராக வைத்துக் கொள்ளுங்கள்.',
    'skill.density_distribution.title': 'தெளிவான வடிவங்கள்',
    'skill.density_distribution.instruction': 'வட்ட வடிவங்களுக்குள் இடம் விட்டு கோடுகள் நெரிசலாகத் தெரியாமல் எழுதுங்கள்.',
    'skill.general.title': 'பயிற்சி நேரம்',
    'skill.general.instruction': 'கீழே ஒரு குறுகிய செயலைத் தேர்ந்தெடுத்து மெதுவாகவும் கவனமாகவும் எழுதுங்கள்.',
  },
};

export function translate(language, key, vars = {}) {
  const lang = language === 'tamil' ? 'tamil' : 'sinhala';
  const template = translations[lang]?.[key] ?? translations.sinhala?.[key] ?? key;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    String(template),
  );
}

export function localeFor(language) {
  return language === 'tamil' ? 'ta-LK' : 'si-LK';
}

export function qualityLabelText(label, language) {
  if (!label) return '';
  return translate(language, `quality.${label}`) || label;
}

export function languageName(language, uiLanguage = language) {
  if (language === 'tamil') return uiLanguage === 'tamil' ? 'தமிழ்' : 'දෙමළ';
  return uiLanguage === 'tamil' ? 'சிங்களம்' : 'සිංහල';
}

export function roleLabel(role, language) {
  const key = String(role || 'Student').toLowerCase();
  return translate(language, `header.${key}`);
}

export function localizedRecommendation(issueType, language, fallbackTitle = '', fallbackText = '') {
  const raw = String(issueType || 'general').toLowerCase();
  const aliases = {
    word_spacing: 'spacing',
    word_spacing_variation: 'spacing',
    spacing_std: 'spacing',
    character_spacing_variation: 'character_spacing',
    character_proportion_variation: 'character_proportion',
    character_shape_consistency: 'character_shape',
    stroke_thickness_consistency: 'stroke_thickness',
    avg_size_variation: 'size_variation',
    avg_slant: 'slant',
    baseline_std: 'baseline_alignment',
  };
  const normalized = aliases[raw] || raw;

  const supported = new Set([
    'spacing',
    'character_spacing',
    'baseline_alignment',
    'local_baseline_drift',
    'size_variation',
    'character_proportion',
    'curve_smoothness',
    'loop_roundness',
    'stroke_continuity',
    'character_shape',
    'upper_lower_balance',
    'slant',
    'stroke_thickness',
    'density_distribution',
    'general',
  ]);
  const key = supported.has(normalized) ? normalized : 'general';

  return {
    title: translate(language, `rec.${key}.title`) || fallbackTitle,
    text: translate(language, `rec.${key}.text`) || fallbackText,
  };
}



const FEATURE_LABELS = {
  sinhala: {
    contrast_score: 'කොන්ත්‍රාස්ට් අගය', blur_score: 'බොඳ වීමේ අගය', ink_density: 'තීන්ත ඝනත්වය',
    text_visibility_score: 'ලිවීම පෙනීමේ අගය', word_detection_ratio: 'වචන හඳුනාගැනීමේ අනුපාතය',
    spacing_std: 'ඉඩ විචලනය', baseline_std: 'පදනම් පේළි විචලනය', local_baseline_drift: 'ප්‍රාදේශීය පදනම් පේළි චලනය',
    avg_slant: 'සාමාන්‍ය ඇලවීම', avg_size_variation: 'සාමාන්‍ය ප්‍රමාණ විචලනය', curve_smoothness: 'වක්‍ර මෘදුතාව',
    loop_roundness: 'ලූප් වටකුරුභාවය', stroke_continuity: 'රේඛා අඛණ්ඩතාව', stroke_thickness_consistency: 'රේඛා ඝනකම සමානභාවය',
    density_distribution: 'ඝනත්ව බෙදාහැරීම', character_shape_consistency: 'අක්ෂර හැඩ සමානභාවය',
    character_proportion_variation: 'අක්ෂර අනුපාත විචලනය', upper_lower_balance: 'ඉහළ-පහළ සමබරතාව',
    character_spacing_variation: 'අක්ෂර අතර ඉඩ විචලනය', word_spacing_variation: 'වචන අතර ඉඩ විචලනය',
  },
  tamil: {
    contrast_score: 'மாறுபாட்டு மதிப்பு', blur_score: 'மங்கல் மதிப்பு', ink_density: 'மை அடர்த்தி',
    text_visibility_score: 'எழுத்துத் தெளிவு மதிப்பு', word_detection_ratio: 'சொல் கண்டறிதல் விகிதம்',
    spacing_std: 'இடைவெளி மாறுபாடு', baseline_std: 'அடிப்படை வரி மாறுபாடு', local_baseline_drift: 'உள்ளூர் அடிப்படை வரி நகர்வு',
    avg_slant: 'சராசரி சாய்வு', avg_size_variation: 'சராசரி அளவு மாறுபாடு', curve_smoothness: 'வளைவு மென்மை',
    loop_roundness: 'வளைய வட்டத்தன்மை', stroke_continuity: 'கோடு தொடர்ச்சி', stroke_thickness_consistency: 'கோடு தடிமன் சீர்மை',
    density_distribution: 'அடர்த்தி விநியோகம்', character_shape_consistency: 'எழுத்து வடிவ சீர்மை',
    character_proportion_variation: 'எழுத்து விகித மாறுபாடு', upper_lower_balance: 'மேல்-கீழ் சமநிலை',
    character_spacing_variation: 'எழுத்து இடைவெளி மாறுபாடு', word_spacing_variation: 'சொல் இடைவெளி மாறுபாடு',
  },
};

export function featureNameText(name, language) {
  const lang = language === 'tamil' ? 'tamil' : 'sinhala';
  return FEATURE_LABELS[lang]?.[name] || String(name || '').replace(/_/g, ' ');
}

export function severityText(severity, language) {
  const value = String(severity || '').toLowerCase();
  if (language === 'tamil') {
    if (value === 'high') return 'உயர்';
    if (value === 'medium') return 'நடுத்தரம்';
    return 'தகவல்';
  }
  if (value === 'high') return 'ඉහළ';
  if (value === 'medium') return 'මධ්‍යම';
  return 'තොරතුරු';
}

export function localizedSkill(issueType, language) {
  const raw = String(issueType || 'general').toLowerCase();
  const aliases = {
    word_spacing: 'spacing',
    word_spacing_variation: 'spacing',
    spacing_std: 'spacing',
    character_spacing_variation: 'character_spacing',
    character_proportion_variation: 'character_proportion',
    character_shape_consistency: 'character_shape',
    stroke_thickness_consistency: 'stroke_thickness',
    avg_size_variation: 'size_variation',
    avg_slant: 'slant',
    baseline_std: 'baseline_alignment',
  };
  const normalized = aliases[raw] || raw;
  const supported = new Set([
    'spacing', 'character_spacing', 'baseline_alignment', 'local_baseline_drift',
    'size_variation', 'character_proportion', 'curve_smoothness', 'loop_roundness',
    'stroke_continuity', 'character_shape', 'upper_lower_balance', 'slant',
    'stroke_thickness', 'density_distribution', 'general',
  ]);
  const key = supported.has(normalized) ? normalized : 'general';
  return {
    title: translate(language, `skill.${key}.title`),
    instruction: translate(language, `skill.${key}.instruction`),
  };
}
