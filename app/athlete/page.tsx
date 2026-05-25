'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Tab = 'night' | 'morning' | 'journal' | 'semaine'
type CustomQuestion = { id: string; label: string }
type CustomQuestions = { morning: CustomQuestion[]; night: CustomQuestion[] }
type Entry = { id: string; type: string; data: any; created_at: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min = 1, max = 10, color = '#7b6af5', emoji }: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; color?: string; emoji?: string
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.7)', fontWeight: 500 }}>
          {emoji && <span style={{ marginRight: 6 }}>{emoji}</span>}{label}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color, lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(v => (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: 1, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer',
            background: v <= value ? color : 'rgba(255,255,255,0.08)', transition: 'background 0.15s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'rgba(240,240,245,0.25)' }}>{min}</span>
        <span style={{ fontSize: 10, color: 'rgba(240,240,245,0.25)' }}>{max}</span>
      </div>
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, emoji }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; emoji?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)', marginBottom: 8, fontWeight: 500 }}>
        {emoji && <span style={{ marginRight: 6 }}>{emoji}</span>}{label}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '12px 14px', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
    </div>
  )
}

function Chips({ label, options, selected, onToggle, color = '#7b6af5' }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; color?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)', marginBottom: 10, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => {
          const active = selected.includes(opt)
          return (
            <button key={opt} onClick={() => onToggle(opt)} style={{
              padding: '7px 14px', borderRadius: 20, border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
              background: active ? `${color}22` : 'transparent', color: active ? color : 'rgba(240,240,245,0.5)',
              fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
            }}>{opt}</button>
          )
        })}
      </div>
    </div>
  )
}

