import { collection, doc, getDoc, onSnapshot, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { encodeHistory } from '../utils/historyRecord';

function checkedName(name) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw new Error('invalid-name');
  return trimmed;
}
export function createFamilyStore(db) {
  const family = (uid) => doc(db, 'parents', uid);
  const childCollection = (uid) => collection(family(uid), 'children');
  const records = (uid, childId) => collection(doc(childCollection(uid), childId), 'history');
  const watchParent = (uid, next, fail) => onSnapshot(family(uid), (snapshot) => next(snapshot.exists() ? snapshot.data() : null), fail);
  const watchChildren = (uid, next, fail) => onSnapshot(childCollection(uid), (snapshot) => {
    next(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }, fail);
  const watchHistory = (uid, childId, next, fail) => onSnapshot(records(uid, childId), (snapshot) => {
    try {
      next(snapshot.docs.map((item) => {
        const record = item.data();
        return { ...JSON.parse(record.payload), id: item.id, kind: record.kind, createdAt: record.createdAt };
      }));
    } catch (error) { fail(error); }
  }, fail);
  async function saveParent(uid, name) {
    const ref = family(uid);
    const validName = checkedName(name);
    const existing = await getDoc(ref);
    await setDoc(ref, { name: validName, createdAt: existing.data()?.createdAt || new Date().toISOString() });
  }
  async function addChild(uid, name) {
    const ref = doc(childCollection(uid));
    await setDoc(ref, { name: checkedName(name), createdAt: new Date().toISOString() });
    return ref.id;
  }
  async function renameChild(uid, id, name) {
    await setDoc(doc(childCollection(uid), id), { name: checkedName(name) }, { merge: true });
  }
  async function saveRun(uid, childId, kind, entry) {
    const ref = doc(records(uid, childId));
    await setDoc(ref, { kind, createdAt: entry.createdAt, payload: encodeHistory(entry) });
    return { ...entry, id: ref.id, kind };
  }
  const deleteRun = (uid, childId, id) => deleteDoc(doc(records(uid, childId), id));
  async function deleteAllRuns(uid, childId) {
    const snapshot = await getDocs(records(uid, childId));
    // Firestore batches allow at most 500 writes. Do not silently cap history.
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
  return { watchParent, watchChildren, watchHistory, saveParent, addChild, renameChild, saveRun, deleteRun, deleteAllRuns };
}
