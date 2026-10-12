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
