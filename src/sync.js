import { applyRemote, clearQueue, getAllRecords, getQueue } from './db'

const API = import.meta.env.VITE_SYNC_API || 'http://localhost:8787'

export async function syncNow() {
  if (!navigator.onLine) return { ok: false, reason: 'offline' }
  const queue = await getQueue()
  const localRecords = await getAllRecords()
  try {
    const response = await fetch(`${API}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: queue.map(item => item.record), knownIds: localRecords.map(item => item.id) })
    })
    if (!response.ok) throw new Error(`Sync server returned ${response.status}`)
    const payload = await response.json()
    await applyRemote(payload.records || [])
    await clearQueue(queue)
    return { ok: true, synced: queue.length, total: (payload.records || []).length }
  } catch (error) {
    return { ok: false, reason: error.message || 'Sync unavailable' }
  }
}
