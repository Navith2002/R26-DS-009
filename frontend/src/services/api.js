export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const detail = payload?.detail ?? payload;
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

export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return parseResponse(response);
}

export async function getModelStatus() {
  const response = await fetch(`${API_BASE_URL}/models/status`);
  return parseResponse(response);
}

export async function analyzeHandwriting({ file, language, signal }) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('language', language);

  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
    signal,
  });

  return parseResponse(response);
}

export function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
