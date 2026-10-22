import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownUp, CalendarDays, Check, ChevronDown, Cloud, CloudOff, Clock3, GraduationCap, Plus, RefreshCw, Search, Settings2, Trash2, Wifi, X, Pencil, BookOpen, MapPin, CircleHelp } from 'lucide-react'
import { getAllSlots, saveLocal, seedIfEmpty } from './db'
import { syncNow } from './sync'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const COLORS = {
  violet: { bg: '#eee8ff', line: '#8b5cf6', text: '#5630a8' },
  coral: { bg: '#ffebe5', line: '#f07858', text: '#9b3c25' },
  blue: { bg: '#e4efff', line: '#4c8ce8', text: '#24569a' },
  green: { bg: '#e1f6ec', line: '#35a879', text: '#176b4b' },
  amber: { bg: '#fff3d8', line: '#e7a52b', text: '#80560b' },
  pink: { bg: '#ffe6f0', line: '#e46da2', text: '#96385e' }
}
const TIMES = Array.from({ length: 21 }, (_, i) => 8 * 60 + i * 30)

const toMinutes = value => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}
const fmt = value => {
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}
const duration = slot => (toMinutes(slot.end) - toMinutes(slot.start)) / 60
const overlaps = (a, b) => a.day === b.day && a.id !== b.id && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)

