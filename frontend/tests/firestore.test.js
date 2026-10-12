// @vitest-environment node
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { createFamilyStore } from '../src/services/familyRepository';

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)('Firestore family security and persistence (requires emulator)', () => {
  let environment;
  beforeAll(async () => {
    environment = await initializeTestEnvironment({ projectId: 'demo-writebright', firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
  });
  beforeEach(async () => { await environment.clearFirestore(); });
  afterAll(async () => { await environment?.cleanup(); });
  async function setup() {
    const db = environment.authenticatedContext('parent-a').firestore();
    const store = createFamilyStore(db);
    await store.saveParent('parent-a', 'අම්මා');
    const first = await store.addChild('parent-a', 'අමල්');
    const second = await store.addChild('parent-a', 'නිමල්');
    return { db, store, first, second };
  }
  it('saves named profiles and reloads durable history under the correct child', async () => {
    const { db, store, first, second } = await setup();
    const saved = await store.saveRun('parent-a', first, 'grammar', { createdAt: '2026-10-12', language: 'si', result: { lines: [{ text: 'අම්මා', line_img: 'private-photo' }], vectors: [[1, 2], [3, 4]] } });
    const snapshot = await getDoc(doc(db, 'parents', 'parent-a', 'children', first, 'history', saved.id));
    expect(JSON.parse(snapshot.data().payload).result.lines).toEqual([{ text: 'අම්මා' }]);
    expect((await getDocs(collection(db, 'parents', 'parent-a', 'children', second, 'history'))).empty).toBe(true);
    await store.renameChild('parent-a', first, 'අමල් පෙරේරා');
    expect((await getDoc(doc(db, 'parents', 'parent-a', 'children', first))).data().name).toBe('අමල් පෙරේරා');
  });
  it('denies another parent and signed-out users all reads/writes/deletions of family data', async () => {
    const { store, first } = await setup();
    const saved = await store.saveRun('parent-a', first, 'reading', { createdAt: '2026-10-12', result: { accuracy: 80 } });
    for (const context of [environment.authenticatedContext('parent-b'), environment.unauthenticatedContext()]) {
      const db = context.firestore();
      const path = doc(db, 'parents', 'parent-a', 'children', first, 'history', saved.id);
      await assertFails(getDoc(path));
      await assertFails(deleteDoc(path));
      await assertFails(setDoc(path, { kind: 'reading', createdAt: 'today', payload: '{}' }));
      await assertFails(getDocs(collection(db, 'parents', 'parent-a', 'children')));
    }
  });
  it('denies malformed profiles, unsupported result kinds, missing children, and record overwrite', async () => {
    const { db, store, first } = await setup();
    await assertFails(setDoc(doc(db, 'parents', 'parent-a', 'children', 'bad'), { name: '', createdAt: 'today' }));
    await assertFails(setDoc(doc(db, 'parents', 'parent-a', 'children', first, 'history', 'bad'), { kind: 'unknown', createdAt: 'today', payload: '{}' }));
    await assertFails(store.saveRun('parent-a', 'missing', 'reading', { createdAt: 'today' }));
    const saved = await store.saveRun('parent-a', first, 'reading', { createdAt: 'today' });
    await assertFails(setDoc(doc(db, 'parents', 'parent-a', 'children', first, 'history', saved.id), { kind: 'reading', createdAt: 'today', payload: '{}' }));
    await assertSucceeds(store.deleteRun('parent-a', first, saved.id));
  });
  it('deletes more than one batch of records without deleting a sibling history', async () => {
    const { db, store, first, second } = await setup();
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore(); const batch = writeBatch(admin);
      for (let i = 0; i < 405; i += 1) batch.set(doc(admin, 'parents', 'parent-a', 'children', first, 'history', `${i}`), { kind: 'reading', createdAt: 'today', payload: '{}' });
      batch.set(doc(admin, 'parents', 'parent-a', 'children', second, 'history', 'keep'), { kind: 'reading', createdAt: 'today', payload: '{}' });
      await batch.commit();
    });
    await store.deleteAllRuns('parent-a', first);
    expect((await getDocs(collection(db, 'parents', 'parent-a', 'children', first, 'history'))).empty).toBe(true);
    expect((await getDocs(collection(db, 'parents', 'parent-a', 'children', second, 'history'))).size).toBe(1);
  });
});
