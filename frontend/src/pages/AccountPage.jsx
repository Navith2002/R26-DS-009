import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut, Mic, SpellCheck2, UserRound, Volume2 } from 'lucide-react';
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
// Two-panel layout: brand panel (logo + the four learning areas) beside
// the form panel. The brand panel collapses to a slim header on phones.
export function AccountFrame({ children }) {
  const { language, t } = useApp();
  const areas = [
    { icon: Camera, label: t('nav.check') },
    { icon: SpellCheck2, label: t('nav.grammarCheck') },
    { icon: Mic, label: t('nav.fluency') },
    { icon: Volume2, label: t('nav.readingError') },
  ];
  return <main className={`account-page ui-language-${language}`} lang={language === 'tamil' ? 'ta' : 'si'}>
    <aside className="account-brand">
      <Logo />
      <p className="account-brand-tagline">{t('logo.tagline')}</p>
      <ul className="account-brand-areas">
        {areas.map(({ icon: Icon, label }) => <li key={label}><span><Icon size={18} /></span>{label}</li>)}
      </ul>
    </aside>
    <div className="account-panel">
      <header className="account-header"><LanguageToggle /></header>
      <section className="account-card">{children}</section>
    </div>
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
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  async function signIn(credential) {
    if (busy) return;
    setBusy(true); setErrorKey(null);
    try { await login(credential); } catch (error) {
      setErrorKey(loginErrorKeys[error.code] || 'account.loginError');
    } finally { setBusy(false); }
  }
  return <AccountFrame>
    <div className="profile-large"><UserRound size={32} /></div>
    <h1>{t('flow.welcome')}</h1><p>{t('account.intro')}</p>
    {!configured && <p role="alert">{t('account.unavailable')}</p>}
    {errorKey && <p className="account-error" role="alert">{t(errorKey)}</p>}
    <p>{t('flow.loginHint')}</p>
    <a href="/privacy">{t('privacy.read')}</a>
    <GoogleSignInButton disabled={busy || !configured} onCredential={signIn} onError={(error) => setErrorKey(loginErrorKeys[error?.code] || 'account.unavailable')} />
  </AccountFrame>;
}
export function SignupPrivacyPage() {
  const { acceptPrivacy } = useAuth();
  const { t } = useApp();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function continueSignup(event) {
    event.preventDefault();
    if (!accepted || busy) return;
    setBusy(true); setError(false);
    try { await acceptPrivacy(); } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <AccountFrame>
    <h1>{t('privacy.title')}</h1>
    <PrivacyNotice full />
    <form onSubmit={continueSignup} className="profile-form">
      <label className="privacy-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />{t('privacy.accept')}</label>
      {error && <p role="alert" className="account-error">{t('account.saveError')}</p>}
      <button className="primary-action" disabled={!accepted || busy}>{t(busy ? 'account.busy' : 'flow.agreeContinue')}</button>
    </form>
    <SignOutButton />
  </AccountFrame>;
}

export function FamilySetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { parent, childrenList, selectChild, saveParent, createChild, language, t } = useApp();
  const [childName, setChildName] = useState('');
  const [ageRange, setAgeRange] = useState('6-9');
  const [childLanguage, setChildLanguage] = useState(language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!childName.trim()) { setError('account.nameRequired'); return; }
    setBusy(true); setError(null);
    try {
      if (!parent) await saveParent(user?.displayName?.trim() || t('account.parent'));
      await createChild(childName, { ageRange, language: childLanguage });
      navigate('/', { replace: true, state: null });
    } catch { setError('account.saveError'); }
    finally { setBusy(false); }
  }
  return <AccountFrame>
    <h1>{t('flow.welcome')}</h1>
    <p>{t('account.parent')}: {user?.email || parent?.name || user?.displayName}</p>
    <h2>{t('flow.whoPractices')}</h2>
    {!!childrenList.length && <div className="child-picker">
      {childrenList.map((child) => <button type="button" className="child-picker-card" key={child.id} disabled={busy} onClick={() => { selectChild(child.id); navigate('/', { replace: true, state: null }); }}>
        <span className="profile-avatar">{child.name.slice(0, 1)}</span>
        <strong>{child.name}</strong>
        <small>{child.language === 'tamil' ? 'தமிழ்' : child.language === 'sinhala' ? 'සිංහල' : ''}</small>
      </button>)}
    </div>}
    <form className="profile-form" onSubmit={submit}>
      <h3>{t('account.addChild')}</h3>
      <label>{t('account.childName')}<input required maxLength={100} autoComplete="off" value={childName} onChange={(event) => setChildName(event.target.value)} /></label>
      <label>{t('flow.ageRange')}<select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}>
        {['6-9', '10-12', '13-16'].map((value) => <option key={value} value={value}>{t('flow.years', { range: value })}</option>)}
      </select></label>
      <label>{t('flow.childLanguage')}<select value={childLanguage} onChange={(event) => setChildLanguage(event.target.value)}>
        <option value="sinhala">සිංහල</option><option value="tamil">தமிழ்</option>
      </select></label>
      {error && <p className="account-error" role="alert">{t(error)}</p>}
      <button className="primary-action" disabled={busy}>{t(busy ? 'account.busy' : 'account.createChild')}</button>
    </form>
    <SignOutButton />
  </AccountFrame>;
}
