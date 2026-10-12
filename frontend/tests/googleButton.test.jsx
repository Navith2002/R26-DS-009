import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import GoogleSignInButton from '../src/components/GoogleSignInButton';

const state = vi.hoisted(() => ({ language: 'sinhala', nonce: vi.fn() }));
vi.mock('../src/auth/AuthContext', () => ({ googleClientId: 'test-client.apps.googleusercontent.com' }));
vi.mock('../src/context/useApp', () => ({ useApp: () => ({ language: state.language, t: (key) => key }) }));
vi.mock('../src/services/accountApi', () => ({ getGoogleNonce: () => state.nonce() }));
beforeEach(() => {
  state.language = 'sinhala'; state.nonce.mockReset(); state.nonce.mockResolvedValue({ nonce: 'single-use-backend-nonce', client_id: 'test-client.apps.googleusercontent.com' });
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
});
afterEach(() => { cleanup(); delete window.google; });
it('uses the direct Google SDK with the server nonce and selected Tamil locale', async () => {
  state.language = 'tamil';
  const callback = vi.fn();
  render(<GoogleSignInButton onCredential={callback} onError={vi.fn()} disabled={false} />);
  await waitFor(() => expect(window.google.accounts.id.renderButton).toHaveBeenCalled());
  const initialized = window.google.accounts.id.initialize.mock.calls[0][0];
  expect(initialized.client_id).toBe('test-client.apps.googleusercontent.com');
  expect(initialized.nonce).toBe('single-use-backend-nonce');
  expect(window.google.accounts.id.renderButton.mock.calls[0][1].locale).toBe('ta');
  initialized.callback({ credential: 'signed-id-token' });
  expect(callback).toHaveBeenCalledWith('signed-id-token');
});
it('does not contact Google or request a nonce when the sign-in control is disabled', () => {
  render(<GoogleSignInButton onCredential={vi.fn()} onError={vi.fn()} disabled />);
  expect(state.nonce).not.toHaveBeenCalled();
  expect(window.google.accounts.id.initialize).not.toHaveBeenCalled();
});
it('blocks Google initialization when frontend and backend use different client IDs', async () => {
  state.nonce.mockResolvedValue({ nonce: 'fresh-nonce', client_id: 'different-client.apps.googleusercontent.com' });
  const error = vi.fn();
  render(<GoogleSignInButton onCredential={vi.fn()} onError={error} disabled={false} />);
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(error.mock.calls[0][0].code).toBe('google_client_mismatch');
  expect(window.google.accounts.id.initialize).not.toHaveBeenCalled();
});
