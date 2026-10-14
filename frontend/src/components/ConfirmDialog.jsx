import { useEffect, useRef } from 'react';
import { useApp } from '../context/useApp';

export default function ConfirmDialog({ message, busy, onConfirm, onCancel }) {
  const ref = useRef(null);
  const { t } = useApp();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog className="account-confirm" ref={ref} aria-labelledby="confirm-message" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <p id="confirm-message">{message}</p>
    <div className="account-confirm-actions">
      <button className="soft-btn" autoFocus disabled={busy} onClick={onCancel}>{t('account.cancel')}</button>
      <button className="danger-outline" disabled={busy} onClick={onConfirm}>{t(busy ? 'account.busy' : 'account.delete')}</button>
    </div>
  </dialog>;
}
