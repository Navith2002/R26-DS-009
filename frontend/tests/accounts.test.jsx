import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AppProvider } from '../src/context/AppContext';
import { useApp } from '../src/context/useApp';
import AccountPage, { FamilySetupPage, SignOutButton } from '../src/pages/AccountPage';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from '../src/pages/HistoryPage';
import App from '../src/App';
import { LanguageProvider, useLanguage } from '../src/context/FluencyLanguageContext';

const mocks = vi.hoisted(() => ({
  auth: { user: null, configured: true, loading: false, login: vi.fn(), logout: vi.fn(), privacyNoticePending: false, dismissPrivacyNotice: vi.fn() },
  listeners: { parent: [], children: [], history: [] },
  addChild: vi.fn(), saveParent: vi.fn(), saveRun: vi.fn(), deleteRun: vi.fn(), deleteAllRuns: vi.fn(),
}));
vi.mock('../src/auth/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../src/components/GoogleSignInButton', () => ({ default: ({ onCredential, disabled }) => {
  const { t } = useApp();
  return <button disabled={disabled} onClick={() => onCredential('signed-google-token')}>{t('account.google')}</button>;
} }));
vi.mock('../src/services/familyStore', () => ({
  watchParent: (uid, next) => { mocks.listeners.parent.push({ uid, next }); return vi.fn(); },
  watchChildren: (uid, next) => { mocks.listeners.children.push({ uid, next }); return vi.fn(); },
  watchHistory: (uid, id, next, fail) => { mocks.listeners.history.push({ uid, id, next, fail }); return vi.fn(); },
  saveParent: (...args) => mocks.saveParent(...args), addChild: (...args) => mocks.addChild(...args),
  saveRun: (...args) => mocks.saveRun(...args), deleteRun: (...args) => mocks.deleteRun(...args),
  deleteAllRuns: (...args) => mocks.deleteAllRuns(...args), renameChild: vi.fn(),
}));
let context;
function Probe() { context = useApp(); return <span data-testid="records">{context.history.map((item) => item.id).join(',')}</span>; }
function tree(children, route = '/') { return <MemoryRouter initialEntries={[route]}><AppProvider>{children}</AppProvider></MemoryRouter>; }
function fixture(children = <Probe />, route = '/') { return render(tree(children, route)); }
function emitFamily(uid = 'parent-a') {
  act(() => {
    mocks.listeners.parent.findLast((item) => item.uid === uid).next({ name: 'Parent' });
    mocks.listeners.children.findLast((item) => item.uid === uid).next([{ id: 'child-a', name: 'අමල්' }, { id: 'child-b', name: 'නිමල්' }]);
  });
}
const record = (id) => ({ id, kind: 'handwriting', createdAt: '2026-10-12', quality_prediction: { final_label: 'Good' } });
// jsdom does not implement the browser's modal dialog methods.
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
beforeEach(() => {
  localStorage.clear(); context = null;
  mocks.auth.user = null;
  mocks.auth.privacyNoticePending = false;
  Object.values(mocks.listeners).forEach((items) => items.splice(0));
  mocks.auth.login.mockReset(); mocks.auth.logout.mockReset();
  mocks.saveParent.mockReset(); mocks.addChild.mockReset(); mocks.saveRun.mockReset();
  mocks.deleteRun.mockReset(); mocks.deleteAllRuns.mockReset();
});
afterEach(cleanup);

