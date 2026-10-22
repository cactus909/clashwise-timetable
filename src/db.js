const DB_NAME = 'clashwise-local'
const DB_VERSION = 1

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('slots')) db.createObjectStore('slots', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(storeNames, mode, action) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode)
    const result = action(tx)
    tx.oncomplete = () => { db.close(); resolve(result?.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

export async function getAllSlots() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('slots', 'readonly')
    const req = tx.objectStore('slots').getAll()
    req.onsuccess = () => { db.close(); resolve(req.result.filter(x => !x.deleted)) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function getAllRecords() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('slots', 'readonly')
    const req = tx.objectStore('slots').getAll()
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function getQueue() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly')
    const req = tx.objectStore('queue').getAll()
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function saveLocal(record) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['slots', 'queue'], 'readwrite')
    tx.objectStore('slots').put(record)
    tx.objectStore('queue').put({ id: record.id, record, queuedAt: new Date().toISOString() })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function applyRemote(records) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('slots', 'readwrite')
    const store = tx.objectStore('slots')
    for (const remote of records) {
      const req = store.get(remote.id)
      req.onsuccess = () => {
        const local = req.result
        if (!local || (remote.updatedAt || '') > (local.updatedAt || '')) store.put(remote)
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function clearQueue(submittedItems) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    const store = tx.objectStore('queue')
    for (const submitted of submittedItems) {
      const req = store.get(submitted.id)
      req.onsuccess = () => {
        // Keep a newer edit queued if the user changed this slot while sync was in flight.
        if (req.result?.record?.updatedAt === submitted.record?.updatedAt) store.delete(submitted.id)
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function seedIfEmpty() {
  const existing = await getAllRecords()
  if (existing.length) return
  const now = new Date().toISOString()
  const examples = [
    { id: crypto.randomUUID(), subject: 'Data Structures', day: 1, start: '09:00', end: '10:00', room: 'B-204', color: 'violet', updatedAt: now, deleted: false },
    { id: crypto.randomUUID(), subject: 'Discrete Mathematics', day: 1, start: '09:30', end: '10:30', room: 'A-110', color: 'coral', updatedAt: now, deleted: false },
    { id: crypto.randomUUID(), subject: 'Database Systems', day: 2, start: '11:00', end: '12:00', room: 'Lab 3', color: 'blue', updatedAt: now, deleted: false },
    { id: crypto.randomUUID(), subject: 'Computer Networks', day: 3, start: '14:00', end: '15:00', room: 'C-101', color: 'green', updatedAt: now, deleted: false },
    { id: crypto.randomUUID(), subject: 'Operating Systems', day: 4, start: '10:00', end: '11:30', room: 'B-204', color: 'amber', updatedAt: now, deleted: false },
    { id: crypto.randomUUID(), subject: 'Software Engineering', day: 5, start: '13:00', end: '14:00', room: 'A-205', color: 'pink', updatedAt: now, deleted: false }
  ]
  for (const item of examples) await saveLocal(item)
}
