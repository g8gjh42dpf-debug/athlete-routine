'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Tab = 'night' | 'morning' | 'journal' | 'semaine' | 'stats' | 'profil'
type CustomQuestion = { id: string; label: string }
type CustomQuestions = { morning: CustomQuestion[]; night: CustomQuestion[] }
type Entry = { id: string; type: string; data: any; created_at: string }

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff); date.setHours(0, 0, 0, 0)
  return date
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function formatKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min=1, max=10, color='#7b6af5', emoji }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; color?: string; emoji?: string
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.7)', fontWeight: 500 }}>{emoji && <span style={{ marginRight: 6 }}>{emoji}</span>}{label}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color, lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: max-min+1 }, (_,i) => i+min).map(v => (
          <button key={v} onClick={() => onChange(v)} style={{ flex:1, height:6, borderRadius:3, border:'none', cursor:'pointer', background: v<=value ? color : 'rgba(255,255,255,0.08)', transition:'background 0.15s' }} />
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        <span style={{ fontSize:10, color:'rgba(240,240,245,0.25)' }}>{min}</span>
        <span style={{ fontSize:10, color:'rgba(240,240,245,0.25)' }}>{max}</span>
      </div>
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, emoji }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; emoji?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(240,240,245,0.4)', marginBottom:8, fontWeight:500 }}>
        {emoji && <span style={{ marginRight:6 }}>{emoji}</span>}{label}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width:'100%', background:'#1a1a26', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, color:'#f0f0f5', fontFamily:"'DM Sans', sans-serif", fontSize:14, padding:'12px 14px', outline:'none', resize:'none', boxSizing:'border-box', lineHeight:1.6 }} />
    </div>
  )
}

function Chips({ label, options, selected, onToggle, color='#7b6af5' }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; color?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(240,240,245,0.4)', marginBottom:10, fontWeight:500 }}>{label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {options.map(opt => {
          const active = selected.includes(opt)
          return <button key={opt} onClick={() => onToggle(opt)} style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`, background: active ? `${color}22` : 'transparent', color: active ? color : 'rgba(240,240,245,0.5)', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans', sans-serif", transition:'all 0.15s' }}>{opt}</button>
        })}
      </div>
    </div>
  )
}

// ── Line Chart SVG ────────────────────────────────────────────────────────────
function LineChart({ points, color, min=1, max=10 }: { points: { x: number; y: number; label: string }[]; color: string; min?: number; max?: number }) {
  const W = 320; const H = 120; const PAD = { t:10, r:10, b:24, l:28 }
  const cw = W - PAD.l - PAD.r; const ch = H - PAD.t - PAD.b
  if (points.length < 2) return <div style={{ height:H, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(240,240,245,0.2)', fontSize:12 }}>Pas assez de données</div>

  const toX = (i: number) => PAD.l + (i / (points.length - 1)) * cw
  const toY = (v: number) => PAD.t + ch - ((v - min) / (max - min)) * ch

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.y)}`).join(' ')
  const areaD = `${pathD} L ${toX(points.length-1)} ${PAD.t+ch} L ${toX(0)} ${PAD.t+ch} Z`

  const gridVals = [min, Math.round((min+max)/2), max]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', overflow:'visible' }}>
      <defs>
        <linearGradient id={`g${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {gridVals.map(v => (
        <g key={v}>
          <line x1={PAD.l} y1={toY(v)} x2={PAD.l+cw} y2={toY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={PAD.l-4} y={toY(v)+4} textAnchor="end" fill="rgba(240,240,245,0.25)" fontSize="8">{v}</text>
        </g>
      ))}
      <path d={areaD} fill={`url(#g${color.replace('#','')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(p.y)} r="3" fill={color} />
          {i === points.length-1 && (
            <text x={toX(i)} y={toY(p.y)-8} textAnchor="middle" fill={color} fontSize="9" fontWeight="bold">{p.y}</text>
          )}
        </g>
      ))}
      {points.length <= 14 && points.map((p, i) => (
        i % Math.ceil(points.length/7) === 0 &&
        <text key={`l${i}`} x={toX(i)} y={H-4} textAnchor="middle" fill="rgba(240,240,245,0.25)" fontSize="8">{p.label}</text>
      ))}
    </svg>
  )
}

// ── Stats / Graphiques ────────────────────────────────────────────────────────
type MetricCfg = { key: string; label: string; emoji: string; color: string; source: 'morning'|'night'|'journal'; min: number; max: number }

const METRICS: MetricCfg[] = [
  { key:'sleep_quality', label:'Qualité sommeil', emoji:'💤', color:'#7b6af5', source:'morning', min:1, max:10 },
  { key:'sleep_hours',   label:'Heures sommeil',  emoji:'⏰', color:'#a78bfa', source:'morning', min:4, max:12 },
  { key:'mood',          label:'Humeur',           emoji:'😊', color:'#f5a623', source:'morning', min:1, max:10 },
  { key:'readiness',     label:'Readiness',        emoji:'⚡', color:'#3dd68c', source:'morning', min:1, max:10 },
  { key:'stress',        label:'Stress',           emoji:'⚡', color:'#f87171', source:'night',   min:1, max:10 },
  { key:'energy',        label:'Énergie soir',     emoji:'🔋', color:'#34d399', source:'night',   min:1, max:10 },
  { key:'rpe',           label:'RPE séance',       emoji:'🔥', color:'#fb923c', source:'journal', min:1, max:10 },
  { key:'performance',   label:'Performance',      emoji:'📈', color:'#3dd68c', source:'journal', min:1, max:10 },
]

