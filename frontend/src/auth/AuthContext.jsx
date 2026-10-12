import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, firebaseConfigured, googleProvider } from '../services/firebase';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
      setError(null);
    }, (failure) => { setError(failure); setLoading(false); });
  }, []);
  async function login(language) {
    if (!auth) throw new Error('firebase-unavailable');
    auth.languageCode = language === 'tamil' ? 'ta' : 'si';
    googleProvider.setCustomParameters({ prompt: 'select_account', hl: auth.languageCode });
    return signInWithPopup(auth, googleProvider);
  }
  return <AuthContext.Provider value={{ user, loading, error, login, logout: () => signOut(auth), configured: firebaseConfigured }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
