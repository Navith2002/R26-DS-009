import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';

const api = vi.hoisted(() => ({ acceptPrivacy: vi.fn(), getSession: vi.fn(), exchangeGoogleCredential: vi.fn(), endSession: vi.fn() }));
vi.mock('../src/services/accountApi', () => api);
let context;
function Probe() { context = useAuth(); return <span>{context.user?.uid || 'guest'}</span>; }
beforeEach(() => { Object.values(api).forEach((mock) => mock.mockReset()); localStorage.clear(); });
afterEach(cleanup);

it('exchanges the direct Google credential and restores an HTTP-only backend session without storing tokens in localStorage', async () => {
  api.getSession.mockRejectedValue({ status: 401 });
  api.exchangeGoogleCredential.mockResolvedValue({ uid: 'google-subject', newAccount: true, needsPrivacyConsent: true });
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(context.loading).toBe(false));
  await act(async () => { await context.login('google-signed-id-token'); });
  expect(api.exchangeGoogleCredential).toHaveBeenCalledWith('google-signed-id-token');
  expect(screen.getByText('google-subject')).toBeTruthy();
  expect(context.user.needsPrivacyConsent).toBe(true);
  expect(localStorage.length).toBe(0);
  api.acceptPrivacy.mockResolvedValue({ uid: 'google-subject', needsPrivacyConsent: false });
  await act(async () => { await context.acceptPrivacy(); });
  expect(context.user.needsPrivacyConsent).toBe(false);
  await act(async () => { await context.logout(); });
  expect(api.endSession).toHaveBeenCalled();
  expect(context.user).toBeNull();
});

it('restores the parent from the backend session and clears them when a history request reports expiry', async () => {
  api.getSession.mockResolvedValue({ uid: 'google-subject', newAccount: false });
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(context.user?.uid).toBe('google-subject'));
  fireEvent(window, new Event('writebright:session-ended'));
  expect(context.user).toBeNull();
});

it('does not claim sign-out succeeded when server invalidation fails', async () => {
  api.getSession.mockResolvedValue({ uid: 'google-subject' });
  api.endSession.mockRejectedValue(new Error('offline'));
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(context.user?.uid).toBe('google-subject'));
  await expect(context.logout()).rejects.toThrow('offline');
  expect(context.user.uid).toBe('google-subject');
});
