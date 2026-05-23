'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'night' | 'morning' | 'journal'
type Entry = { id: string; type: string; created_at: string; data: Record<string, any> }

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENTS: Record<Tab, { color: string; glow: string; label: string }> = {
  night:   { color: '#7b6af5', glow: 'rgba(123,106,245,0.2)', label: '🌙 NIGHT' },
  morning: { color: '#f5a623', glow: 'rgba(245,166,35,0.2)',  label: '☀️ MORNING' },
  journal: { color: '#3dd68c', glow: 'rgba(61,214,140,0.2)',  label: '📓 JOURNAL' },
}

function css(base: React.CSSProperties, extra?: React.CSSProperties): React.CSSProperties {
  return { ...base, ...extra }
}

// ─── Reusable components ──────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={css({ background: '#12121a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 14 }, style)}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)', marginBottom: 12, fontWeight: 500 }}>{children}</div>
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)', marginBottom: 8, fontWeight: 500 }}>{children}</div>
}

function CheckItem({ label, accent }: { label: string; accent: string }) {
  const [checked, setChecked] = useState(false)
  return (
    <div onClick={() => setChecked(!checked)} style={css({ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, background: '#1a1a26', border: `1px solid ${checked ? accent : 'transparent'}`, cursor: 'pointer', marginBottom: 8, userSelect: 'none' })}>
      <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${checked ? accent : 'rgba(255,255,255,0.15)'}`, background: checked ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
        {checked && '✓'}
      </div>
      <span style={{ fontSize: 14, color: checked ? 'rgba(240,240,245,0.45)' : '#f0f0f5', textDecoration: checked ? 'line-through' : 'none' }}>{label}</span>
    </div>
  )
}

function RatingRow({ id, accent, onChange }: { id: string; accent: string; onChange: (v: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button key={n} onClick={() => { setSelected(n); onChange(n) }}
          style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${selected === n ? accent : 'rgba(255,255,255,0.07)'}`, background: selected === n ? accent : '#1a1a26', color: selected === n ? '#fff' : 'rgba(240,240,245,0.6)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          {n}
        </button>
      ))}
    </div>
  )
}

function BtnPrimary({ children, onClick, accent, loading }: { children: React.ReactNode; onClick: () => void; accent: string; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ width: '100%', padding: '14px', background: accent, border: 'none', borderRadius: 12, color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1, letterSpacing: 0.5 }}>
      {loading ? 'Enregistrement...' : children}
    </button>
  )
}

function Toast({ msg, accent }: { msg: string; accent: string }) {
  return (
    <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: accent, color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      {msg}
    </div>
  )
}

// ─── Breathing 4-7-8 ─────────────────────────────────────────────────────────
const PHASES = [
  { label: 'INSPIRE', duration: 4 },
  { label: 'RETIENS', duration: 7 },
  { label: 'EXPIRE', duration: 8 },
]

