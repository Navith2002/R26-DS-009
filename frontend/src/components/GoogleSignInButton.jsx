import { useEffect, useRef, useState } from 'react';
import { googleClientId } from '../auth/AuthContext';
import { getGoogleNonce } from '../services/accountApi';
import { useApp } from '../context/useApp';

let sdkPromise;
function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve(window.google.accounts.id);
    script.onerror = () => { script.remove(); sdkPromise = null; reject(new Error('Google unavailable')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export default function GoogleSignInButton({ onCredential, onError, disabled }) {
  const { language, t } = useApp();
  const ref = useRef(null);
  const callback = useRef(onCredential);
  const failure = useRef(onError);
  callback.current = onCredential;
  failure.current = onError;
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (disabled) return;
    let alive = true;
    setLoading(true); setFailed(false);
    Promise.all([loadGoogleIdentity(), getGoogleNonce()]).then(([google, { nonce, client_id: backendClientId }]) => {
      if (!alive) return;
      if (backendClientId && backendClientId !== googleClientId) {
        const error = new Error('Google sign-in settings mismatch');
        error.code = 'google_client_mismatch';
        throw error;
      }
      google.initialize({ client_id: googleClientId, nonce, auto_select: false, callback: (response) => {
        if (alive) callback.current(response.credential);
      } });
      ref.current.replaceChildren();
      google.renderButton(ref.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: language === 'tamil' ? 'ta' : 'si', width: 320 });
      setLoading(false);
    }).catch((error) => { if (alive) { setFailed(true); setLoading(false); failure.current(error); } });
    return () => { alive = false; };
  }, [language, disabled, retry]);
  if (disabled) return <button className="primary-action" disabled>{t('account.google')}</button>;
  return <div className="google-direct-signin">
    <p>{t('account.google')}</p>
    {loading && <p role="status">{t('account.busy')}</p>}
    <div ref={ref} aria-label={t('account.google')} />
    {failed && <button className="soft-btn" onClick={() => setRetry((count) => count + 1)}>{t('account.retry')}</button>}
  </div>;
}
