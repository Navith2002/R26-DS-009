import { afterEach, expect, it, vi } from 'vitest';
import { accountRequest, exchangeGoogleCredential } from '../src/services/accountApi';

afterEach(() => vi.unstubAllGlobals());
it('sends ID tokens only in the sign-in POST body and includes cookies and the acknowledged notice version', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ uid: 'google-sub' }) });
  vi.stubGlobal('fetch', fetcher);
  await exchangeGoogleCredential('signed-id-token');
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('/auth/google');
  expect(url).not.toContain('signed-id-token');
  expect(options.credentials).toBe('include');
  expect(options.cache).toBe('no-store');
  expect(JSON.parse(options.body)).toEqual({ credential: 'signed-id-token', privacy_accepted: true, privacy_version: '1' });
});
it('clears an expired family session without exposing raw server errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  const expired = vi.fn(); window.addEventListener('writebright:session-ended', expired);
  await expect(accountRequest('/family/children')).rejects.toMatchObject({ status: 401 });
  expect(expired).toHaveBeenCalledOnce();
  window.removeEventListener('writebright:session-ended', expired);
});
it('preserves only approved sign-in reason codes for localized error messages', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: { code: 'google_clock_error', token: 'private-token' } }) }));
  await expect(accountRequest('/auth/google')).rejects.toMatchObject({ code: 'google_clock_error', status: 401 });
});
it('does not expose arbitrary server details as a sign-in reason', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: { code: 'private-token' } }) }));
  try { await accountRequest('/auth/google'); } catch (error) {
    expect(error.code).toBeUndefined();
    expect(error.message).not.toContain('private-token');
  }
});