describe('localized parent screens', () => {
  it('starts in Sinhala and switches sign-in and sign-out to Tamil', async () => {
    fixture(<><AccountPage /><SignOutButton /></>);
    expect(screen.getByRole('button', { name: /Google/ }).textContent).toMatch(/[\u0D80-\u0DFF]/);
    fireEvent.click(screen.getByRole('button', { name: /தமிழ்/ }));
    expect(screen.getByRole('button', { name: /Google/ }).textContent).toMatch(/[\u0B80-\u0BFF]/);
    expect(document.documentElement.lang).toBe('ta');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Google/ }));
    await waitFor(() => expect(mocks.auth.login).toHaveBeenCalledWith('signed-google-token'));
    fireEvent.click(screen.getByRole('button', { name: 'வெளியேறவும்' }));
    await waitFor(() => expect(mocks.auth.logout).toHaveBeenCalled());
  });
  it('localizes a failed direct Google sign-in without exposing English server errors', async () => {
    mocks.auth.login.mockRejectedValue({ status: 401, message: 'English SDK error' });
    fixture(<AccountPage />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Google/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/[\u0D80-\u0DFF]/));
    expect(screen.queryByText('English SDK error')).toBeNull();
  });
  it('creates the parent then the named child under the authenticated UID', async () => {
    mocks.auth.user = { uid: 'parent-a', displayName: 'Parent' };
    mocks.addChild.mockResolvedValue('new-child');
    fixture(<FamilySetupPage />);
    fireEvent.change(screen.getByLabelText('දරුවාගේ නම'), { target: { value: '  අමල්  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'පැතිකඩ සාදන්න' }));
    await waitFor(() => expect(mocks.addChild).toHaveBeenCalledWith('parent-a', '  අමල්  '));
    expect(mocks.saveParent).toHaveBeenCalledWith('parent-a', 'Parent');
    expect(mocks.saveParent.mock.invocationCallOrder[0]).toBeLessThan(mocks.addChild.mock.invocationCallOrder[0]);
  });
  it('uses the global Tamil language in fluency on its first render', () => {
    localStorage.setItem('writebright_language_v1', 'tamil');
    function FluencyProbe() { const { lang } = useLanguage(); return <span>{lang}</span>; }
    fixture(<LanguageProvider><FluencyProbe /></LanguageProvider>);
    expect(screen.getByText('ta')).toBeTruthy();
  });
});

describe('child and parent history isolation', () => {
  it('hides old records immediately on child switch and ignores a late old snapshot', () => {
    mocks.auth.user = { uid: 'parent-a' }; fixture(); emitFamily();
    const old = mocks.listeners.history.at(-1);
    act(() => old.next([record('private-a')]));
    expect(context.history[0].id).toBe('private-a');
    act(() => context.selectChild('child-b'));
    expect(context.history).toEqual([]);
    act(() => old.next([record('late-a')]));
    expect(context.history).toEqual([]);
    act(() => mocks.listeners.history.at(-1).next([record('private-b')]));
    expect(context.history[0].id).toBe('private-b');
  });
  it('clears records on sign-out and does not load unscoped local demo history', () => {
    localStorage.setItem('writebright_history_v1', JSON.stringify([record('guest')]));
    mocks.auth.user = { uid: 'parent-a' }; const view = fixture(); emitFamily();
    act(() => mocks.listeners.history.at(-1).next([record('private-a')]));
    mocks.auth.user = null;
    view.rerender(tree(<Probe />));
    expect(context.history).toEqual([]);
    expect(context.activeChild).toBeNull();
    mocks.auth.user = { uid: 'parent-b' };
    view.rerender(tree(<Probe />));
    expect(context.history).toEqual([]);
    emitFamily('parent-b');
    expect(mocks.listeners.history.at(-1).uid).toBe('parent-b');
  });
  it('waits for Firestore acknowledgement and reports failed saves', async () => {
    mocks.auth.user = { uid: 'parent-a' }; fixture(); emitFamily();
    act(() => mocks.listeners.history.at(-1).next([]));
    mocks.saveRun.mockRejectedValue(new Error('offline'));
    await expect(context.registerAnalysis({ analysis_id: 'result' })).rejects.toThrow('offline');
    expect(context.history).toEqual([]);
    mocks.saveRun.mockImplementation(async (uid, child, kind, entry) => ({ ...entry, id: 'saved', kind }));
    await act(async () => { await context.registerAnalysis({ analysis_id: 'result' }); });
    expect(context.history[0].id).toBe('saved');
    expect(mocks.saveRun.mock.calls[1].slice(0, 3)).toEqual(['parent-a', 'child-a', 'handwriting']);
  });
  it('does not display an in-flight save after switching to another child', async () => {
    mocks.auth.user = { uid: 'parent-a' }; fixture(); emitFamily();
    act(() => mocks.listeners.history.at(-1).next([]));
    let resolve;
    mocks.saveRun.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = context.registerAnalysis({ analysis_id: 'old' });
    const rejected = expect(pending).rejects.toThrow('child-changed');
    act(() => context.selectChild('child-b'));
    await act(async () => { resolve({ ...record('saved-a') }); await rejected; });
    expect(context.history).toEqual([]);
  });
  it('deletes only the selected child history and propagates deletion errors', async () => {
    mocks.auth.user = { uid: 'parent-a' }; fixture(); emitFamily();
    act(() => mocks.listeners.history.at(-1).next([record('private-a')]));
    await act(async () => { await context.deleteHistoryEntry('private-a'); });
    expect(mocks.deleteRun).toHaveBeenCalledWith('parent-a', 'child-a', 'private-a');
    expect(context.history).toEqual([]);
    mocks.deleteAllRuns.mockRejectedValue(new Error('denied'));
    await expect(context.clearHistory()).rejects.toThrow('denied');
    expect(mocks.deleteAllRuns).toHaveBeenCalledWith('parent-a', 'child-a');
  });
});


describe('history deletion controls', () => {
  it('can clear grammar-only history with a Tamil confirmation, and cancel safely', async () => {
    mocks.auth.user = { uid: 'parent-a' };
    const user = userEvent.setup();
    fixture(<><Probe /><HistoryPage /></>); emitFamily();
    act(() => {
      mocks.listeners.history.at(-1).next([{ ...record('grammar-a'), kind: 'grammar', total: 1, correct: 1, language: 'si' }]);
      context.setLanguage('tamil');
    });
    const clear = screen.getByRole('button', { name: 'இந்தக் குழந்தையின் அனைத்து வரலாற்றையும் நீக்கவும்' });
    await user.click(clear);
    expect(mocks.deleteAllRuns).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('අමල්');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ரத்து செய்யவும்' }));
    expect(mocks.deleteAllRuns).not.toHaveBeenCalled();
    await user.click(clear);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'நீக்கவும்' }));
    await waitFor(() => expect(mocks.deleteAllRuns).toHaveBeenCalledWith('parent-a', 'child-a'));
  });
  it('deletes a single report only after native-language confirmation', async () => {
    mocks.auth.user = { uid: 'parent-a' };
    const user = userEvent.setup();
    fixture(<><Probe /><HistoryPage /></>); emitFamily();
    act(() => mocks.listeners.history.at(-1).next([record('private-a')]));
    await user.click(screen.getByRole('button', { name: 'මකන්න' }));
    expect(mocks.deleteRun).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'මකන්න' }));
    await waitFor(() => expect(mocks.deleteRun).toHaveBeenCalledWith('parent-a', 'child-a', 'private-a'));
    expect(context.history).toEqual([]);
  });
});

