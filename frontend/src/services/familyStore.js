import { accountRequest } from './accountApi';
import { encodeHistory } from '../utils/historyRecord';

const changes = new EventTarget();
function changed() { changes.dispatchEvent(new Event('change')); }
function watch(path, next, fail, decode = (value) => value) {
  let alive = true;
  let generation = 0;
  async function refresh() {
    const request = ++generation;
    try {
      const value = await accountRequest(path);
      if (alive && request === generation) next(decode(value));
    } catch (error) { if (alive && request === generation) fail(error); }
  }
  refresh();
  const timer = setInterval(refresh, 15000);
  changes.addEventListener('change', refresh);
  return () => { alive = false; generation += 1; clearInterval(timer); changes.removeEventListener('change', refresh); };
}
// UID parameters keep the existing context interface; they are never sent to
// the server. The verified HTTP-only session determines ownership there.
export const watchParent = (_uid, next, fail) => watch('/family/parent', next, fail);
export const watchChildren = (_uid, next, fail) => watch('/family/children', next, fail);
const path = (childId) => `/family/children/${encodeURIComponent(childId)}/history`;
export const watchHistory = (_uid, childId, next, fail) => watch(path(childId), next, fail, (items) => items.map((item) => ({ ...JSON.parse(item.payload), id: item.id, kind: item.kind, createdAt: item.createdAt })));
async function mutate(url, method, value) {
  const result = await accountRequest(url, { method, ...(value ? { body: JSON.stringify(value) } : {}) });
  changed();
  return result;
}
export const saveParent = (_uid, name) => mutate('/family/parent', 'PUT', { name: name.trim() });
export async function addChild(_uid, name, details = {}) { return (await mutate('/family/children', 'POST', { name: name.trim(), ...details })).id; }
export const renameChild = (_uid, id, name) => mutate(`/family/children/${encodeURIComponent(id)}`, 'PATCH', { name: name.trim() });
export async function saveRun(_uid, childId, kind, entry) {
  const saved = await mutate(path(childId), 'POST', { kind, createdAt: entry.createdAt, payload: encodeHistory(entry) });
  return { ...entry, id: saved.id, kind };
}
export const deleteRun = (_uid, childId, id) => mutate(`${path(childId)}/${encodeURIComponent(id)}`, 'DELETE');
export const deleteAllRuns = (_uid, childId) => mutate(path(childId), 'DELETE');
