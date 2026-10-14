import { useApp } from '../context/useApp';
import { useAuth } from '../auth/AuthContext';
import { SignOutButton } from './AccountPage';
import { formatDate } from '../utils/format';

export default function ProfilePage() {
  const { parent, childrenList, activeChild, language, t } = useApp();
  const { user } = useAuth();
  return <div className="page-stack family-profile">
    <section className="page-intro"><h2>{t('flow.accountSummary')}</h2></section>
    <section className="result-card">
      <h3>{t('account.parent')}</h3><p>{parent?.name || user?.displayName}</p>
      {user?.email && <p>{user.email}</p>}
    </section>
    <section className="result-card"><h3>{t('account.children')}</h3>
      <div className="child-summary-list">{childrenList.map((child) => <article className="child-summary-card" key={child.id}>
        <div className="child-summary-heading"><span className="profile-avatar">{child.name.slice(0, 1)}</span><h4>{child.name}</h4>
          {child.id === activeChild?.id && <span className="quality-pill tone-good">{t('flow.activeChild')}</span>}
        </div>
        <dl>
          <div><dt>{t('flow.ageRange')}</dt><dd>{child.ageRange ? t('flow.years', { range: child.ageRange }) : t('account.notAvailable')}</dd></div>
          <div><dt>{t('flow.childLanguage')}</dt><dd>{child.language === 'tamil' ? 'தமிழ்' : child.language === 'sinhala' ? 'සිංහල' : t('account.notAvailable')}</dd></div>
          {child.createdAt && <div><dt>{t('flow.createdOn')}</dt><dd>{formatDate(child.createdAt, language)}</dd></div>}
        </dl>
      </article>)}</div>
    </section>
    <SignOutButton />
  </div>;
}