// ── Custom Questions Editor ───────────────────────────────────────────────────
function CustomQuestionsEditor({ questions, onSave, onClose, color }: {
  questions: CustomQuestion[]; onSave: (q: CustomQuestion[]) => void; onClose: () => void; color: string
}) {
  const [list, setList] = useState<CustomQuestion[]>(questions)
  const [newLabel, setNewLabel] = useState('')
  const add = () => {
    if (!newLabel.trim()) return
    setList(prev => [...prev, { id: Date.now().toString(), label: newLabel.trim() }])
    setNewLabel('')
  }
  return (
    <div style={{ background: '#1a1a26', border: `1px solid ${color}33`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color, fontWeight: 500 }}>✏️ Mes questions perso</div>
        <button onClick={onClose} style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Fermer</button>
      </div>
      {list.length === 0 && <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.3)', marginBottom: 12, fontStyle: 'italic' }}>Aucune question perso pour l'instant</div>}
      {list.map(q => (
        <div key={q.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input value={q.label} onChange={e => setList(prev => prev.map(x => x.id === q.id ? { ...x, label: e.target.value } : x))}
            style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '8px 12px', outline: 'none' }} />
          <button onClick={() => setList(prev => prev.filter(x => x.id !== q.id))} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nouvelle question..." onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: 1, background: '#0a0a0f', border: `1px solid ${color}44`, borderRadius: 8, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '8px 12px', outline: 'none' }} />
        <button onClick={add} style={{ padding: '8px 16px', borderRadius: 8, background: color, border: 'none', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>+ Ajouter</button>
      </div>
      <button onClick={() => onSave(list)} style={{ width: '100%', marginTop: 14, padding: '10px', background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 10, color, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
        ✓ Enregistrer mes questions
      </button>
    </div>
  )
}

// ── Week Calendar ─────────────────────────────────────────────────────────────
function WeekCalendar({ entries }: { entries: Entry[] }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const byDay: Record<string, Entry[]> = {}
  entries.forEach(e => {
    const d = new Date(e.created_at)
    const key = formatKey(d)
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(e)
  })

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
    setSelectedDay(null)
  }
  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
    setSelectedDay(null)
  }

  const today = new Date()
  const isCurrentWeek = sameDay(getMonday(today), weekStart)

  const weekLabel = () => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    return `${weekStart.getDate()} ${MONTHS_FR[weekStart.getMonth()]} — ${end.getDate()} ${MONTHS_FR[end.getMonth()]} ${end.getFullYear()}`
  }

  const typeConfig: Record<string, { emoji: string; color: string; label: string }> = {
    morning: { emoji: '☀️', color: '#f5a623', label: 'Morning' },
    night: { emoji: '🌙', color: '#7b6af5', label: 'Night' },
    journal: { emoji: '📓', color: '#3dd68c', label: 'Journal' },
  }

  const selectedEntries = selectedDay ? (byDay[selectedDay] || []) : []
  const selectedDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : null

  const renderValue = (k: string, v: any) => {
    if (k.startsWith('custom_')) return null
    if (typeof v === 'boolean') return v ? '✓ Oui' : '✗ Non'
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string' && v.trim()) return v
    return null
  }

  const keyLabel: Record<string, string> = {
    sleep_goal: '⏰ Objectif sommeil', sleep_quality: '💤 Qualité sommeil',
    sleep_hours: '⏰ Heures', stress: '⚡ Stress', energy: '🔋 Énergie',
    mood: '😊 Humeur', readiness: '⚡ Readiness', hydration: '💧 Hydratation',
    rituals: '🌅 Rituels', blockers: '🚧 Blocages', intentions: '🎯 Intentions',
    gratitude: '✨ Gratitude', focus: '🎯 Focus', body_notes: '🏃 Corps',
    notes: '📝 Notes', rpe: '🔥 RPE', performance: '📈 Performance',
    wod_result: '🏆 Résultat', movements: '🏋️ Mouvements',
    feelings: '💭 Ressenti', improvements: '🔧 À améliorer',
  }

  return (
    <div>
      {/* Header semaine */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={prevWeek} style={{ width: 36, height: 36, borderRadius: 10, background: '#12121a', border: '1px solid rgba(255,255,255,0.07)', color: '#f0f0f5', fontSize: 16, cursor: 'pointer' }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: '#f5a623' }}>
            {isCurrentWeek ? 'CETTE SEMAINE' : 'SEMAINE'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', marginTop: 2 }}>{weekLabel()}</div>
        </div>
        <button onClick={nextWeek} disabled={isCurrentWeek} style={{ width: 36, height: 36, borderRadius: 10, background: '#12121a', border: '1px solid rgba(255,255,255,0.07)', color: isCurrentWeek ? 'rgba(240,240,245,0.2)' : '#f0f0f5', fontSize: 16, cursor: isCurrentWeek ? 'default' : 'pointer' }}>›</button>
      </div>

      {/* Grille jours */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 20 }}>
        {days.map((day, i) => {
          const key = formatKey(day)
          const dayEntries = byDay[key] || []
          const isToday = sameDay(day, today)
          const isSelected = selectedDay === key
          const hasMorning = dayEntries.some(e => e.type === 'morning')
          const hasNight = dayEntries.some(e => e.type === 'night')
          const hasJournal = dayEntries.some(e => e.type === 'journal')
          const hasAny = hasMorning || hasNight || hasJournal

          return (
            <button key={key} onClick={() => setSelectedDay(isSelected ? null : key)}
              style={{
                background: isSelected ? '#1a1a26' : '#12121a',
                border: `1px solid ${isSelected ? '#f5a623' : isToday ? 'rgba(245,166,35,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 12, padding: '10px 4px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <div style={{ fontSize: 9, color: isToday ? '#f5a623' : 'rgba(240,240,245,0.35)', letterSpacing: 0.5, marginBottom: 4 }}>{DAYS_FR[i]}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: isToday ? '#f5a623' : '#f0f0f5', lineHeight: 1, marginBottom: 6 }}>{day.getDate()}</div>
              {hasAny ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  {hasMorning && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#f5a623' }} />}
                  {hasNight && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#7b6af5' }} />}
                  {hasJournal && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#3dd68c' }} />}
                </div>
              ) : (
                <div style={{ width: 6, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', margin: '0 auto' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
        {Object.entries(typeConfig).map(([type, cfg]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: cfg.color }} />
            <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)' }}>{cfg.emoji} {cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && selectedDate && (
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: '#f0f0f5', marginBottom: 16 }}>
            {DAYS_FULL[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]} {selectedDate.getDate()} {MONTHS_FR[selectedDate.getMonth()]}
          </div>

          {selectedEntries.length === 0 ? (
            <div style={{ background: '#12121a', borderRadius: 16, padding: 28, textAlign: 'center', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.35)' }}>Aucune entrée ce jour-là</div>
            </div>
          ) : (
            selectedEntries.map(entry => {
              const cfg = typeConfig[entry.type]
              const validData = Object.entries(entry.data).filter(([k, v]) => renderValue(k, v) !== null)
              return (
                <div key={entry.id} style={{ background: '#12121a', border: `1px solid ${cfg.color}33`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 20, background: `${cfg.color}18`, color: cfg.color, fontWeight: 500 }}>
                      {cfg.emoji} {cfg.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.3)' }}>
                      {new Date(entry.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {validData.slice(0, 6).map(([k, v]) => (
                      <div key={k} style={{ background: '#0a0a0f', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: 'rgba(240,240,245,0.3)', letterSpacing: 0.5, marginBottom: 3, textTransform: 'uppercase' }}>{keyLabel[k] || k}</div>
                        <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.8)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: typeof v === 'number' ? 'nowrap' : 'normal', maxHeight: typeof v === 'string' && v.length > 40 ? 36 : 'none' }}>
                          {typeof v === 'number' ? <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: cfg.color }}>{v}</span> : renderValue(k, v)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {validData.length > 6 && (
                    <div style={{ marginTop: 8 }}>
                      {validData.slice(6).map(([k, v]) => (
                        <div key={k} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: 10, color: 'rgba(240,240,245,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{keyLabel[k] || k} </span>
                          <span style={{ fontSize: 12, color: 'rgba(240,240,245,0.7)' }}>{renderValue(k, v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Night Routine ─────────────────────────────────────────────────────────────
function NightRoutine({ onSave, saving, customQuestions, onSaveCustomQuestions }: {
  onSave: (data: any) => void; saving: boolean
  customQuestions: CustomQuestion[]; onSaveCustomQuestions: (q: CustomQuestion[]) => void
}) {
  const [sleepGoal, setSleepGoal] = useState(7)
  const [stress, setStress] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [blockers, setBlockers] = useState<string[]>([])
  const [intentions, setIntentions] = useState('')
  const [gratitude, setGratitude] = useState('')
  const [notes, setNotes] = useState('')
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const blockerOpts = ['Stress', 'Écran', 'Caféine', 'Bruit', 'Repas tardif', 'Anxiété', 'Douleur', 'Chaleur']
  const handleSave = () => {
    const cd: Record<string, string> = {}
    customQuestions.forEach(q => { cd[`custom_${q.id}`] = customAnswers[q.id] || '' })
    onSave({ sleep_goal: sleepGoal, stress, energy, blockers: blockers.join(', '), intentions, gratitude, notes, ...cd })
  }
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌙</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#7b6af5' }}>ROUTINE NIGHT</div>
        <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.35)', marginTop: 4 }}>Prépare ton recovery</div>
      </div>
      <button onClick={() => setEditing(!editing)} style={{ display: 'block', marginLeft: 'auto', marginBottom: 20, padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(123,106,245,0.3)', background: 'rgba(123,106,245,0.08)', color: '#7b6af5', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 1, cursor: 'pointer' }}>⚙️ PERSONNALISER</button>
      {editing && <CustomQuestionsEditor questions={customQuestions} onSave={q => { onSaveCustomQuestions(q); setEditing(false) }} onClose={() => setEditing(false)} color='#7b6af5' />}
      <Slider label="Objectif sommeil (heures)" value={sleepGoal} onChange={setSleepGoal} min={5} max={10} color='#7b6af5' emoji="⏰" />
      <Slider label="Niveau de stress" value={stress} onChange={setStress} color='#f87171' emoji="⚡" />
      <Slider label="Énergie ressentie" value={energy} onChange={setEnergy} color='#3dd68c' emoji="🔋" />
      <Chips label="Potentiels blocages" options={blockerOpts} selected={blockers} onToggle={b => setBlockers(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])} color='#f87171' />
      <TextArea label="Intentions pour demain" value={intentions} onChange={setIntentions} placeholder="Ce que tu vas accomplir demain..." emoji="🎯" />
      <TextArea label="3 choses positives du jour" value={gratitude} onChange={setGratitude} placeholder="Ce pour quoi tu es reconnaissant..." emoji="✨" />
      <TextArea label="Notes libres" value={notes} onChange={setNotes} placeholder="Ressenti, observations..." emoji="📝" />
      {customQuestions.map(q => (
        <TextArea key={q.id} label={q.label} value={customAnswers[q.id] || ''} onChange={v => setCustomAnswers(prev => ({ ...prev, [q.id]: v }))} placeholder="Ta réponse..." emoji="💬" />
      ))}
      <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 16, background: '#7b6af5', border: 'none', borderRadius: 14, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER MA NUIT ✓'}
      </button>
    </div>
  )
}

// ── Morning Routine ───────────────────────────────────────────────────────────
function MorningRoutine({ onSave, saving, customQuestions, onSaveCustomQuestions }: {
  onSave: (data: any) => void; saving: boolean
  customQuestions: CustomQuestion[]; onSaveCustomQuestions: (q: CustomQuestion[]) => void
}) {
  const [sleepQuality, setSleepQuality] = useState(7)
  const [sleepHours, setSleepHours] = useState(7)
  const [mood, setMood] = useState(7)
  const [readiness, setReadiness] = useState(7)
  const [hydration, setHydration] = useState(false)
  const [rituals, setRituals] = useState<string[]>([])
  const [focus, setFocus] = useState('')
  const [bodyNotes, setBodyNotes] = useState('')
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const ritualOpts = ['Café', 'Cold shower', 'Méditation', 'Stretching', 'Lecture', 'Marche', 'Respiration', 'Visualisation']
  const handleSave = () => {
    const cd: Record<string, string> = {}
    customQuestions.forEach(q => { cd[`custom_${q.id}`] = customAnswers[q.id] || '' })
    onSave({ sleep_quality: sleepQuality, sleep_hours: sleepHours, mood, readiness, hydration, rituals: rituals.join(', '), focus, body_notes: bodyNotes, ...cd })
  }
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>☀️</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#f5a623' }}>ROUTINE MORNING</div>
        <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.35)', marginTop: 4 }}>Lance ta journée</div>
      </div>
      <button onClick={() => setEditing(!editing)} style={{ display: 'block', marginLeft: 'auto', marginBottom: 20, padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(245,166,35,0.3)', background: 'rgba(245,166,35,0.08)', color: '#f5a623', fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 1, cursor: 'pointer' }}>⚙️ PERSONNALISER</button>
      {editing && <CustomQuestionsEditor questions={customQuestions} onSave={q => { onSaveCustomQuestions(q); setEditing(false) }} onClose={() => setEditing(false)} color='#f5a623' />}
      <Slider label="Qualité du sommeil" value={sleepQuality} onChange={setSleepQuality} color='#7b6af5' emoji="💤" />
      <Slider label="Heures de sommeil" value={sleepHours} onChange={setSleepHours} min={4} max={12} color='#7b6af5' emoji="⏰" />
      <Slider label="Humeur au réveil" value={mood} onChange={setMood} color='#f5a623' emoji="😊" />
      <Slider label="Readiness (prêt à performer)" value={readiness} onChange={setReadiness} color='#3dd68c' emoji="⚡" />
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)', marginBottom: 10, fontWeight: 500 }}>💧 Hydratation au réveil</div>
        <button onClick={() => setHydration(!hydration)} style={{ padding: '10px 20px', borderRadius: 20, border: `1px solid ${hydration ? '#3dd68c' : 'rgba(255,255,255,0.1)'}`, background: hydration ? 'rgba(61,214,140,0.15)' : 'transparent', color: hydration ? '#3dd68c' : 'rgba(240,240,245,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          {hydration ? '✓ Fait' : 'Pas encore'}
        </button>
      </div>
      <Chips label="Rituels du matin" options={ritualOpts} selected={rituals} onToggle={r => setRituals(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])} color='#f5a623' />
      <TextArea label="Focus du jour" value={focus} onChange={setFocus} placeholder="L'intention principale pour aujourd'hui..." emoji="🎯" />
      <TextArea label="Ressenti corporel" value={bodyNotes} onChange={setBodyNotes} placeholder="Courbatures, douleurs, sensations..." emoji="🏃" />
      {customQuestions.map(q => (
        <TextArea key={q.id} label={q.label} value={customAnswers[q.id] || ''} onChange={v => setCustomAnswers(prev => ({ ...prev, [q.id]: v }))} placeholder="Ta réponse..." emoji="💬" />
      ))}
      <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 16, background: '#f5a623', border: 'none', borderRadius: 14, color: '#0a0a0f', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER MON MATIN ✓'}
      </button>
    </div>
  )
}

// ── Journal ───────────────────────────────────────────────────────────────────
function Journal({ onSave, saving }: { onSave: (data: any) => void; saving: boolean }) {
  const [rpe, setRpe] = useState(7)
  const [performance, setPerformance] = useState(7)
  const [movements, setMovements] = useState<string[]>([])
  const [wodResult, setWodResult] = useState('')
  const [feelings, setFeelings] = useState('')
  const [improvements, setImprovements] = useState('')
  const [notes, setNotes] = useState('')
  const movementOpts = ['Snatch', 'Clean & Jerk', 'Pull-up', 'Muscle-up', 'HSPU', 'Deadlift', 'Back Squat', 'Front Squat', 'Thruster', 'Box Jump', 'Double Under', 'Row', 'Bike', 'Ski Erg', 'Run', 'Burpee', 'KB Swing', 'Wall Ball']
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>📓</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: '#3dd68c' }}>JOURNAL WOD</div>
        <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.35)', marginTop: 4 }}>Analyse ta séance</div>
      </div>
      <Slider label="RPE (effort perçu)" value={rpe} onChange={setRpe} color='#f87171' emoji="🔥" />
      <Slider label="Performance ressentie" value={performance} onChange={setPerformance} color='#3dd68c' emoji="📈" />
      <TextArea label="Résultat du WOD" value={wodResult} onChange={setWodResult} placeholder="Temps, rounds, charges, scores..." emoji="🏆" />
      <Chips label="Mouvements travaillés" options={movementOpts} selected={movements} onToggle={m => setMovements(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])} color='#3dd68c' />
      <TextArea label="Ressenti pendant la séance" value={feelings} onChange={setFeelings} placeholder="Énergie, cardio, force, mental..." emoji="💭" />
      <TextArea label="Points à améliorer" value={improvements} onChange={setImprovements} placeholder="Technique, stratégie, mental..." emoji="🔧" />
      <TextArea label="Notes libres" value={notes} onChange={setNotes} placeholder="Observations, PR, contexte..." emoji="📝" />
      <button onClick={() => onSave({ rpe, performance, wod_result: wodResult, movements: movements.join(', '), feelings, improvements, notes })} disabled={saving}
        style={{ width: '100%', padding: 16, background: '#3dd68c', border: 'none', borderRadius: 14, color: '#0a0a0f', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER MA SÉANCE ✓'}
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
function AthleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>('morning')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestions>({ morning: [], night: [] })
  const [allEntries, setAllEntries] = useState<Entry[]>([])
  const supabase = createClient()

  useEffect(() => {
    const paramTab = searchParams.get('tab') as Tab | null
    if (paramTab && ['night', 'morning', 'journal', 'semaine'].includes(paramTab)) setTab(paramTab)

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/auth'); return }
      if (user.email === process.env.NEXT_PUBLIC_COACH_EMAIL) { router.replace('/coach'); return }
      setUserName(user.user_metadata?.full_name?.split(' ')[0] || 'Athlète')
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('custom_questions').eq('id', user.id).single()
      if (profile?.custom_questions) setCustomQuestions(profile.custom_questions)

      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 60)
      const { data: entries } = await supabase.from('entries').select('*').eq('user_id', user.id).gte('created_at', monthAgo.toISOString()).order('created_at', { ascending: false })
      if (entries) setAllEntries(entries)
    })
  }, [])

  const saveCustomQuestions = useCallback(async (routine: 'morning' | 'night', questions: CustomQuestion[]) => {
    if (!userId) return
    const updated = { ...customQuestions, [routine]: questions }
    setCustomQuestions(updated)
    await supabase.from('profiles').update({ custom_questions: updated }).eq('id', userId)
  }, [userId, customQuestions])

  const handleSave = useCallback(async (data: any) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }
    const newEntry = { user_id: user.id, type: tab, data, created_at: new Date().toISOString(), id: Date.now().toString() }
    await supabase.from('entries').insert({ user_id: user.id, type: tab, data })
    setAllEntries(prev => [newEntry as Entry, ...prev])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }, [tab])

  const tabs = [
    { id: 'morning' as Tab, emoji: '☀️', label: 'Morning', color: '#f5a623' },
    { id: 'night' as Tab, emoji: '🌙', label: 'Night', color: '#7b6af5' },
    { id: 'journal' as Tab, emoji: '📓', label: 'Journal', color: '#3dd68c' },
    { id: 'semaine' as Tab, emoji: '📅', label: 'Semaine', color: '#f0f0f5' },
  ]
  const activeColor = tabs.find(t => t.id === tab)?.color || '#7b6af5'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: 'fixed', inset: 0, background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${activeColor}14, transparent 60%)`, pointerEvents: 'none', zIndex: 0, transition: 'background 0.4s' }} />

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: tab === 'semaine' ? '#f5a623' : activeColor, transition: 'color 0.3s' }}>ATHLETE</div>
        <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.4)' }}>
          {userName && <span>Salut <span style={{ color: '#f0f0f5', fontWeight: 500 }}>{userName}</span> 👋</span>}
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.replace('/auth') }} style={{ fontSize: 11, color: 'rgba(240,240,245,0.3)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 0.5 }}>QUITTER</button>
      </nav>

      <div style={{ position: 'fixed', top: 56, left: 0, right: 0, zIndex: 99, background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px', display: 'flex', gap: 6 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 0', borderRadius: 10, border: `1px solid ${tab === t.id ? t.color : 'rgba(255,255,255,0.07)'}`,
            background: tab === t.id ? `${t.color}18` : '#12121a', color: tab === t.id ? t.color : 'rgba(240,240,245,0.45)',
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <div>{t.emoji}</div>
            <div style={{ marginTop: 2 }}>{t.label}</div>
          </button>
        ))}
      </div>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto', padding: '130px 20px 60px' }}>
        {saved && (
          <div style={{ background: 'rgba(61,214,140,0.12)', border: '1px solid rgba(61,214,140,0.3)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#3dd68c', marginBottom: 20, textAlign: 'center', fontWeight: 500 }}>
            ✓ Entrée enregistrée avec succès !
          </div>
        )}
        {tab === 'morning' && <MorningRoutine onSave={handleSave} saving={saving} customQuestions={customQuestions.morning} onSaveCustomQuestions={q => saveCustomQuestions('morning', q)} />}
        {tab === 'night' && <NightRoutine onSave={handleSave} saving={saving} customQuestions={customQuestions.night} onSaveCustomQuestions={q => saveCustomQuestions('night', q)} />}
        {tab === 'journal' && <Journal onSave={handleSave} saving={saving} />}
        {tab === 'semaine' && <WeekCalendar entries={allEntries} />}
      </main>
    </div>
  )
}

export default function AthletePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 4, color: '#7b6af5' }}>CHARGEMENT...</div>
      </div>
    }>
      <AthleteContent />
    </Suspense>
  )
}
