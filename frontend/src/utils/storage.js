const LANGUAGE_KEY = 'writebright_language_v1';

export function loadLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved === 'tamil' ? 'tamil' : 'sinhala';
  } catch { return 'sinhala'; }
}
export function saveLanguage(language) {
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* The current session still works. */ }
}
