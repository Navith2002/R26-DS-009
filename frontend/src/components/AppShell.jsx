import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BookOpenCheck,
  Camera,
  Clock3,
  Home,
  Mic,
  SpellCheck2,
  UserRound,
  Volume2,
} from 'lucide-react';
import Logo from './Logo';
import LanguageToggle from './LanguageToggle';
import { useApp } from '../context/useApp';

// One decorative bouncing mascot per main nav page (styles.css:
// .page-mascot), each a different animal -- centralized here rather than
// duplicated into every page component so it keeps showing regardless of
// which internal screen/state a page (e.g. FluencyPage, GrammarCheckPage)
// is currently rendering. Sub-routes not in the sidebar (/results/:id,
// /grammar-results/:id, /reading-error's own sub-screens, etc.) simply
// have no entry here and show no mascot.
const PAGE_MASCOTS = {
  '/': '🐻',
  '/analyze': '🦊',
  '/grammar-check': '🐱',
  '/fluency': '🦁',
  '/reading-error': '🐨',
  '/progress': '🐼',
  '/history': '🦄',
  '/profile': '🐶',
};

export default function AppShell() {
  const { profile, language, t } = useApp();
  const location = useLocation();
  const hiddenHeader = location.pathname.startsWith('/results');

  // Sidebar order per explicit request: Home, then the 4 components in
  // their nav order (check / grammar / fluency / reading-error), then
  // progress, practice, history, profile.
  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/analyze', label: t('nav.check'), shortLabel: t('nav.checkShort'), icon: Camera },
    { to: '/grammar-check', label: t('nav.grammarCheck'), shortLabel: t('nav.grammarCheckShort'), icon: SpellCheck2 },
    { to: '/fluency', label: t('nav.fluency'), shortLabel: t('nav.fluencyShort'), icon: Mic },
    { to: '/reading-error', label: t('nav.readingError'), shortLabel: t('nav.readingErrorShort'), icon: Volume2 },
    { to: '/progress', label: t('nav.progress'), shortLabel: t('nav.progressShort'), icon: BarChart3 },
    { to: '/practice', label: t('nav.practice'), icon: BookOpenCheck },
    { to: '/history', label: t('nav.history'), icon: Clock3 },
    { to: '/profile', label: t('nav.profile'), icon: UserRound },
  ];

  // Mobile bottom nav intentionally keeps its own fixed 4 items (Home,
  // check, progress, practice) regardless of the sidebar order above --
  // picked by route rather than by array position so reordering navItems
  // doesn't silently change what shows up here.
  const mobileRoutes = ['/', '/analyze', '/progress', '/practice'];
  const mobileNavItems = mobileRoutes.map((route) => navItems.find((item) => item.to === route));

  const displayName = profile.name || t('header.learner');
  const pageMascot = PAGE_MASCOTS[location.pathname];

  return (
    <div className={`app-shell ui-language-${language}`} lang={language === 'tamil' ? 'ta' : 'si'}>
      <aside className="sidebar">
        <Logo />
        <nav className="sidebar-menu">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon"><Icon size={19} /></span>
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        {!hiddenHeader && (
          <header className="top-header">
            <div className="welcome">
              <h1>{t('header.hi', { name: displayName })}</h1>
            </div>
            <div className="header-actions">
              <NavLink to="/profile" className="profile-chip">
                <div className="profile-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
                <div className="profile-info"><strong>{displayName}</strong></div>
              </NavLink>
              <LanguageToggle />
            </div>
          </header>
        )}
        <Outlet />
      </main>

      <nav className="mobile-nav">
        {mobileNavItems.map(({ to, label, shortLabel, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><Icon size={19} /></span>
            {shortLabel || label}
          </NavLink>
        ))}
      </nav>

      {pageMascot && <span className="page-mascot" aria-hidden="true">{pageMascot}</span>}
    </div>
  );
}