function BreathTimer({ accent }: { accent: string }) {
  const [active, setActive] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [sec, setSec] = useState(4)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!active) return
    const phase = PHASES[phaseIdx]
    setSec(phase.duration)
    setScale(phaseIdx === 0 ? 1.3 : phaseIdx === 1 ? 1.3 : 1)
    const interval = setInterval(() => {
      setSec(s => {
        if (s <= 1) {
          clearInterval(interval)
          setPhaseIdx(p => (p + 1) % 3)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [active, phaseIdx])

  function toggle() {
    if (active) { setActive(false); setPhaseIdx(0); setSec(4); setScale(1) }
    else { setActive(true) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '10px 0' }}>
      <div style={{ width: 100, height: 100, borderRadius: '50%', border: `3px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${scale})`, transition: `transform ${PHASES[phaseIdx]?.duration || 4}s ease-in-out`, boxShadow: active ? `0 0 30px ${accent}40` : 'none' }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: accent }}>{sec || PHASES[phaseIdx]?.duration}</span>
      </div>
      <span style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)' }}>{active ? PHASES[phaseIdx]?.label : 'INSPIRE'}</span>
      <button onClick={toggle} style={{ padding: '10px 24px', background: '#1a1a26', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: 'pointer' }}>
        {active ? '⏹ Stop' : '▶ Démarrer'}
      </button>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function AthletePage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('night')
  const [user, setUser] = useState<any>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

  // Night state
  const [nightFatigue, setNightFatigue] = useState<number | null>(null)
  const [nightNote, setNightNote] = useState('')

  // Morning state
  const [sleepQuality, setSleepQuality] = useState<number | null>(null)
  const [morningEnergy, setMorningEnergy] = useState<number | null>(null)
  const [intention, setIntention] = useState('')
  const [gratitude, setGratitude] = useState('')

  // Journal state
  const [rpe, setRpe] = useState<number | null>(null)
  const [wodPos, setWodPos] = useState('')
  const [wodImp, setWodImp] = useState('')

  const accent = ACCENTS[tab].color

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/auth'); return }
      setUser(user)
      loadEntries(user.id)
    })
    // Auto-select tab by time
    const h = new Date().getHours()
    if (h >= 5 && h < 11) setTab('morning')
    else if (h >= 20 || h < 5) setTab('night')
    else setTab('journal')
  }, [])

  async function loadEntries(userId: string) {
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setEntries(data)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function saveEntry(type: string, data: Record<string, any>) {
    setLoading(true)
    const { error } = await supabase.from('entries').insert({ user_id: user.id, type, data })
    if (!error) {
      await loadEntries(user.id)
      showToast(type === 'night' ? '🌙 Bonne nuit enregistrée !' : type === 'morning' ? '☀️ Journée lancée ! 🔥' : '📓 Entrée sauvegardée ✓')
    }
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  const stats = {
    entries: entries.length,
    streak: Math.min(entries.length, 7),
    avgSleep: (() => {
      const m = entries.filter(e => e.type === 'morning' && e.data.sleep_quality)
      if (!m.length) return null
      return (m.reduce((s, e) => s + e.data.sleep_quality, 0) / m.length).toFixed(1)
    })()
  }

  const journalEntries = entries.filter(e => e.type === 'journal').slice(0, 5)

  const heroTitles: Record<Tab, string[]> = {
    night: ['BONNE', 'NUIT'],
    morning: ['BON', 'MATIN'],
    journal: ['MON', 'BILAN'],
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, background: `radial-gradient(ellipse 60% 40% at 20% 10%, ${ACCENTS[tab].glow}, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 90%, ${ACCENTS[tab].glow}, transparent 50%)`, pointerEvents: 'none', zIndex: 0, transition: 'background 0.6s ease' }} />

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: accent, transition: 'color 0.5s' }}>ATHLETE</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(240,240,245,0.45)', fontWeight: 300 }}>{user?.user_metadata?.full_name || user?.email?.split('@')[0]}</span>
          <button onClick={logout} style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 1 }}>SORTIR</button>
        </div>
      </nav>

      {/* Content */}
      <main style={{ paddingTop: 72, paddingBottom: 90, position: 'relative', zIndex: 1 }}>
        <div style={{ padding: '24px 20px' }}>

          {/* Hero */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent, marginBottom: 8, fontWeight: 500, transition: 'color 0.5s' }}>{ACCENTS[tab].label}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(44px, 12vw, 64px)', lineHeight: 0.9, letterSpacing: 1, marginBottom: 12 }}>
              {heroTitles[tab][0]}<br />{heroTitles[tab][1]}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.45)', fontWeight: 300, lineHeight: 1.6 }}>
              {tab === 'night' && 'Prépare ton corps et ton esprit pour une récupération optimale.'}
              {tab === 'morning' && 'Démarre comme un athlète. Chaque matin compte.'}
              {tab === 'journal' && 'Trace ta progression. Les données ne mentent pas.'}
            </div>
          </div>

          {/* ── NIGHT ── */}
          {tab === 'night' && (
            <>
              <Card>
                <SectionLabel>Checklist pré-sommeil</SectionLabel>
                {['💧 Dernier verre d\'eau', '📵 Notifs coupées', '🌡️ Chambre fraîche (17–19°)', '📱 Écrans off 30 min avant'].map(l => <CheckItem key={l} label={l} accent={accent} />)}
              </Card>
              <Card>
                <SectionLabel>Respiration 4-7-8</SectionLabel>
                <BreathTimer accent={accent} />
              </Card>
              <Card>
                <SectionLabel>Comment je me sens ce soir ?</SectionLabel>
                <FieldLabel>Fatigue (1 = épuisé · 10 = top)</FieldLabel>
                <RatingRow id="nightFatigue" accent={accent} onChange={setNightFatigue} />
                <div style={{ marginTop: 16 }}>
                  <FieldLabel>Note du soir</FieldLabel>
                  <textarea rows={2} placeholder="Tensions, doutes, satisfaction... vide ta tête ici." value={nightNote} onChange={e => setNightNote(e.target.value)}
                    style={{ width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: 14, resize: 'none', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }} />
                </div>
                <BtnPrimary accent={accent} loading={loading} onClick={() => saveEntry('night', { fatigue: nightFatigue, note: nightNote })}>
                  Enregistrer la nuit ✓
                </BtnPrimary>
              </Card>
            </>
          )}

          {/* ── MORNING ── */}
          {tab === 'morning' && (
            <>
              <Card>
                <SectionLabel>Protocole réveil</SectionLabel>
                {['💧 500ml d\'eau à jeun', '☀️ 5 min de lumière naturelle', '🧘 5 min mobilité / respiration', '🍳 Petit-dej protéiné'].map(l => <CheckItem key={l} label={l} accent={accent} />)}
              </Card>
              <Card>
                <SectionLabel>Comment je me réveille ?</SectionLabel>
                <FieldLabel>Qualité du sommeil (1–10)</FieldLabel>
                <RatingRow id="sleepQ" accent={accent} onChange={setSleepQuality} />
                <div style={{ marginTop: 14 }}>
                  <FieldLabel>Énergie perçue (1–10)</FieldLabel>
                  <RatingRow id="energy" accent={accent} onChange={setMorningEnergy} />
                </div>
              </Card>
              <Card>
                <SectionLabel>Intention du jour</SectionLabel>
                <FieldLabel>Mon objectif principal</FieldLabel>
                <input type="text" placeholder="Ex : rester calme sous la barre..." value={intention} onChange={e => setIntention(e.target.value)}
                  style={{ width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '13px 16px', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                <FieldLabel>Ma gratitude du matin</FieldLabel>
                <input type="text" placeholder="Je suis reconnaissant pour..." value={gratitude} onChange={e => setGratitude(e.target.value)}
                  style={{ width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '13px 16px', outline: 'none', boxSizing: 'border-box' }} />
                <BtnPrimary accent={accent} loading={loading} onClick={() => saveEntry('morning', { sleep_quality: sleepQuality, energy: morningEnergy, intention, gratitude })}>
                  Lancer ma journée 🔥
                </BtnPrimary>
              </Card>
            </>
          )}

          {/* ── JOURNAL ── */}
          {tab === 'journal' && (
            <>
              {/* Stats */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[
                  { val: stats.streak, lbl: 'Jours streak' },
                  { val: stats.avgSleep ?? '—', lbl: 'Sommeil moy.' },
                  { val: stats.entries, lbl: 'Entrées' },
                ].map(s => (
                  <div key={s.lbl} style={{ flex: 1, background: '#1a1a26', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: accent, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.45)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{s.lbl}</div>
                  </div>
                ))}
              </div>

              <Card>
                <SectionLabel>Bilan WOD du jour</SectionLabel>
                <FieldLabel>RPE (effort perçu 1–10)</FieldLabel>
                <RatingRow id="rpe" accent={accent} onChange={setRpe} />
                <div style={{ marginTop: 14 }}>
                  <FieldLabel>Ce qui s'est bien passé</FieldLabel>
                  <textarea rows={2} placeholder="Mouvement propre, PR, cohésion..." value={wodPos} onChange={e => setWodPos(e.target.value)}
                    style={{ width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: 14, resize: 'none', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box', marginBottom: 12 }} />
                  <FieldLabel>Ce que j'améliore demain</FieldLabel>
                  <textarea rows={2} placeholder="Pacing, technique, mental..." value={wodImp} onChange={e => setWodImp(e.target.value)}
                    style={{ width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: 14, resize: 'none', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }} />
                </div>
                <BtnPrimary accent={accent} loading={loading} onClick={() => saveEntry('journal', { rpe, positive: wodPos, improve: wodImp })}>
                  Sauvegarder l'entrée ✓
                </BtnPrimary>
              </Card>

              <Card>
                <SectionLabel>Historique récent</SectionLabel>
                {journalEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(240,240,245,0.45)', fontSize: 13 }}>Aucune entrée pour l'instant.<br />Commence ce soir ! 🌙</div>
                ) : journalEntries.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.45)', fontWeight: 300 }}>
                        {new Date(e.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                      {e.data.positive && <div style={{ fontSize: 11, marginTop: 4, background: '#1a1a26', padding: '3px 8px', borderRadius: 20, display: 'inline-block', color: 'rgba(240,240,245,0.45)' }}>✓ {e.data.positive.substring(0, 22)}{e.data.positive.length > 22 ? '…' : ''}</div>}
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: accent, letterSpacing: 1 }}>RPE {e.data.rpe}</div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>
      </main>

      {/* Tab bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'flex', background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)', paddingBottom: 8 }}>
        {(['night', 'morning', 'journal'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: tab === t ? ACCENTS[t].color : 'rgba(240,240,245,0.4)', fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: 0.5, transition: 'color 0.2s' }}>
            <span style={{ fontSize: 20, transform: tab === t ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.2s' }}>
              {t === 'night' ? '🌙' : t === 'morning' ? '☀️' : '📓'}
            </span>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {toast && <Toast msg={toast} accent={accent} />}
    </div>
  )
}
