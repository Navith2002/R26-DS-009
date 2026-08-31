import { useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import { useApp } from '../context/useApp';
import { roleLabel } from '../i18n/translations';

const roles = ['Student', 'Teacher', 'Parent', 'Researcher'];

export default function ProfilePage() {
  const { profile, setProfile, language, t } = useApp();
  const [name, setName] = useState(profile.name || '');
  const [role, setRole] = useState(profile.role || 'Student');
  const [saved, setSaved] = useState(false);

  function submit(e) {
    e.preventDefault();
    setProfile({ name: name.trim() || t('header.learner'), role });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">{t('profile.eyebrow')}</span>
        <h2>{t('profile.title')}</h2>
      </section>
      <form className="profile-form result-card" onSubmit={submit}>
        <div className="profile-large"><UserRound size={32} /></div>
        <label>
          {t('profile.displayName')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile.namePlaceholder')} />
        </label>
        <label>
          {t('profile.role')}
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((value) => <option key={value} value={value}>{roleLabel(value, language)}</option>)}
          </select>
        </label>
        <button className="primary-action" type="submit"><Save size={17} /> {saved ? t('profile.saved') : t('profile.save')}</button>
      </form>
    </div>
  );
}
