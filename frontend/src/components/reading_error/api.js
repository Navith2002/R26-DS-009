// Reading-error-detection component. Originally its own FastAPI process
// hardcoded to http://127.0.0.1:8000/predict; now mounted as a sub-app
// (see backend/reading_error_router.py) on the same app/port as the other
// components (see ../../services/api.js), under the /reading-error prefix.
// Same pattern as grammarApi.js's GRAMMAR_API_BASE_URL and
// fluencyProfiling/api.js's BASE_URL.
const BASE_URL = `${(import.meta.env.VITE_READING_ERROR_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}/reading-error`

async function handleResponse(res) {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new Error(detail)
  }
  return res.json()
}

// language: 'Tamil' | 'Sinhala' -- matches backend/reading_error/main.py's
// normalize_language_name(), which accepts either casing but this always
// sends the canonical form.
export async function predictReading({ language, expectedText, audioBlob }) {
  const form = new FormData()
  form.append('language', language)
  form.append('expected_text', expectedText)
  form.append('audio', audioBlob, 'student_audio.webm')

  const res = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res)
}
