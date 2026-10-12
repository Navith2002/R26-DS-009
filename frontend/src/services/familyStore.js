import { db } from './firebase';
import { createFamilyStore } from './familyRepository';

export const { watchParent, watchChildren, watchHistory, saveParent, addChild, renameChild, saveRun, deleteRun, deleteAllRuns } = createFamilyStore(db);
