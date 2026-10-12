const BASE = (import.meta.env.VITE_ACCOUNT_API_BASE_URL || '').replace(/\/$/, '');
export const PRIVACY_VERSION = '1';

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
    throw error;
  }
  return response.json();
}
export const getSession = () => accountRequest('/auth/session');
export const getGoogleNonce = () => accountRequest('/auth/nonce');
export const exchangeGoogleCredential = (credential) => accountRequest('/auth/google', {
  method: 'POST', body: JSON.stringify({ credential, privacy_accepted: true, privacy_version: PRIVACY_VERSION }),
});
export const endSession = () => accountRequest('/auth/logout', { method: 'POST' });
