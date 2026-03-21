import Dexie from 'dexie';

const db = new Dexie('AcatenangoScrapbook');

db.version(1).stores({
  photos: 'date, caption, blob',
});

export default db;
