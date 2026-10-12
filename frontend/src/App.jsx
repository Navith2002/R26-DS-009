import { Routes, Route } from 'react-router-dom';
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
  return (
    <Routes>
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
        <Route path="/reading-error" element={<ReadingErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
