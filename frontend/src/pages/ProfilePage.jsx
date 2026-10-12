import { useEffect, useState } from 'react';
import { useApp } from '../context/useApp';
import PrivacyNotice from '../components/PrivacyNotice';
import { SignOutButton } from './AccountPage';

export default function ProfilePage() {
  const { parent, childrenList, activeChild, selectChild, saveParent, createChild, renameChild, t } = useApp();
  const [parentName, setParentName] = useState(parent?.name || '');
  const [childName, setChildName] = useState(activeChild?.name || '');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  useEffect(() => { setChildName(activeChild?.name || ''); setMessage(null); }, [activeChild?.id, activeChild?.name]);
  async function save(event, action) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(null);
    try { await action(); setMessage('account.saved'); } catch { setMessage('account.saveError'); }
    finally { setBusy(false); }
  }
  return <div className="page-stack family-profile">
    <section className="page-intro"><h2>{t('account.parent')}</h2></section>
    {message && <p role="status">{t(message)}</p>}
    <form className="profile-form result-card" onSubmit={(event) => save(event, () => saveParent(parentName))}>
      <label>{t('account.parentName')}<input required maxLength={100} value={parentName} onChange={(event) => setParentName(event.target.value)} /></label>
      <button className="primary-action" disabled={busy}>{t('account.save')}</button>
    </form>
    <section className="result-card"><h3>{t('account.children')}</h3>
      <div className="family-children">{childrenList.map((child) => <button type="button" key={child.id} className="soft-btn" aria-pressed={child.id === activeChild.id} disabled={busy} onClick={() => selectChild(child.id)}>{child.name}</button>)}</div>
      <form className="profile-form" onSubmit={(event) => save(event, () => renameChild(activeChild.id, childName))}>
        <label>{t('account.childName')}<input required maxLength={100} value={childName} onChange={(event) => setChildName(event.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{t('account.save')}</button>
      </form>
    </section>
    <form className="profile-form result-card" onSubmit={(event) => save(event, async () => { await createChild(newName); setNewName(''); })}>
      <h3>{t('account.addChild')}</h3>
      <label>{t('account.childName')}<input required maxLength={100} value={newName} onChange={(event) => setNewName(event.target.value)} /></label>
      <button className="primary-action" disabled={busy}>{t('account.createChild')}</button>
    </form>
    <PrivacyNotice phase="after" />
    <SignOutButton />
  </div>;
}
