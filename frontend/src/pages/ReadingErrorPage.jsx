import ReadingErrorApp from '../components/reading_error/ReadingErrorApp';

// Thin wrapper for routing consistency with GrammarCheckPage/FluencyPage --
// ReadingErrorApp is fully self-contained (reads WriteBright's global
// language via useApp() internally, per ReadingErrorApp.jsx's own
// comment), so there's nothing else to pass down here.
export default function ReadingErrorPage() {
  return <ReadingErrorApp />;
}
