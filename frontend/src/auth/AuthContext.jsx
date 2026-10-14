import { createContext, useContext, useEffect, useState } from 'react';
import { acceptPrivacy as acceptPrivacyRequest, endSession, exchangeGoogleCredential, getSession } from '../services/accountApi';

const AuthContext = createContext(null);
export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    getSession().then((next) => {
      if (alive) { setUser(next); }
    }).catch((failure) => {
      if (alive && failure.status !== 401) setError(failure);
    }).finally(() => { if (alive) setLoading(false); });
    const expired = () => { setUser(null); };
    window.addEventListener('writebright:session-ended', expired);
    return () => { alive = false; window.removeEventListener('writebright:session-ended', expired); };
  }, []);
  async function login(credential) {
    const next = await exchangeGoogleCredential(credential);
    setUser(next);
    setError(null);
  }
  async function acceptPrivacy() {
    const next = await acceptPrivacyRequest();
    setUser(next);
    setError(null);
  }
  async function logout() {
    await endSession();
    window.google?.accounts?.id?.disableAutoSelect();
    setUser(null); setError(null);
  }
  return <AuthContext.Provider value={{ user, loading, error, login, logout, configured: Boolean(googleClientId), acceptPrivacy }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
