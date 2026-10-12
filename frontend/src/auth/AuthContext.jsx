import { createContext, useContext, useEffect, useState } from 'react';
import { endSession, exchangeGoogleCredential, getSession } from '../services/accountApi';

const AuthContext = createContext(null);
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [privacyNoticePending, setPrivacyNoticePending] = useState(false);
  useEffect(() => {
    let alive = true;
    getSession().then((next) => {
      if (alive) { setUser(next); setPrivacyNoticePending(Boolean(next.newAccount)); }
    }).catch((failure) => {
      if (alive && failure.status !== 401) setError(failure);
    }).finally(() => { if (alive) setLoading(false); });
    const expired = () => { setUser(null); setPrivacyNoticePending(false); };
    window.addEventListener('writebright:session-ended', expired);
    return () => { alive = false; window.removeEventListener('writebright:session-ended', expired); };
  }, []);
  async function login(credential) {
    const next = await exchangeGoogleCredential(credential);
    setUser(next);
    setError(null);
    setPrivacyNoticePending(Boolean(next.newAccount));
  }
  async function logout() {
    await endSession();
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null); setPrivacyNoticePending(false); setError(null);
  }
  return <AuthContext.Provider value={{ user, loading, error, login, logout, configured: Boolean(googleClientId), privacyNoticePending, dismissPrivacyNotice: () => setPrivacyNoticePending(false) }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