function App() {
  const [slots, setSlots] = useState([])
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedDay, setSelectedDay] = useState('all')
  const [online, setOnline] = useState(navigator.onLine)
  const [syncState, setSyncState] = useState('idle')
  const [lastSynced, setLastSynced] = useState(null)
  const [notice, setNotice] = useState('')
  const [view, setView] = useState('week')

  const reload = useCallback(async () => setSlots(await getAllSlots()), [])
  useEffect(() => {
    let active = true
    ;(async () => {
      await seedIfEmpty()
      const items = await getAllSlots()
      if (active) { setSlots(items); setReady(true); if (navigator.onLine) runSync() }
    })()
    const onlineHandler = () => { setOnline(true); runSync() }
    const offlineHandler = () => { setOnline(false); setSyncState('offline') }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    return () => {
      active = false
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }, [])

  const conflicts = useMemo(() => {
    const result = new Map()
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (overlaps(slots[i], slots[j])) {
          result.set(slots[i].id, [...(result.get(slots[i].id) || []), slots[j]])
          result.set(slots[j].id, [...(result.get(slots[j].id) || []), slots[i]])
        }
      }
    }
    return result
  }, [slots])

  async function runSync() {
    if (!navigator.onLine) { setSyncState('offline'); return }
    setSyncState('syncing')
    const result = await syncNow()
    if (result.ok) {
      setSyncState('synced')
      setLastSynced(new Date())
      await reload()
    } else setSyncState('pending')
  }

  async function persist(values) {
    const record = {
      ...values,
      id: editing?.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      deleted: false
    }
    await saveLocal(record)
    await reload()
    setShowForm(false)
    setEditing(null)
    setNotice(conflicts.has(record.id) ? 'Saved — this slot has a scheduling clash.' : 'Slot saved locally.')
    window.setTimeout(() => setNotice(''), 3500)
    if (navigator.onLine) runSync()
  }

  async function removeSlot(slot) {
    if (!confirm(`Delete "${slot.subject}"?`)) return
    await saveLocal({ ...slot, deleted: true, updatedAt: new Date().toISOString() })
    await reload()
    setNotice('Slot deleted locally.')
    window.setTimeout(() => setNotice(''), 3000)
    if (navigator.onLine) runSync()
  }

  const filtered = slots.filter(s => s.subject.toLowerCase().includes(query.toLowerCase()) && (selectedDay === 'all' || s.day === Number(selectedDay)))
  const clashCount = conflicts.size
  const conflictPairCount = [...conflicts.values()].reduce((sum, list) => sum + list.length, 0) / 2

  if (!ready) return <div className="loading"><div className="brand-mark"><CalendarDays /></div><p>Opening your timetable…</p></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><CalendarDays size={22}/></div><div><strong>clashwise</strong><span>SMART TIMETABLE</span></div></div>
      <div className="side-label">WORKSPACE</div>
      <button className={`nav-item ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}><CalendarDays size={18}/> Weekly timetable</button>
      <button className={`nav-item ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><BookOpen size={18}/> All classes <span className="nav-count">{slots.length}</span></button>
      <div className="side-label second">OVERVIEW</div>
      <div className={`side-alert ${clashCount ? 'has-clash' : ''}`}><div className="alert-icon"><AlertTriangle size={17}/></div><div><strong>{clashCount ? `${clashCount} classes affected` : 'No clashes detected'}</strong><span>{clashCount ? `${conflictPairCount} overlap${conflictPairCount === 1 ? '' : 's'} to review` : 'Your week looks clear'}</span></div></div>
      <div className="sidebar-bottom">
        <div className="offline-card"><div className="offline-top"><span className="live-dot"/><strong>Local-first storage</strong></div><p>Your changes are saved on this device, even without internet.</p><div className="storage-tag"><Check size={12}/> Auto-saved</div></div>
        <div className="profile"><div className="avatar">ST</div><div><strong>Student workspace</strong><span>Personal timetable</span></div><Settings2 size={17} className="profile-settings"/></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="breadcrumb">Workspace <span>/</span> <strong>{view === 'week' ? 'Weekly timetable' : 'All classes'}</strong></div>
        <div className="top-actions">
          <div className={`connection ${online ? 'is-online' : 'is-offline'}`}>{online ? <Wifi size={14}/> : <CloudOff size={14}/>}<span>{online ? 'Online' : 'Offline mode'}</span></div>
          <button className="sync-button" onClick={runSync} disabled={!online || syncState === 'syncing'}><RefreshCw size={14} className={syncState === 'syncing' ? 'spin' : ''}/>{syncState === 'syncing' ? 'Syncing' : 'Sync now'}</button>
          <button className="avatar small-avatar" title="Student workspace">ST</button>
        </div>
      </header>

      <section className="content">
        <div className="welcome-row">
          <div><div className="eyebrow"><GraduationCap size={15}/> YOUR SEMESTER, IN SYNC</div><h1>Make room for <span>what matters.</span></h1><p className="subtitle">Your week at a glance. Clashes caught before they catch you.</p></div>
          <button className="primary-button" onClick={() => { setEditing(null); setShowForm(true) }}><Plus size={17}/> Add class slot</button>
        </div>

        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon purple"><CalendarDays size={18}/></div><div className="stat-label">Total classes</div><div className="stat-value">{slots.length}<span> slots</span></div><div className="stat-foot"><span className="tiny-dot purple-dot"/> Across your week</div></div>
          <div className="stat-card"><div className="stat-icon orange"><AlertTriangle size={18}/></div><div className="stat-label">Scheduling clashes</div><div className={`stat-value ${conflictPairCount ? 'warning-number' : ''}`}>{conflictPairCount}<span> overlaps</span></div><div className="stat-foot">{conflictPairCount ? <><span className="tiny-dot orange-dot"/> Needs your attention</> : <><span className="tiny-dot green-dot"/> All clear</>}</div></div>
          <div className="stat-card"><div className="stat-icon blue"><Clock3 size={18}/></div><div className="stat-label">Scheduled time</div><div className="stat-value">{slots.reduce((sum, s) => sum + duration(s), 0).toFixed(1)}<span> hrs</span></div><div className="stat-foot"><span className="tiny-dot blue-dot"/> Total weekly hours</div></div>
          <div className="stat-card"><div className="stat-icon green"><Cloud size={18}/></div><div className="stat-label">Data status</div><div className="stat-value status-value">{online ? 'Connected' : 'Offline'}</div><div className="stat-foot"><span className={`tiny-dot ${online ? 'green-dot' : 'orange-dot'}`}/>{syncState === 'synced' ? 'Everything synced' : online ? 'Local changes protected' : 'Saved on this device'}</div></div>
        </div>

        {notice && <div className="notice"><Check size={16}/>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
        {clashCount > 0 && <div className="conflict-banner"><div className="banner-icon"><AlertTriangle size={19}/></div><div><strong>Heads up — {conflictPairCount} scheduling overlap{conflictPairCount === 1 ? '' : 's'} detected</strong><p>Conflicting classes are outlined in red. Open a flagged class to edit its time or day.</p></div><button onClick={() => setSelectedDay('all')}>Review clashes <ArrowDownUp size={14}/></button></div>}

        <div className="section-heading"><div><h2>{view === 'week' ? 'Your weekly schedule' : 'All class slots'}</h2><p>{view === 'week' ? 'A clear view of what your week holds.' : 'Manage your classes and spot conflicts.'}</p></div><div className="view-controls"><div className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search classes…"/></div><select aria-label="Filter by day" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}><option value="all">All days</option>{DAYS.map((day, i) => <option value={i} key={day}>{day}</option>)}</select><div className="toggle-view"><button className={view === 'week' ? 'selected' : ''} onClick={() => setView('week')} title="Weekly grid"><CalendarDays size={16}/></button><button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')} title="List view"><BookOpen size={16}/></button></div></div></div>

        {view === 'week' ? <Timetable slots={filtered} conflicts={conflicts} onEdit={slot => { setEditing(slot); setShowForm(true) }} /> : <SlotList slots={filtered} conflicts={conflicts} onEdit={slot => { setEditing(slot); setShowForm(true) }} onDelete={removeSlot} />}
        <div className="bottom-note"><div><CircleHelp size={15}/><span><strong>How clash detection works</strong> — two classes clash when they share a day and each starts before the other ends.</span></div><span className="saved-label"><Check size={13}/> Saved locally</span></div>
        <footer><span>CLASHWISE <span className="footer-dot">·</span> BUILT FOR BETTER WEEKS</span><span>{lastSynced ? `Last synced ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline-ready timetable'}</span></footer>
      </section>
    </main>
    {showForm && <SlotModal slot={editing} slots={slots} onClose={() => { setShowForm(false); setEditing(null) }} onSave={persist} />}
  </div>
}

function Timetable({ slots, conflicts, onEdit }) {
  const hours = Array.from({ length: 11 }, (_, i) => i + 8)
  return <div className="timetable-wrap">
    <div className="grid-topline"><div className="timezone"><span className="tiny-dot purple-dot"/> LOCAL TIME <span>·</span> GMT +05:30</div><span className="grid-hint">Click any class to edit</span></div>
    <div className="timetable-scroll"><div className="timetable" style={{ '--day-count': 7 }}>
      <div className="time-head"></div>{DAYS.map((day, i) => <div className="day-head" key={day}><span>{day.slice(0, 3).toUpperCase()}</span><strong>{i + 1}</strong></div>)}
      <div className="time-column">{hours.map(hour => <div className="time-label" key={hour}>{fmt(`${String(hour).padStart(2, '0')}:00`)}</div>)}</div>
      <div className="grid-canvas">
        <div className="hour-lines">{hours.slice(0, -1).map(hour => <div className="hour-line" key={hour}></div>)}</div>
        <div className="day-columns">{DAYS.map((day, i) => <div className="day-column" key={day}><div className="half-lines">{hours.slice(0, -1).map(hour => <React.Fragment key={hour}><i/><i/></React.Fragment>)}</div></div>)}</div>
        {slots.map(slot => {
          const start = toMinutes(slot.start), end = toMinutes(slot.end)
          const top = ((start - 480) / 60) * 76
          const height = Math.max(((end - start) / 60) * 76 - 4, 28)
          const color = COLORS[slot.color] || COLORS.violet
          const clash = conflicts.has(slot.id)
          return <button key={slot.id} className={`class-block ${clash ? 'has-conflict' : ''}`} style={{ left: `calc(${slot.day * 100 / 7}% + 4px)`, width: 'calc(100% / 7 - 8px)', top: `${top}px`, height: `${height}px`, '--block-bg': color.bg, '--block-line': color.line, '--block-text': color.text }} onClick={() => onEdit(slot)} title={`${slot.subject}: ${fmt(slot.start)}–${fmt(slot.end)}${clash ? ' — scheduling clash' : ''}`}>
            {clash && <span className="block-warning"><AlertTriangle size={12}/></span>}<strong>{slot.subject}</strong><span>{fmt(slot.start)} – {fmt(slot.end)}</span>{height > 62 && slot.room && <em>{slot.room}</em>}
          </button>
        })}
        {slots.length === 0 && <div className="empty-grid"><CalendarDays size={25}/><strong>No classes match</strong><span>Try another filter or add a class slot.</span></div>}
      </div>
    </div></div>
    <div className="legend"><span className="legend-title">SUBJECT COLORS</span>{Object.entries(COLORS).map(([key, color]) => <span key={key}><i style={{ background: color.line }}/>{key[0].toUpperCase() + key.slice(1)}</span>)}<span className="legend-clash"><i/> Clash detected</span></div>
  </div>
}

function SlotList({ slots, conflicts, onEdit, onDelete }) {
  const sorted = [...slots].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
  if (!sorted.length) return <div className="empty-list"><CalendarDays size={28}/><strong>No class slots found</strong><span>Try clearing the search or add a class.</span></div>
  return <div className="slot-list">{sorted.map(slot => {
    const color = COLORS[slot.color] || COLORS.violet
    const clash = conflicts.has(slot.id)
    return <div className={`slot-row ${clash ? 'row-conflict' : ''}`} key={slot.id}><div className="subject-swatch" style={{ background: color.line }}/><div className="slot-main"><strong>{slot.subject}</strong><span>{DAYS[slot.day]} · {fmt(slot.start)} – {fmt(slot.end)}</span></div><div className="slot-room">{slot.room ? <><MapPin size={13}/>{slot.room}</> : '—'}</div>{clash && <span className="clash-pill"><AlertTriangle size={13}/> Clash</span>}<button className="icon-button" onClick={() => onEdit(slot)} aria-label={`Edit ${slot.subject}`}><Pencil size={15}/></button><button className="icon-button delete" onClick={() => onDelete(slot)} aria-label={`Delete ${slot.subject}`}><Trash2 size={15}/></button></div>
  })}</div>
}

function SlotModal({ slot, slots, onClose, onSave }) {
  const [subject, setSubject] = useState(slot?.subject || '')
  const [day, setDay] = useState(String(slot?.day ?? 0))
  const [start, setStart] = useState(slot?.start || '09:00')
  const [end, setEnd] = useState(slot?.end || '10:00')
  const [room, setRoom] = useState(slot?.room || '')
  const [color, setColor] = useState(slot?.color || 'violet')
  const [error, setError] = useState('')
  const preview = { id: slot?.id || 'preview', day: Number(day), start, end }
  const clashes = slots.filter(item => overlaps(preview, item))
  const invalidTime = start >= end

  function submit(e) {
    e.preventDefault()
    if (!subject.trim()) return setError('Enter a subject name.')
    if (invalidTime) return setError('End time must be later than start time.')
    onSave({ subject: subject.trim(), day: Number(day), start, end, room: room.trim(), color })
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div className="modal-head"><div><span className="modal-eyebrow">{slot ? 'EDIT YOUR SCHEDULE' : 'BUILD YOUR WEEK'}</span><h2 id="modal-title">{slot ? 'Edit class slot' : 'Add a class slot'}</h2><p>Keep the details right. Clashwise checks the rest.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
    <form onSubmit={submit}>
      <label className="field-label">Subject name<input autoFocus value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Data Structures" maxLength={80}/></label>
      <label className="field-label">Day<select value={day} onChange={e => setDay(e.target.value)}>{DAYS.map((name, i) => <option value={i} key={name}>{name}</option>)}</select></label>
      <div className="field-pair"><label className="field-label">Starts<input type="time" value={start} onChange={e => setStart(e.target.value)} required/></label><label className="field-label">Ends<input type="time" value={end} onChange={e => setEnd(e.target.value)} required/></label></div>
      <label className="field-label">Room / location <span className="optional">OPTIONAL</span><input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Lab 2 or B-204" maxLength={60}/></label>
      <div className="field-label">Subject color<div className="color-picker">{Object.entries(COLORS).map(([key, value]) => <button type="button" key={key} className={`color-choice ${color === key ? 'chosen' : ''}`} style={{ '--swatch': value.line, '--swatch-bg': value.bg }} onClick={() => setColor(key)} aria-label={`${key} color`} title={key}>{color === key && <Check size={16}/>}</button>)}</div></div>
      {invalidTime ? <div className="form-warning"><AlertTriangle size={16}/><span>End time must be later than start time.</span></div> : clashes.length > 0 ? <div className="form-warning"><AlertTriangle size={16}/><div><strong>{clashes.length} clash{clashes.length > 1 ? 'es' : ''} detected</strong><span>{clashes.map(item => `${item.subject} (${item.start}–${item.end})`).join(', ')}</span></div></div> : <div className="form-clear"><Check size={15}/> No clashes for this time slot</div>}
      {error && <div className="inline-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={16}/>{slot ? 'Save changes' : 'Save class slot'}</button></div>
    </form>
  </div></div>
}

export default App
