const BASE = (import.meta.env.VITE_ACCOUNT_API_BASE_URL || '').replace(/\/$/, '');
export const PRIVACY_VERSION = '1';
const safeCodes = new Set(['google_client_mismatch', 'google_token_expired', 'google_clock_error', 'google_verification_unavailable', 'google_credential_invalid', 'google_account_unverified', 'google_challenge_expired']);

export async function accountRequest(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401 && path.startsWith('/family/')) window.dispatchEvent(new Event('writebright:session-ended'));
    const error = new Error('Account request failed');
    error.status = response.status;
    try {
      const payload = await response.json();
      if (safeCodes.has(payload?.detail?.code)) error.code = payload.detail.code;
    } catch { /* Non-JSON failures still use a localized fallback. */ }
    throw error;
  }
  return response.json();
}
export const getSession = () => accountRequest('/auth/session');
export const getGoogleNonce = () => accountRequest('/auth/nonce');
export const exchangeGoogleCredential = (credential) => accountRequest('/auth/google', {
  method: 'POST', body: JSON.stringify({ credential }),
});
export const endSession = () => accountRequest('/auth/logout', { method: 'POST' });

export const acceptPrivacy = () => accountRequest('/auth/privacy', {
  method: 'POST', body: JSON.stringify({ privacy_accepted: true, privacy_version: PRIVACY_VERSION }),
});