function StatsView({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string>('sleep_quality')
  const [period, setPeriod] = useState<7|14|28>(28)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-60)
    supabase.from('entries').select('*').eq('user_id', userId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setEntries(data); setLoading(false) })
  }, [userId])

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'rgba(240,240,245,0.3)', fontSize:13 }}>Chargement...</div>
  const metric = METRICS.find(m => m.key === selected)!

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - period)

  const filtered = entries
    .filter(e => e.type === metric.source && new Date(e.created_at) >= cutoff && typeof e.data[metric.key] === 'number')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const points = filtered.map(e => {
    const d = new Date(e.created_at)
    return { x: d.getTime(), y: e.data[metric.key], label: `${d.getDate()}/${d.getMonth()+1}` }
  })

  const avg = points.length ? (points.reduce((s,p) => s+p.y, 0) / points.length).toFixed(1) : null
  const trend = points.length >= 3 ? (() => {
    const recent = points.slice(-3).reduce((s,p) => s+p.y, 0) / 3
    const older = points.slice(0, Math.max(1, points.length-3)).reduce((s,p) => s+p.y, 0) / Math.max(1, points.length-3)
    return recent - older
  })() : null

  return (
    <div>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, letterSpacing:3, color:'#f5a623' }}>ÉVOLUTION</div>
        <div style={{ fontSize:12, color:'rgba(240,240,245,0.35)', marginTop:4 }}>Tes tendances sur la durée</div>
      </div>

      {/* Sélecteur période */}
      <div style={{ display:'flex', gap:6, marginBottom:20, background:'#12121a', borderRadius:12, padding:4 }}>
        {([7,14,28] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ flex:1, padding:'8px 0', borderRadius:9, border:'none', background: period===p ? '#f5a623' : 'transparent', color: period===p ? '#0a0a0f' : 'rgba(240,240,245,0.4)', fontFamily:"'DM Sans', sans-serif", fontSize:12, fontWeight:500, cursor:'pointer' }}>
            {p}j
          </button>
        ))}
      </div>

      {/* Sélecteur métrique */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:20 }}>
        {METRICS.map(m => (
          <button key={m.key} onClick={() => setSelected(m.key)} style={{
            padding:'6px 12px', borderRadius:20, border:`1px solid ${selected===m.key ? m.color : 'rgba(255,255,255,0.08)'}`,
            background: selected===m.key ? `${m.color}22` : '#12121a', color: selected===m.key ? m.color : 'rgba(240,240,245,0.45)',
            fontFamily:"'DM Sans', sans-serif", fontSize:11, cursor:'pointer', transition:'all 0.15s',
          }}>
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      {/* Carte graphique */}
      <div style={{ background:'#12121a', border:`1px solid ${metric.color}33`, borderRadius:16, padding:20, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:'rgba(240,240,245,0.4)', letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>{metric.emoji} {metric.label}</div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:42, color: metric.color, lineHeight:1 }}>
              {avg ?? '—'}
            </div>
            <div style={{ fontSize:10, color:'rgba(240,240,245,0.3)', marginTop:2 }}>moyenne {period}j</div>
          </div>
          {trend !== null && (
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:20 }}>{trend > 0.3 ? '📈' : trend < -0.3 ? '📉' : '➡️'}</div>
              <div style={{ fontSize:11, color: trend > 0.3 ? '#3dd68c' : trend < -0.3 ? '#f87171' : 'rgba(240,240,245,0.4)', marginTop:2 }}>
                {trend > 0.3 ? '+' : ''}{trend.toFixed(1)} tendance
              </div>
            </div>
          )}
        </div>
        <LineChart points={points} color={metric.color} min={metric.min} max={metric.max} />
      </div>

      {/* Mini stats */}
      {points.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { label:'Min', val: Math.min(...points.map(p=>p.y)) },
            { label:'Moy', val: parseFloat(avg!) },
            { label:'Max', val: Math.max(...points.map(p=>p.y)) },
          ].map(s => (
            <div key={s.label} style={{ background:'#12121a', borderRadius:12, padding:'12px 10px', textAlign:'center', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color: metric.color, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:10, color:'rgba(240,240,245,0.35)', letterSpacing:1, textTransform:'uppercase', marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {points.length === 0 && (
        <div style={{ background:'#12121a', borderRadius:16, padding:32, textAlign:'center', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📊</div>
          <div style={{ fontSize:13, color:'rgba(240,240,245,0.35)' }}>Remplis quelques routines pour voir tes graphiques</div>
        </div>
      )}
    </div>
  )
}

// ── Week Calendar ─────────────────────────────────────────────────────────────
function WeekCalendar({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-60)
    supabase.from('entries').select('*').eq('user_id', userId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setEntries(data); setLoading(false) })
  }, [userId])

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'rgba(240,240,245,0.3)', fontSize:13 }}>Chargement...</div>
  const days = Array.from({ length:7 }, (_,i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); return d })
  const byDay: Record<string, Entry[]> = {}
  entries.forEach(e => { const key = formatKey(new Date(e.created_at)); if (!byDay[key]) byDay[key]=[]; byDay[key].push(e) })

  const today = new Date()
  const isCurrentWeek = sameDay(getMonday(today), weekStart)
  const weekLabel = () => { const end = new Date(weekStart); end.setDate(end.getDate()+6); return `${weekStart.getDate()} ${MONTHS_FR[weekStart.getMonth()]} — ${end.getDate()} ${MONTHS_FR[end.getMonth()]} ${end.getFullYear()}` }

  const typeConfig: Record<string, { emoji: string; color: string; label: string }> = {
    morning: { emoji:'☀️', color:'#f5a623', label:'Morning' },
    night:   { emoji:'🌙', color:'#7b6af5', label:'Night' },
    journal: { emoji:'📓', color:'#3dd68c', label:'Journal' },
  }

  const keyLabel: Record<string, string> = {
    sleep_goal:'⏰ Objectif sommeil', sleep_quality:'💤 Qualité sommeil', sleep_hours:'⏰ Heures', stress:'⚡ Stress',
    energy:'🔋 Énergie', mood:'😊 Humeur', readiness:'⚡ Readiness', hydration:'💧 Hydratation',
    rituals:'🌅 Rituels', blockers:'🚧 Blocages', intentions:'🎯 Intentions', gratitude:'✨ Gratitude',
    focus:'🎯 Focus', body_notes:'🏃 Corps', notes:'📝 Notes', rpe:'🔥 RPE', performance:'📈 Performance',
    feelings:'💭 Ressenti', improvements:'🔧 À améliorer',
  }

  const renderValue = (k: string, v: any) => {
    if (k.startsWith('custom_')) return null
    if (typeof v === 'boolean') return v ? '✓ Oui' : '✗ Non'
    if (typeof v === 'number') return String(v)
    if (typeof v === 'string' && v.trim()) return v
    return null
  }

  const selectedEntries = selectedDay ? (byDay[selectedDay] || []) : []
  const selectedDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : null

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <button onClick={() => { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); setSelectedDay(null) }} style={{ width:36, height:36, borderRadius:10, background:'#12121a', border:'1px solid rgba(255,255,255,0.07)', color:'#f0f0f5', fontSize:16, cursor:'pointer' }}>‹</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:14, letterSpacing:2, color:'#f5a623' }}>{isCurrentWeek ? 'CETTE SEMAINE' : 'SEMAINE'}</div>
          <div style={{ fontSize:11, color:'rgba(240,240,245,0.4)', marginTop:2 }}>{weekLabel()}</div>
        </div>
        <button onClick={() => { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); setSelectedDay(null) }} disabled={isCurrentWeek} style={{ width:36, height:36, borderRadius:10, background:'#12121a', border:'1px solid rgba(255,255,255,0.07)', color: isCurrentWeek ? 'rgba(240,240,245,0.2)' : '#f0f0f5', fontSize:16, cursor: isCurrentWeek ? 'default':'pointer' }}>›</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6, marginBottom:20 }}>
        {days.map((day, i) => {
          const key = formatKey(day)
          const dayEntries = byDay[key] || []
          const isToday = sameDay(day, today)
          const isSelected = selectedDay === key
          const hasMorning = dayEntries.some(e => e.type==='morning')
          const hasNight = dayEntries.some(e => e.type==='night')
          const hasJournal = dayEntries.some(e => e.type==='journal')
          return (
            <button key={key} onClick={() => setSelectedDay(isSelected ? null : key)} style={{ background: isSelected ? '#1a1a26' : '#12121a', border:`1px solid ${isSelected ? '#f5a623' : isToday ? 'rgba(245,166,35,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius:12, padding:'10px 4px', cursor:'pointer', transition:'all 0.2s' }}>
              <div style={{ fontSize:9, color: isToday ? '#f5a623' : 'rgba(240,240,245,0.35)', letterSpacing:0.5, marginBottom:4 }}>{DAYS_FR[i]}</div>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, color: isToday ? '#f5a623' : '#f0f0f5', lineHeight:1, marginBottom:6 }}>{day.getDate()}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center' }}>
                {hasMorning && <div style={{ width:6, height:6, borderRadius:3, background:'#f5a623' }} />}
                {hasNight   && <div style={{ width:6, height:6, borderRadius:3, background:'#7b6af5' }} />}
                {hasJournal && <div style={{ width:6, height:6, borderRadius:3, background:'#3dd68c' }} />}
                {!hasMorning && !hasNight && !hasJournal && <div style={{ width:6, height:6, borderRadius:3, background:'rgba(255,255,255,0.08)' }} />}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:16, justifyContent:'center', marginBottom:24 }}>
        {Object.entries(typeConfig).map(([type, cfg]) => (
          <div key={type} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:3, background:cfg.color }} />
            <span style={{ fontSize:11, color:'rgba(240,240,245,0.4)' }}>{cfg.emoji} {cfg.label}</span>
          </div>
        ))}
      </div>

      {selectedDay && selectedDate && (
        <div>
          <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:20, letterSpacing:2, color:'#f0f0f5', marginBottom:16 }}>
            {DAYS_FULL[selectedDate.getDay()===0 ? 6 : selectedDate.getDay()-1]} {selectedDate.getDate()} {MONTHS_FR[selectedDate.getMonth()]}
          </div>
          {selectedEntries.length === 0 ? (
            <div style={{ background:'#12121a', borderRadius:16, padding:28, textAlign:'center', border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
              <div style={{ fontSize:13, color:'rgba(240,240,245,0.35)' }}>Aucune entrée ce jour-là</div>
            </div>
          ) : selectedEntries.map(entry => {
            const cfg = typeConfig[entry.type]
            const validData = Object.entries(entry.data).filter(([k,v]) => renderValue(k,v) !== null)
            return (
              <div key={entry.id} style={{ background:'#12121a', border:`1px solid ${cfg.color}33`, borderRadius:16, padding:20, marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <span style={{ fontSize:13, padding:'4px 12px', borderRadius:20, background:`${cfg.color}18`, color:cfg.color, fontWeight:500 }}>{cfg.emoji} {cfg.label}</span>
                  <span style={{ fontSize:11, color:'rgba(240,240,245,0.3)' }}>{new Date(entry.created_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {validData.slice(0,6).map(([k,v]) => (
                    <div key={k} style={{ background:'#0a0a0f', borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'rgba(240,240,245,0.3)', letterSpacing:0.5, marginBottom:3, textTransform:'uppercase' }}>{keyLabel[k]||k}</div>
                      <div style={{ fontSize:12, color:'rgba(240,240,245,0.8)', lineHeight:1.4 }}>
                        {typeof v==='number' ? <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:20, color:cfg.color }}>{v}</span> : renderValue(k,v)}
                      </div>
                    </div>
                  ))}
                </div>
                {validData.length > 6 && validData.slice(6).map(([k,v]) => (
                  <div key={k} style={{ padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize:10, color:'rgba(240,240,245,0.3)', textTransform:'uppercase', letterSpacing:0.5 }}>{keyLabel[k]||k} </span>
                    <span style={{ fontSize:12, color:'rgba(240,240,245,0.7)' }}>{renderValue(k,v)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Custom Questions Editor ───────────────────────────────────────────────────
function CustomQuestionsEditor({ questions, onSave, onClose, color }: {
  questions: CustomQuestion[]; onSave: (q: CustomQuestion[]) => void; onClose: () => void; color: string
}) {
  const [list, setList] = useState<CustomQuestion[]>(questions)
  const [newLabel, setNewLabel] = useState('')
  const add = () => { if (!newLabel.trim()) return; setList(prev => [...prev, { id: Date.now().toString(), label: newLabel.trim() }]); setNewLabel('') }
  return (
    <div style={{ background:'#1a1a26', border:`1px solid ${color}33`, borderRadius:16, padding:20, marginBottom:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:12, letterSpacing:1.5, textTransform:'uppercase', color, fontWeight:500 }}>✏️ Mes questions perso</div>
        <button onClick={onClose} style={{ fontSize:11, color:'rgba(240,240,245,0.4)', background:'none', border:'none', cursor:'pointer' }}>✕ Fermer</button>
      </div>
      {list.length===0 && <div style={{ fontSize:13, color:'rgba(240,240,245,0.3)', marginBottom:12, fontStyle:'italic' }}>Aucune question perso pour l'instant</div>}
      {list.map(q => (
        <div key={q.id} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
          <input value={q.label} onChange={e => setList(prev => prev.map(x => x.id===q.id ? {...x, label:e.target.value} : x))}
            style={{ flex:1, background:'#0a0a0f', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, color:'#f0f0f5', fontFamily:"'DM Sans', sans-serif", fontSize:13, padding:'8px 12px', outline:'none' }} />
          <button onClick={() => setList(prev => prev.filter(x => x.id!==q.id))} style={{ width:32, height:32, borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', cursor:'pointer', fontSize:14, flexShrink:0 }}>×</button>
        </div>
      ))}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nouvelle question..." onKeyDown={e => e.key==='Enter' && add()}
          style={{ flex:1, background:'#0a0a0f', border:`1px solid ${color}44`, borderRadius:8, color:'#f0f0f5', fontFamily:"'DM Sans', sans-serif", fontSize:13, padding:'8px 12px', outline:'none' }} />
        <button onClick={add} style={{ padding:'8px 16px', borderRadius:8, background:color, border:'none', color:'#fff', fontFamily:"'DM Sans', sans-serif", fontSize:13, cursor:'pointer', fontWeight:500 }}>+ Ajouter</button>
      </div>
      <button onClick={() => onSave(list)} style={{ width:'100%', marginTop:14, padding:'10px', background:`${color}22`, border:`1px solid ${color}44`, borderRadius:10, color, fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:500, cursor:'pointer' }}>✓ Enregistrer mes questions</button>
    </div>
  )
}

// ── Night Routine ─────────────────────────────────────────────────────────────
function NightRoutine({ onSave, saving, onSaved, customQuestions, onSaveCustomQuestions }: {
  onSave: (data: any) => void; saving: boolean; onSaved: boolean; customQuestions: CustomQuestion[]; onSaveCustomQuestions: (q: CustomQuestion[]) => void
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
  const blockerOpts = ['Stress','Écran','Caféine','Bruit','Repas tardif','Anxiété','Douleur','Chaleur']
  const handleSave = () => {
    const cd: Record<string,string> = {}
    customQuestions.forEach(q => { cd[`custom_${q.id}`] = customAnswers[q.id] || '' })
    onSave({ sleep_goal:sleepGoal, stress, energy, blockers:blockers.join(', '), intentions, gratitude, notes, ...cd })
  }
  return (
    <div>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🌙</div>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, letterSpacing:3, color:'#7b6af5' }}>ROUTINE NIGHT</div>
        <div style={{ fontSize:12, color:'rgba(240,240,245,0.35)', marginTop:4 }}>Prépare ton recovery</div>
      </div>
      <button onClick={() => setEditing(!editing)} style={{ display:'block', marginLeft:'auto', marginBottom:20, padding:'6px 14px', borderRadius:20, border:'1px solid rgba(123,106,245,0.3)', background:'rgba(123,106,245,0.08)', color:'#7b6af5', fontFamily:"'DM Sans', sans-serif", fontSize:11, letterSpacing:1, cursor:'pointer' }}>⚙️ PERSONNALISER</button>
      {editing && <CustomQuestionsEditor questions={customQuestions} onSave={q => { onSaveCustomQuestions(q); setEditing(false) }} onClose={() => setEditing(false)} color='#7b6af5' />}
      <Slider label="Objectif sommeil (heures)" value={sleepGoal} onChange={setSleepGoal} min={5} max={10} color='#7b6af5' emoji="⏰" />
      <Slider label="Niveau de stress" value={stress} onChange={setStress} color='#f87171' emoji="⚡" />
      <Slider label="Énergie ressentie" value={energy} onChange={setEnergy} color='#3dd68c' emoji="🔋" />
      <Chips label="Potentiels blocages" options={blockerOpts} selected={blockers} onToggle={b => setBlockers(prev => prev.includes(b) ? prev.filter(x=>x!==b) : [...prev,b])} color='#f87171' />
      <TextArea label="Intentions pour demain" value={intentions} onChange={setIntentions} placeholder="Ce que tu vas accomplir demain..." emoji="🎯" />
      <TextArea label="3 choses positives du jour" value={gratitude} onChange={setGratitude} placeholder="Ce pour quoi tu es reconnaissant..." emoji="✨" />
      <TextArea label="Notes libres" value={notes} onChange={setNotes} placeholder="Ressenti, observations..." emoji="📝" />
      {customQuestions.map(q => <TextArea key={q.id} label={q.label} value={customAnswers[q.id]||''} onChange={v => setCustomAnswers(prev=>({...prev,[q.id]:v}))} placeholder="Ta réponse..." emoji="💬" />)}
      <button onClick={handleSave} disabled={saving} style={{ width:'100%', padding:16, background:'#7b6af5', border:'none', borderRadius:14, color:'#fff', fontFamily:"'Bebas Neue', sans-serif", fontSize:18, letterSpacing:2, cursor:'pointer', opacity:saving?0.7:1 }}>
        {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER MA NUIT ✓'}
      </button>
      {onSaved && <div style={{ marginTop:12, padding:'10px 16px', background:'rgba(123,106,245,0.12)', border:'1px solid rgba(123,106,245,0.3)', borderRadius:10, textAlign:'center', fontSize:13, color:'#7b6af5', fontWeight:500 }}>✓ Routine Night enregistrée !</div>}
    </div>
  )
}

// ── Morning Routine ───────────────────────────────────────────────────────────
function MorningRoutine({ onSave, saving, onSaved, customQuestions, onSaveCustomQuestions }: {
  onSave: (data: any) => void; saving: boolean; onSaved: boolean; customQuestions: CustomQuestion[]; onSaveCustomQuestions: (q: CustomQuestion[]) => void
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
  const ritualOpts = ['Café','Cold shower','Méditation','Stretching','Lecture','Marche','Respiration','Visualisation']
  const handleSave = () => {
    const cd: Record<string,string> = {}
    customQuestions.forEach(q => { cd[`custom_${q.id}`] = customAnswers[q.id] || '' })
    onSave({ sleep_quality:sleepQuality, sleep_hours:sleepHours, mood, readiness, hydration, rituals:rituals.join(', '), focus, body_notes:bodyNotes, ...cd })
  }
  return (
    <div>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ fontSize:48, marginBottom:8 }}>☀️</div>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, letterSpacing:3, color:'#f5a623' }}>ROUTINE MORNING</div>
        <div style={{ fontSize:12, color:'rgba(240,240,245,0.35)', marginTop:4 }}>Lance ta journée</div>
      </div>
      <button onClick={() => setEditing(!editing)} style={{ display:'block', marginLeft:'auto', marginBottom:20, padding:'6px 14px', borderRadius:20, border:'1px solid rgba(245,166,35,0.3)', background:'rgba(245,166,35,0.08)', color:'#f5a623', fontFamily:"'DM Sans', sans-serif", fontSize:11, letterSpacing:1, cursor:'pointer' }}>⚙️ PERSONNALISER</button>
      {editing && <CustomQuestionsEditor questions={customQuestions} onSave={q => { onSaveCustomQuestions(q); setEditing(false) }} onClose={() => setEditing(false)} color='#f5a623' />}
      <Slider label="Qualité du sommeil" value={sleepQuality} onChange={setSleepQuality} color='#7b6af5' emoji="💤" />
      <Slider label="Heures de sommeil" value={sleepHours} onChange={setSleepHours} min={4} max={12} color='#7b6af5' emoji="⏰" />
      <Slider label="Humeur au réveil" value={mood} onChange={setMood} color='#f5a623' emoji="😊" />
      <Slider label="Readiness (prêt à performer)" value={readiness} onChange={setReadiness} color='#3dd68c' emoji="⚡" />
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(240,240,245,0.4)', marginBottom:10, fontWeight:500 }}>💧 Hydratation au réveil</div>
        <button onClick={() => setHydration(!hydration)} style={{ padding:'10px 20px', borderRadius:20, border:`1px solid ${hydration ? '#3dd68c' : 'rgba(255,255,255,0.1)'}`, background: hydration ? 'rgba(61,214,140,0.15)' : 'transparent', color: hydration ? '#3dd68c' : 'rgba(240,240,245,0.5)', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans', sans-serif" }}>
          {hydration ? '✓ Fait' : 'Pas encore'}
        </button>
      </div>
      <Chips label="Rituels du matin" options={ritualOpts} selected={rituals} onToggle={r => setRituals(prev => prev.includes(r) ? prev.filter(x=>x!==r) : [...prev,r])} color='#f5a623' />
      <TextArea label="Focus du jour" value={focus} onChange={setFocus} placeholder="L'intention principale pour aujourd'hui..." emoji="🎯" />
      <TextArea label="Ressenti corporel" value={bodyNotes} onChange={setBodyNotes} placeholder="Courbatures, douleurs, sensations..." emoji="🏃" />
      {customQuestions.map(q => <TextArea key={q.id} label={q.label} value={customAnswers[q.id]||''} onChange={v => setCustomAnswers(prev=>({...prev,[q.id]:v}))} placeholder="Ta réponse..." emoji="💬" />)}
      <button onClick={handleSave} disabled={saving} style={{ width:'100%', padding:16, background:'#f5a623', border:'none', borderRadius:14, color:'#0a0a0f', fontFamily:"'Bebas Neue', sans-serif", fontSize:18, letterSpacing:2, cursor:'pointer', opacity:saving?0.7:1 }}>
        {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER MON MATIN ✓'}
      </button>
    </div>
  )
}

// ── Session Form ─────────────────────────────────────────────────────────────
function SessionForm({ sessionNum, onSave, saving, onSaved }: {
  sessionNum: 1 | 2; onSave: (data: any) => void; saving: boolean; onSaved: boolean
}) {
  const [rpe, setRpe] = useState(7)
  const [performance, setPerformance] = useState(7)
  const [feelings, setFeelings] = useState('')
  const [improvements, setImprovements] = useState('')
  const [notes, setNotes] = useState('')

  const color = sessionNum === 1 ? '#3dd68c' : '#60a5fa'

  return (
    <div>
      <Slider label="RPE (effort perçu)" value={rpe} onChange={setRpe} color='#f87171' emoji="🔥" />
      <Slider label="Performance ressentie" value={performance} onChange={setPerformance} color={color} emoji="📈" />
      <TextArea label="Ressenti pendant la séance" value={feelings} onChange={setFeelings} placeholder="Énergie, cardio, force, mental..." emoji="💭" />
      <TextArea label="Points à améliorer" value={improvements} onChange={setImprovements} placeholder="Technique, stratégie, mental..." emoji="🔧" />
      <TextArea label="Notes libres" value={notes} onChange={setNotes} placeholder="Observations, PR, contexte..." emoji="📝" />
      <button onClick={() => onSave({ session: sessionNum, rpe, performance, feelings, improvements, notes })} disabled={saving}
        style={{ width:'100%', padding:16, background:color, border:'none', borderRadius:14, color:'#0a0a0f', fontFamily:"'Bebas Neue', sans-serif", fontSize:18, letterSpacing:2, cursor:'pointer', opacity:saving?0.7:1, transition:'opacity 0.2s' }}>
        {saving ? 'ENREGISTREMENT...' : `ENREGISTRER SÉANCE ${sessionNum} ✓`}
      </button>
      {onSaved && <div style={{ marginTop:12, padding:'10px 16px', background: sessionNum===1 ? 'rgba(61,214,140,0.12)' : 'rgba(96,165,250,0.12)', border:`1px solid ${sessionNum===1 ? 'rgba(61,214,140,0.3)' : 'rgba(96,165,250,0.3)'}`, borderRadius:10, textAlign:'center', fontSize:13, color:color, fontWeight:500 }}>✓ Séance {sessionNum} enregistrée !</div>}
    </div>
  )
}

// ── Journal ───────────────────────────────────────────────────────────────────
function Journal({ onSave, saving, onSaved }: { onSave: (data: any) => void; saving: boolean; onSaved: boolean }) {
  const [session, setSession] = useState<1 | 2>(1)

  return (
    <div>
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{ fontSize:48, marginBottom:8 }}>📓</div>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, letterSpacing:3, color:'#3dd68c' }}>JOURNAL WOD</div>
        <div style={{ fontSize:12, color:'rgba(240,240,245,0.35)', marginTop:4 }}>Analyse ta séance</div>
      </div>

      {/* Session selector */}
      <div style={{ display:'flex', background:'#1a1a26', borderRadius:14, padding:4, marginBottom:28, gap:4 }}>
        {([1, 2] as const).map(s => (
          <button key={s} onClick={() => setSession(s)} style={{
            flex:1, padding:'12px 0', borderRadius:11, border:'none', cursor:'pointer',
            background: session === s ? (s === 1 ? '#3dd68c' : '#60a5fa') : 'transparent',
            color: session === s ? '#0a0a0f' : 'rgba(240,240,245,0.4)',
            fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:600, transition:'all 0.2s',
          }}>
            {s === 1 ? '🏋️ Séance 1' : '⚡ Séance 2'}
          </button>
        ))}
      </div>

      <SessionForm key={session} sessionNum={session} onSave={onSave} saving={saving} onSaved={onSaved} />
    </div>
  )
}


// ── Profil ────────────────────────────────────────────────────────────────────
function ProfilView({ userId, name, email, athleteId, totalEntries, onLogout }: {
  userId: string; name: string; email: string; athleteId: string | null; totalEntries: number; onLogout: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('profiles').select('age, weight, height').eq('id', userId).single()
      .then(({ data }) => {
        if (data) {
          if (data.age) setAge(String(data.age))
          if (data.weight) setWeight(String(data.weight))
          if (data.height) setHeight(String(data.height))
        }
      })
  }, [userId])

  const save = async () => {
    setSaving(true)
    await supabase.from('profiles').update({
      age: age ? parseInt(age) : null,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseInt(height) : null,
    }).eq('id', userId)
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  const copyId = () => {
    if (!athleteId) return
    navigator.clipboard.writeText(athleteId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif",
    fontSize: 16, padding: '12px 14px', outline: 'none', boxSizing: 'border-box',
    textAlign: 'center',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg, #f96167, #f5a623)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:28 }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:26, letterSpacing:3, color:'#f0f0f5' }}>{name}</div>
        <div style={{ fontSize:12, color:'rgba(240,240,245,0.35)', marginTop:2 }}>{email}</div>
      </div>

      {/* ID Card */}
      <div style={{ background:'linear-gradient(135deg, #1a1a2e, #16213e)', border:'1px solid rgba(96,165,250,0.35)', borderRadius:20, padding:24, marginBottom:20, textAlign:'center' }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:'uppercase', color:'rgba(96,165,250,0.6)', marginBottom:10 }}>Mon ID athlète</div>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:52, letterSpacing:10, color:'#60a5fa', lineHeight:1, marginBottom:6 }}>
          {athleteId || '------'}
        </div>
        <div style={{ fontSize:11, color:'rgba(240,240,245,0.35)', marginBottom:16 }}>
          Donne ce code à ton coach pour qu'il t'ajoute
        </div>
        <button onClick={copyId} style={{ padding:'9px 22px', borderRadius:10, background: copied ? 'rgba(61,214,140,0.2)' : 'rgba(96,165,250,0.12)', border:`1px solid ${copied ? 'rgba(61,214,140,0.4)' : 'rgba(96,165,250,0.25)'}`, color: copied ? '#3dd68c' : '#60a5fa', fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:500, cursor:'pointer', transition:'all 0.2s' }}>
          {copied ? '✓ Copié !' : '📋 Copier mon ID'}
        </button>
      </div>

      {/* Infos physiques */}
      <div style={{ background:'#12121a', borderRadius:16, padding:20, marginBottom:16, border:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(240,240,245,0.35)', marginBottom:18, fontWeight:500 }}>
          Mes infos physiques
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18 }}>
          {[
            { label:'Âge', unit:'ans', value:age, set:setAge, emoji:'🎂' },
            { label:'Poids', unit:'kg', value:weight, set:setWeight, emoji:'⚖️' },
            { label:'Taille', unit:'cm', value:height, set:setHeight, emoji:'📏' },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize:10, color:'rgba(240,240,245,0.35)', letterSpacing:1, textTransform:'uppercase', marginBottom:6, textAlign:'center' }}>{f.emoji} {f.label}</div>
              <input
                type="number"
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder="—"
                style={inputStyle}
              />
              <div style={{ fontSize:10, color:'rgba(240,240,245,0.25)', textAlign:'center', marginTop:4 }}>{f.unit}</div>
            </div>
          ))}
        </div>

        {savedMsg && (
          <div style={{ background:'rgba(61,214,140,0.1)', border:'1px solid rgba(61,214,140,0.3)', borderRadius:10, padding:'9px 14px', fontSize:13, color:'#3dd68c', marginBottom:12, textAlign:'center' }}>
            ✓ Profil mis à jour !
          </div>
        )}

        <button onClick={save} disabled={saving} style={{ width:'100%', padding:'13px', background:'#7b6af5', border:'none', borderRadius:12, color:'#fff', fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:500, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement...' : 'Enregistrer mon profil'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ background:'#12121a', borderRadius:14, padding:'16px 20px', border:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:40 }}>
        <div style={{ fontSize:13, color:'rgba(240,240,245,0.4)' }}>🏋️ Athlète</div>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:'#7b6af5' }}>{totalEntries} <span style={{ fontSize:11, fontFamily:"'DM Sans', sans-serif", color:'rgba(240,240,245,0.35)' }}>entrées</span></div>
      </div>

      {/* Logout */}
      <button onClick={onLogout} style={{ width:'100%', padding:'14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:14, color:'#f87171', fontFamily:"'DM Sans', sans-serif", fontSize:14, fontWeight:500, cursor:'pointer', transition:'all 0.2s', marginBottom:8 }}>
        🚪 Se déconnecter
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
  const [savedType, setSavedType] = useState('')
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestions>({ morning:[], night:[] })
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [allEntries, setAllEntries] = useState<Entry[]>([])
  const supabase = createClient()

  const loadEntries = useCallback(async (uid: string) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-60)
    const { data } = await supabase
      .from('entries').select('*').eq('user_id', uid)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
    if (data) setAllEntries(data)
  }, [])

  useEffect(() => {
    const paramTab = searchParams.get('tab') as Tab | null
    if (paramTab && ['night','morning','journal','semaine','stats','profil'].includes(paramTab)) setTab(paramTab)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/auth'); return }
      setUserName(user.user_metadata?.full_name?.split(' ')[0] || 'Athlète')
      setUserEmail(user.email || '')
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role, custom_questions, athlete_id').eq('id', user.id).single()
      if (profile?.role === 'coach') { router.replace('/coach'); return }
      if (profile?.custom_questions) setCustomQuestions(profile.custom_questions)
      if (profile?.athlete_id) setAthleteId(profile.athlete_id)
      await loadEntries(user.id)
    })
  }, [])

  const saveCustomQuestions = useCallback(async (routine: 'morning'|'night', questions: CustomQuestion[]) => {
    if (!userId) return
    const updated = { ...customQuestions, [routine]: questions }
    setCustomQuestions(updated)
    await supabase.from('profiles').update({ custom_questions: updated }).eq('id', userId)
  }, [userId, customQuestions])

  const handleSave = useCallback(async (data: any) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth'); return }
    await supabase.from('entries').insert({ user_id: user.id, type: tab, data })
    await loadEntries(user.id)
    setSaving(false); setSaved(true); setSavedType(tab); setTimeout(() => setSaved(false), 3000)
  }, [tab, loadEntries])

  const handleTabChange = useCallback(async (newTab: Tab) => {
    setTab(newTab)
    if (newTab === 'semaine' || newTab === 'stats' || newTab === 'profil') {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await loadEntries(user.id)
    }
  }, [loadEntries])

  const tabs = [
    { id:'morning' as Tab, emoji:'☀️', label:'Morning',   color:'#f5a623' },
    { id:'night'   as Tab, emoji:'🌙', label:'Night',     color:'#7b6af5' },
    { id:'journal' as Tab, emoji:'📓', label:'WOD',       color:'#3dd68c' },
    { id:'semaine' as Tab, emoji:'📅', label:'Calendrier',color:'#60a5fa' },
    { id:'stats'   as Tab, emoji:'📊', label:'Stats',     color:'#f87171' },
  ]
  const activeColor = tabs.find(t => t.id===tab)?.color || '#7b6af5'

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#f0f0f5', fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 60% 40% at 50% 0%, ${activeColor}12, transparent 60%)`, pointerEvents:'none', zIndex:0, transition:'background 0.4s' }} />
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', background:'rgba(10,10,15,0.9)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, letterSpacing:2, color:activeColor, transition:'color 0.3s' }}>ATHLETE</div>
        <button onClick={() => handleTabChange('profil')} style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg, #f96167, #f5a623)`, border:'2px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Bebas Neue', sans-serif", fontSize:15, color:'#fff', letterSpacing:0, flexShrink:0, transition:'transform 0.2s', outline:'none' }}>
          {userName.charAt(0).toUpperCase()}
        </button>
      </nav>
      <div style={{ position:'fixed', top:60, left:0, right:0, zIndex:99, background:'rgba(10,10,15,0.9)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'8px 12px', display:'flex', gap:6 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => handleTabChange(t.id)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:`1px solid ${tab===t.id ? t.color : 'rgba(255,255,255,0.06)'}`, background: tab===t.id ? `${t.color}20` : 'transparent', color: tab===t.id ? t.color : 'rgba(240,240,245,0.35)', fontFamily:"'DM Sans', sans-serif", fontSize:9, fontWeight:600, cursor:'pointer', transition:'all 0.2s', letterSpacing:0.3 }}>
            <div style={{ fontSize:16, marginBottom:2 }}>{t.emoji}</div>
            <div>{t.label}</div>
          </button>
        ))}
      </div>
      <main style={{ position:'relative', zIndex:1, maxWidth:480, margin:'0 auto', padding:'130px 20px 60px' }}>

        {tab==='morning' && <MorningRoutine onSave={handleSave} saving={saving} onSaved={saved && savedType==='morning'} customQuestions={customQuestions.morning} onSaveCustomQuestions={q => saveCustomQuestions('morning', q)} />}
        {tab==='night'   && <NightRoutine   onSave={handleSave} saving={saving} onSaved={saved && savedType==='night'}   customQuestions={customQuestions.night}   onSaveCustomQuestions={q => saveCustomQuestions('night', q)} />}
        {tab==='journal' && <Journal onSave={handleSave} saving={saving} onSaved={saved && savedType==='journal'} />}
        {tab==='semaine' && userId && <WeekCalendar userId={userId} />}
        {tab==='stats'   && userId && <StatsView userId={userId} />}
        {tab==='profil'  && userId && <ProfilView userId={userId} name={userName} email={userEmail} athleteId={athleteId} totalEntries={allEntries.length} onLogout={() => { supabase.auth.signOut(); router.replace('/auth') }} />}
      </main>
    </div>
  )
}

export default function AthletePage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}><div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:24, letterSpacing:4, color:'#7b6af5' }}>CHARGEMENT...</div></div>}>
      <AthleteContent />
    </Suspense>
  )
}
