import { Sparkles } from 'lucide-react';

// className is optional and appended, not replaced -- every existing
// caller (Home/History/Progress) keeps its current size unchanged; only
// a caller that opts in with an extra class (e.g. FluencyPage's
// "empty-state--lg") gets the bigger variant (see styles.css).
export default function EmptyState({ title, text, action, className = '' }) {
  return (
    <div className={`empty-state${className ? ` ${className}` : ''}`}>
      <div className="empty-icon"><Sparkles size={28} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
