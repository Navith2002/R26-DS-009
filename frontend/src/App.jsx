import { Routes, Route } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { useApp } from './context/useApp';
import AccountPage, { AccountFrame, FamilySetupPage, SignOutButton } from './pages/AccountPage';
import ReadingResultPage from './pages/ReadingResultPage';
import AppShell from './components/AppShell';
import HomePage from './pages/HomePage';
import AnalyzePage from './pages/AnalyzePage';
import ResultsPage from './pages/ResultsPage';
import ProgressPage from './pages/ProgressPage';
import HistoryPage from './pages/HistoryPage';
import PracticePage from './pages/PracticePage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import GrammarCheckPage from './pages/GrammarCheckPage';
import GrammarResultPage from './pages/GrammarResultPage';
import FluencyPage from './pages/FluencyPage';
import FluencyResultPage from './pages/FluencyResultPage';
import ReadingErrorPage from './pages/ReadingErrorPage';

export default function App() {
  const { user, loading, error } = useAuth();
  const { scope, familyLoading, familyError, parent, activeChild, historyLoading, historyError, retryFamily, t } = useApp();
  if (loading) return <AccountFrame><p role="status">{t('account.busy')}</p></AccountFrame>;
  if (!user) return <><AccountPage />{error && <p role="alert">{t('account.loginError')}</p>}</>;
  if (familyError || historyError) return <AccountFrame><p role="alert">{t('account.loadError')}</p><button className="primary-action" onClick={retryFamily}>{t('account.retry')}</button><SignOutButton /></AccountFrame>;
  if (familyLoading || (activeChild && historyLoading)) return <AccountFrame><p role="status">{t('account.historyLoading')}</p><SignOutButton /></AccountFrame>;
  if (!parent || !activeChild) return <FamilySetupPage />;
  return (
    <Routes key={scope}>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/grammar-check" element={<GrammarCheckPage />} />
        <Route path="/grammar-results/:id" element={<GrammarResultPage />} />
        <Route path="/fluency" element={<FluencyPage />} />
        <Route path="/fluency-results/:id" element={<FluencyResultPage />} />
        <Route path="/reading-results/:id" element={<ReadingResultPage />} />
        <Route path="/reading-error" element={<ReadingErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
