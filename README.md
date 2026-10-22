# Clashwise Timetable

A React + Vite installable PWA for managing weekly class slots, detecting scheduling conflicts, and continuing to work offline.

## Features

- Create, read, update, and delete class slots.
- Real-time overlap detection, with warning styling in the grid and edit form.
- Color-coded Monday–Sunday timetable and searchable list view.
- IndexedDB persistence, including deletion tombstones and a durable outbound sync queue.
- PWA service worker for cached application assets.
- Custom Express sync API with JSON-file persistence.
- Reconnect-triggered sync and manual **Sync now** control.

## Requirements

- Node.js 18+ (20+ recommended)
- npm

## Run locally

Open two terminals in the project folder.

**Terminal 1 — sync backend**
```bash
npm install
npm run server
```
The API listens on `http://localhost:8787`.

**Terminal 2 — frontend**
```bash
npm run dev
```
Open the Vite URL printed in the terminal. The frontend expects the sync API at `http://localhost:8787`. If the API is hosted elsewhere, create `.env`:
```env
VITE_SYNC_API=http://your-server:8787
```
Then restart the frontend. The API enables CORS for local development; configure allowed origins and HTTPS before public deployment.

Build production assets with `npm run build`, then serve with `npm run preview`. Installability/offline caching works in production builds and on localhost; service workers generally require HTTPS outside localhost.

## Try the clash detector

The first launch seeds example classes, including two overlapping Monday classes (Data Structures 09:00–10:00 and Discrete Mathematics 09:30–10:30). Edit or delete these examples and add your own slots. The sample data is only seeded when the local database has no records.

## Conflict detection logic

A class is represented as a half-open interval `[start, end)` on a weekday. Two different classes clash if they share the same day and:

```js
a.start < b.end && b.start < a.end
```

Times are converted to minutes after midnight before comparison. This catches partial overlaps and containment but permits adjacent classes such as 09:00–10:00 and 10:00–11:00. Every pair is compared when deriving the current conflict map, so the UI updates immediately after local state reloads. This straightforward pairwise approach is O(n²), appropriate for a student timetable with relatively few slots.

## Offline data structure

IndexedDB has three object stores:

- `slots`: latest local records keyed by stable UUID. Deleted slots remain as tombstones (`deleted: true`) so a deletion can be synchronized later.
- `queue`: one pending record per slot ID. Repeated edits to a slot coalesce into the latest queued record.
- `meta`: reserved for future sync cursors or device metadata.

Every mutation is committed to `slots` and `queue` in the same IndexedDB read-write transaction before the UI considers it saved. That means a browser restart does not discard queued changes. The app itself is cached by the PWA service worker after a successful production load.

## Synchronization and reconciliation

When the browser comes online, or the user presses **Sync now**, the client sends queued records to `POST /api/sync`. The backend stores records in `server/data/slots.json`, merges incoming changes by ID, and returns the merged set. The client then merges server records into IndexedDB and removes the submitted queue entries. A network error leaves the queue intact for a later retry.

The sample reconciliation policy is **last-write-wins by ISO `updatedAt` timestamp**. Server records win timestamp ties. Tombstones participate in the same merge so deletions propagate. This is intentionally simple for a single-user demo; a production multi-device system should add authenticated users, server-issued revisions or logical clocks, idempotency, robust concurrent-edit handling, retry/backoff, schema validation, and a user-visible conflict-resolution flow. Clock-based last-write-wins can lose one of two near-simultaneous edits if device clocks disagree.

## Important notes

- The browser and API must be reachable on the network for sync. Offline CRUD and local persistence do not depend on the backend.
- The JSON-file backend is suitable for a demo or single-process deployment, not a horizontally scaled production service.
- Use HTTPS and configure CORS/authentication before exposing the API publicly.
