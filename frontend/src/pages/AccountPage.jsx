import { useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApp } from '../context/useApp';
import LanguageToggle from '../components/LanguageToggle';
import Logo from '../components/Logo';
import GoogleSignInButton from '../components/GoogleSignInButton';
import PrivacyNotice from '../components/PrivacyNotice';

export function SignOutButton() {
  const { logout } = useAuth();
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <div className="account-signout">
    <button className="danger-outline" disabled={busy} onClick={async () => {
      setBusy(true); setError(false);
      try { await logout(); } catch { setError(true); } finally { setBusy(false); }
    }}><LogOut size={17} />{t(busy ? 'account.busy' : 'account.signOut')}</button>
    {error && <p role="alert">{t('account.signOutError')}</p>}
  </div>;
}
export function AccountFrame({ children }) {
  const { language } = useApp();
  return <main className={`account-page ui-language-${language}`} lang={language === 'tamil' ? 'ta' : 'si'}>
    <header className="account-header"><Logo /><LanguageToggle /></header>
    <section className="account-card result-card">{children}</section>
  </main>;
}
const loginErrorKeys = {
  google_client_mismatch: 'account.clientMismatch',
  google_token_expired: 'account.loginExpired',
  google_clock_error: 'account.loginClock',
  google_verification_unavailable: 'account.googleUnavailable',
  google_challenge_expired: 'account.loginExpired',
};
export default function AccountPage() {
  const { login, configured } = useAuth();
  const { t } = useApp();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  async function signIn(credential) {
    if (!accepted || busy) return;
    setBusy(true); setErrorKey(null);
    try { await login(credential); } catch (error) {
      setErrorKey(loginErrorKeys[error.code] || 'account.loginError');
    } finally { setBusy(false); }
  }
  return <AccountFrame>
    <div className="profile-large"><UserRound size={32} /></div>
    <h1>{t('account.title')}</h1><p>{t('account.intro')}</p>
    {!configured && <p role="alert">{t('account.unavailable')}</p>}
    {errorKey && <p className="account-error" role="alert">{t(errorKey)}</p>}
    <PrivacyNotice />
    <label className="privacy-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />{t('privacy.accept')}</label>
    <GoogleSignInButton disabled={busy || !configured || !accepted} onCredential={signIn} onError={(error) => setErrorKey(loginErrorKeys[error?.code] || 'account.unavailable')} />
  </AccountFrame>;
}
export function FamilySetupPage() {
  const { user } = useAuth();
  const { parent, saveParent, createChild, t } = useApp();
  const [name, setName] = useState(parent?.name || user?.displayName || '');
  const [childName, setChildName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim() || !childName.trim()) { setError('account.nameRequired'); return; }
    setBusy(true); setError(null);
    try { await saveParent(name); await createChild(childName); }
    catch { setError('account.saveError'); }
    finally { setBusy(false); }
  }
  return <AccountFrame>
    <h1>{t(parent ? 'account.childSetup' : 'account.parentSetup')}</h1>
    <p>{t('account.childHelp')}</p>
    <PrivacyNotice phase="after" />
    <form className="profile-form" onSubmit={submit}>
      <label>{t('account.parentName')}<input required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>{t('account.childName')}<input required maxLength={100} autoComplete="off" value={childName} onChange={(event) => setChildName(event.target.value)} /></label>
      {error && <p className="account-error" role="alert">{t(error)}</p>}
      <button className="primary-action" disabled={busy}>{t(busy ? 'account.busy' : 'account.createChild')}</button>
    </form>
    <SignOutButton />
  </AccountFrame>;
}
