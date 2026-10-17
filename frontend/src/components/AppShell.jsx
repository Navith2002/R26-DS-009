import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import AppFooter from './AppFooter';
import { useApp } from '../context/useApp';

// Each learning area keeps one colour everywhere (sidebar chip, page
// accents): writing check orange, grammar green, fluency saffron, reading
// errors sky, everything else leaf.
function pageToneFor(pathname) {
  if (pathname.startsWith('/analyze') || pathname.startsWith('/results')) return 'orange';
  if (pathname.startsWith('/grammar')) return 'green';
  if (pathname.startsWith('/fluency')) return 'saffron';
  if (pathname.startsWith('/reading')) return 'sky';
  return 'leaf';
}

export default function AppShell() {
  const { profile, language, t, childrenList, activeChild, selectChild } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const hiddenHeader = location.pathname.startsWith('/results');

  // Sidebar order per explicit request: Home, then the 4 components in
  // their nav order (check / grammar / fluency / reading-error), then
  // progress, practice, history, profile.
  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home, tone: 'orange' },
    { to: '/analyze', label: t('nav.check'), shortLabel: t('nav.checkShort'), icon: Camera, tone: 'orange' },
    { to: '/grammar-check', label: t('nav.grammarCheck'), shortLabel: t('nav.grammarCheckShort'), icon: SpellCheck2, tone: 'green' },
    { to: '/reading-error', label: t('nav.readingError'), shortLabel: t('nav.readingErrorShort'), icon: Volume2, tone: 'sky' },
    { to: '/fluency', label: t('nav.fluency'), shortLabel: t('nav.fluencyShort'), icon: Mic, tone: 'saffron' },
    { to: '/fluency-practice', label: t('nav.readingPractice'), icon: BookOpenCheck, tone: 'saffron' },
    { to: '/progress', label: t('nav.progress'), shortLabel: t('nav.progressShort'), icon: BarChart3, tone: 'leaf' },
    { to: '/practice', label: t('nav.practice'), icon: BookOpenCheck, tone: 'leaf' },
    { to: '/history', label: t('nav.history'), icon: Clock3, tone: 'leaf' },
    { to: '/profile', label: t('nav.profile'), icon: UserRound, tone: 'leaf' },
  ];

  // Mobile bottom nav intentionally keeps its own fixed 4 items (Home,
  // check, progress, practice) regardless of the sidebar order above --
  // picked by route rather than by array position so reordering navItems
  // doesn't silently change what shows up here.
  const mobileRoutes = ['/', '/analyze', '/progress', '/practice'];
  const mobileNavItems = mobileRoutes.map((route) => navItems.find((item) => item.to === route));

  const displayName = profile.name || t('header.learner');
  const pageTone = pageToneFor(location.pathname);

  return (
    <div className={`app-shell ui-language-${language}`} lang={language === 'tamil' ? 'ta' : 'si'}>
      <aside className="sidebar">
        <Logo />
        <nav className="sidebar-menu">
          {navItems.map(({ to, label, icon: Icon, tone }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className={`sidebar-icon tone-${tone}`}><Icon size={19} /></span>
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className={`main-area page-tone-${pageTone}`}>
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
              <label className="child-selector">{t('account.chooseChild')}
                <select value={activeChild.id} onChange={(event) => { selectChild(event.target.value || null); navigate('/', { replace: true, state: null }); }}>
                  <option value="">{t('flow.chooseAnother')}</option>
                  {childrenList.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                </select>
              </label>
              <LanguageToggle />
            </div>
          </header>
        )}
        <Outlet />
        <AppFooter />
      </main>

      <nav className="mobile-nav">
        {mobileNavItems.map(({ to, label, shortLabel, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="mobile-nav-icon"><Icon size={19} /></span>
            {shortLabel || label}
          </NavLink>
        ))}
      </nav>

    </div>
  );
}
