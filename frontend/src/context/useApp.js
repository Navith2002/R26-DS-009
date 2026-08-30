import { useContext } from 'react';
import { AppContext } from './AppContext';

// Split out of AppContext.jsx so that file exports only the AppProvider
// component -- see the comment on AppContext's export for why.
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
