// API client for the spelling/grammar-check component. Originally its own
// FastAPI process on its own port (backend/grammar_check/main.py); now
// mounted as a router (backend/grammar_router.py) on the same app/port as
// the quality-analysis API (see ./api.js), under the /grammar prefix.
export const GRAMMAR_API_BASE_URL = `${(import.meta.env.VITE_GRAMMAR_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}/grammar`;

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const detail = payload?.detail ?? payload?.error ?? payload;
    let message = 'Request failed.';

    if (typeof detail === 'string') {
      message = detail;
    } else if (detail?.message) {
      message = detail.message;
    } else if (detail) {
      try {
        message = JSON.stringify(detail);
      } catch {
        message = 'Request failed.';
      }
    }

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function getGrammarHealth() {
  const response = await fetch(`${GRAMMAR_API_BASE_URL}/health`);
  return parseResponse(response);
}

// language: 'si' | 'ta' -- matches backend/grammar_check/main.py's `language`
// Form field (defaults to 'si' there too).
export async function analyzeGrammar({ file, language, signal }) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('language', language);

  const response = await fetch(`${GRAMMAR_API_BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
    signal,
  });

  return parseResponse(response);
}