it('opens a returning child fluency dashboard using private history and the current interface language', async () => {
  mocks.auth.user = { uid: 'parent-a' };
  localStorage.setItem('writebright_language_v1', 'tamil');
  fixture(<><Probe /><App /></>, '/fluency'); emitFamily();
  act(() => mocks.listeners.history.at(-1).next([{ id: 'private-fluency', kind: 'fluency', createdAt: '2026-10-12', result: { fluency_label: 'Fluent', profile_name: 'Accurate', skill_4d: {}, weakest: [], cer: 0, wer: 0 } }]));
  fireEvent.submit(document.querySelector('form.profile-form'));
  expect(document.querySelector('.fluency-scope').getAttribute('lang')).toBe('ta');
  expect(screen.queryByText('Accurate')).toBeNull();
  expect(screen.getByText('சரியாக வாசிப்பவர்')).toBeTruthy();
});

it('shows the privacy note and requires acknowledgement before Google sign-in', () => {
  fixture(<AccountPage />);
  expect(screen.getByRole('region', { name: 'පෞද්ගලිකත්ව සටහන' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Google/ }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Google/ }));
  expect(mocks.auth.login).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: /Google/ }).disabled).toBe(false);
});

it('shows the after-signup privacy note before the first child account is created', () => {
  mocks.auth.user = { uid: 'google-parent', displayName: 'Parent', newAccount: true };
  fixture(<FamilySetupPage />);
  expect(screen.getByText('ඔබේ ගිණුම සෑදී ඇත — ඔබේ දත්ත ගැන')).toBeTruthy();
});

it('makes the full privacy page available before sign-in in Tamil', () => {
  localStorage.setItem('writebright_language_v1', 'tamil');
  fixture(<App />, '/privacy');
  expect(screen.getByRole('heading', { name: 'தனியுரிமைக் குறிப்பு' })).toBeTruthy();
  expect(screen.getByText(/Gmail செய்திகள்/)).toBeTruthy();
  expect(screen.getByText(/பகுப்பாய்வுச் சேவையகத்துக்கு/)).toBeTruthy();
});
