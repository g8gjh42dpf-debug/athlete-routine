'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type TabType = 'athletes' | 'ajouter' | 'stats' | 'profil'

type Athlete = {
  id: string
  name: string
  athlete_id: string
  entries: number
  last_entry: string | null
  avg_sleep: number | null
  avg_rpe: number | null
}

type Entry = {
  id: string
  type: string
  data: Record<string, unknown>
  created_at: string
}

export default function CoachPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<TabType>('athletes')
  const [coachName, setCoachName] = useState('')
  const [coachEmail, setCoachEmail] = useState('')
  const [coachId, setCoachId] = useState('')
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [addId, setAddId] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const accent = '#f5a623'

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      const { data: profile } = await supabase
        .from('profiles').select('role, full_name').eq('id', user.id).single()
      if (!profile || profile.role !== 'coach') { router.replace('/athlete'); return }
      setCoachId(user.id)
      setCoachName(profile.full_name || 'Coach')
      setCoachEmail(user.email || '')
      loadAthletes(user.id)
    })
  }, [])

  async function loadAthletes(cid: string) {
    setLoading(true)
    const { data: links } = await supabase
      .from('coach_athletes').select('athlete_user_id').eq('coach_id', cid)

    if (!links || links.length === 0) {
      setAthletes([])
      setLoading(false)
      return
    }

    const athleteIds = links.map((l: Record<string, string>) => l.athlete_user_id)

    const { data: profiles } = await supabase
      .from('profiles').select('*').in('id', athleteIds)

    const { data: allEntries } = await supabase
      .from('entries').select('*').in('user_id', athleteIds)
      .order('created_at', { ascending: false })

    const byUser: Record<string, Entry[]> = {}
    if (allEntries) {
      allEntries.forEach((e: Entry) => {
        if (!byUser[e.user_id as string]) byUser[e.user_id as string] = []
        byUser[e.user_id as string].push(e)
      })
    }

    const list: Athlete[] = (profiles || []).map((p: Record<string, unknown>) => {
      const ents = byUser[p.id as string] || []
      const mornings = ents.filter(e => e.type === 'morning' && (e.data as Record<string, unknown>).sleep_quality)
      const journals = ents.filter(e => e.type === 'journal' && (e.data as Record<string, unknown>).rpe)
      const avgSleep = mornings.length
        ? +(mornings.reduce((s, e) => s + ((e.data as Record<string, number>).sleep_quality || 0), 0) / mornings.length).toFixed(1)
        : null
      const avgRpe = journals.length
        ? +(journals.reduce((s, e) => s + ((e.data as Record<string, number>).rpe || 0), 0) / journals.length).toFixed(1)
        : null
      return {
        id: p.id as string,
        name: (p.full_name as string) || 'Athlète',
        athlete_id: (p.athlete_id as string) || '------',
        entries: ents.length,
        last_entry: ents[0]?.created_at || null,
        avg_sleep: avgSleep,
        avg_rpe: avgRpe,
      }
    })

    setAthletes(list)
    setLoading(false)
  }

  async function addAthlete() {
    if (!coachId || addId.length < 6) return
    setAddLoading(true)
    setAddMsg(null)

    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('athlete_id', addId).single()

    if (!profile) {
      setAddMsg({ ok: false, text: `Aucun athlète trouvé avec l'ID ${addId}` })
      setAddLoading(false)
      return
    }
    if (profile.role !== 'athlete') {
      setAddMsg({ ok: false, text: 'Cet ID correspond à un coach.' })
      setAddLoading(false)
      return
    }

    const { error } = await supabase
      .from('coach_athletes')
      .insert({ coach_id: coachId, athlete_user_id: profile.id })

    if (error) {
      setAddMsg({ ok: false, text: `${profile.full_name} est déjà dans ta liste.` })
    } else {
      setAddMsg({ ok: true, text: `✓ ${profile.full_name} ajouté !` })
      setAddId('')
      loadAthletes(coachId)
    }
    setAddLoading(false)
  }

  async function removeAthlete(athleteUserId: string, name: string) {
    if (!confirm(`Retirer ${name} de ta liste ?`)) return
    await supabase.from('coach_athletes')
      .delete().eq('coach_id', coachId).eq('athlete_user_id', athleteUserId)
    setAthletes(prev => prev.filter(a => a.id !== athleteUserId))
    if (selected === athleteUserId) setSelected(null)
  }

  async function showEntries(athleteId: string) {
    const { data } = await supabase.from('entries').select('*')
      .eq('user_id', athleteId).order('created_at', { ascending: false }).limit(20)
    setEntries((data || []) as Entry[])
    setSelected(athleteId)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  const typeColor: Record<string, string> = {
    morning: '#f5a623', night: '#7b6af5', journal: '#3dd68c'
  }
  const typeEmoji: Record<string, string> = {
    morning: '☀️', night: '🌙', journal: '📓'
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'athletes', label: '👥 Mes athlètes' },
    { id: 'ajouter',  label: '➕ Ajouter' },
    { id: 'stats',    label: '📊 Stats' },
    { id: 'profil',   label: '👤 Profil' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 80% 20%, rgba(245,166,35,0.08), transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: accent }}>
          COACH <span style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,240,245,0.5)', letterSpacing: 0 }}>{coachName}</span>
        </div>
        <button onClick={logout} style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 1 }}>DÉCONNEXION</button>
      </nav>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '80px 20px 40px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${tab === t.id ? accent : 'rgba(255,255,255,0.07)'}`, background: tab === t.id ? accent : '#12121a', color: tab === t.id ? '#0a0a0f' : 'rgba(240,240,245,0.6)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── AJOUTER ── */}
        {tab === 'ajouter' && (
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: accent, marginBottom: 8 }}>AJOUTER UN ATHLÈTE</div>
            <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.45)', marginBottom: 24, lineHeight: 1.6 }}>
              Demande à ton athlète son ID à 6 chiffres (visible dans son onglet Profil) et entre-le ci-dessous.
            </div>
            <div style={{ background: '#12121a', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)', marginBottom: 12, fontWeight: 500 }}>ID athlète (6 chiffres)</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <input
                  value={addId}
                  onChange={e => { setAddId(e.target.value.replace(/\D/g, '').slice(0, 6)); setAddMsg(null) }}
                  placeholder="ex: 125614"
                  onKeyDown={e => e.key === 'Enter' && addAthlete()}
                  style={{ flex: 1, background: '#1a1a26', border: `1px solid ${addMsg?.ok === false ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, color: '#f0f0f5', fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 8, padding: '12px 16px', outline: 'none', textAlign: 'center' }}
                />
              </div>
              <button onClick={addAthlete} disabled={addLoading || addId.length < 6}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: addId.length === 6 ? accent : '#1a1a26', border: 'none', color: addId.length === 6 ? '#0a0a0f' : 'rgba(240,240,245,0.3)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: addId.length === 6 ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                {addLoading ? 'Recherche...' : 'Ajouter cet athlète'}
              </button>
              {addMsg && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: addMsg.ok ? 'rgba(61,214,140,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${addMsg.ok ? 'rgba(61,214,140,0.3)' : 'rgba(239,68,68,0.3)'}`, color: addMsg.ok ? '#3dd68c' : '#f87171' }}>
                  {addMsg.text}
                </div>
              )}
            </div>
            <div style={{ background: '#12121a', borderRadius: 16, padding: 20, marginTop: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 12, color: accent, fontWeight: 600, marginBottom: 10 }}>Comment ça marche ?</div>
              <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.55)', lineHeight: 1.9 }}>
                1️⃣ L'athlète s'inscrit sur l'app<br />
                2️⃣ Il clique sur son nom en haut → onglet <strong>Profil</strong><br />
                3️⃣ Il voit son ID à 6 chiffres en grand<br />
                4️⃣ Il te donne ce code<br />
                5️⃣ Tu l'entres ici → il apparaît dans ta liste
              </div>
            </div>
          </div>
        )}

        {/* ── ATHLETES ── */}
        {tab === 'athletes' && (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)', marginBottom: 16 }}>
                {loading ? 'Chargement...' : `${athletes.length} athlète${athletes.length !== 1 ? 's' : ''}`}
              </div>

              {!loading && athletes.length === 0 && (
                <div style={{ background: '#12121a', borderRadius: 16, padding: 32, textAlign: 'center', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
                  <div style={{ fontSize: 14, color: 'rgba(240,240,245,0.4)', marginBottom: 16 }}>Aucun athlète dans ta liste.</div>
                  <button onClick={() => setTab('ajouter')} style={{ padding: '10px 20px', borderRadius: 10, background: accent, border: 'none', color: '#0a0a0f', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    ➕ Ajouter un athlète
                  </button>
                </div>
              )}

              {athletes.map(a => (
                <div key={a.id} style={{ background: selected === a.id ? '#1a1a26' : '#12121a', border: `1px solid ${selected === a.id ? accent : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: 20, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => showEntries(a.id)}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: accent, background: `${accent}15`, padding: '2px 8px', borderRadius: 6, letterSpacing: 2 }}>#{a.athlete_id}</span>
                        <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.3)' }}>
                          {a.last_entry ? new Date(a.last_entry).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Aucune entrée'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: accent }}>{a.entries}<span style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,240,245,0.4)' }}> entrées</span></div>
                      <button onClick={() => removeAthlete(a.id, a.name)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 14 }}>×</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }} onClick={() => showEntries(a.id)}>
                    {a.avg_sleep && <div style={{ flex: 1, background: '#0a0a0f', borderRadius: 8, padding: '8px 10px', textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: '#f5a623' }}>{a.avg_sleep}</div>
                      <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.35)' }}>SOMMEIL</div>
                    </div>}
                    {a.avg_rpe && <div style={{ flex: 1, background: '#0a0a0f', borderRadius: 8, padding: '8px 10px', textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: '#3dd68c' }}>{a.avg_rpe}</div>
                      <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.35)' }}>RPE</div>
                    </div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Détail */}
            {selected && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)' }}>
                    {athletes.find(a => a.id === selected)?.name}
                  </div>
                  <button onClick={() => setSelected(null)} style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
                {entries.map(e => (
                  <div key={e.id} style={{ background: '#12121a', border: `1px solid ${(typeColor[e.type] || '#888')}33`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${(typeColor[e.type] || '#888')}18`, color: typeColor[e.type] || '#888' }}>
                        {typeEmoji[e.type] || '📄'} {e.type}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.3)' }}>
                        {new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {Object.entries(e.data).filter(([k, v]) => v && !k.startsWith('custom_')).slice(0, 6).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12, color: 'rgba(240,240,245,0.65)', marginTop: 4 }}>
                        <span style={{ color: 'rgba(240,240,245,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{k.replace(/_/g, ' ')} </span>
                        {String(v)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { val: athletes.length, lbl: 'Athlètes', color: accent },
                { val: athletes.reduce((s, a) => s + a.entries, 0), lbl: 'Entrées totales', color: '#3dd68c' },
                { val: athletes.filter(a => a.avg_sleep).length ? (athletes.filter(a => a.avg_sleep).reduce((s, a) => s + (a.avg_sleep || 0), 0) / athletes.filter(a => a.avg_sleep).length).toFixed(1) : '—', lbl: 'Sommeil moyen', color: '#f5a623' },
                { val: athletes.filter(a => a.avg_rpe).length ? (athletes.filter(a => a.avg_rpe).reduce((s, a) => s + (a.avg_rpe || 0), 0) / athletes.filter(a => a.avg_rpe).length).toFixed(1) : '—', lbl: 'RPE moyen', color: '#f87171' },
              ].map(s => (
                <div key={s.lbl} style={{ background: '#12121a', borderRadius: 16, padding: '20px 24px', flex: '1 1 140px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#12121a', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)', marginBottom: 16 }}>Classement engagement</div>
              {[...athletes].sort((a, b) => b.entries - a.entries).map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: i === 0 ? '#f5a623' : i === 1 ? '#888' : i === 2 ? '#c87941' : 'rgba(240,240,245,0.25)', width: 30 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', marginTop: 2 }}>{a.entries} entrées · #{a.athlete_id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {a.avg_sleep && <div style={{ fontSize: 13, color: '#f5a623' }}>{a.avg_sleep} sommeil</div>}
                    {a.avg_rpe && <div style={{ fontSize: 13, color: '#3dd68c' }}>{a.avg_rpe} RPE</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROFIL ── */}
        {tab === 'profil' && (
          <div style={{ maxWidth: 440 }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, #f87171)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: '#0a0a0f' }}>
                {coachName.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3 }}>{coachName}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.35)', marginTop: 2 }}>{coachEmail}</div>
              <div style={{ display: 'inline-block', marginTop: 8, padding: '3px 12px', borderRadius: 20, background: `${accent}18`, border: `1px solid ${accent}33`, fontSize: 11, color: accent, letterSpacing: 1 }}>📋 COACH</div>
            </div>
            <div style={{ background: '#12121a', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { label: 'Athlètes suivis', value: `${athletes.length}`, emoji: '👥' },
                { label: 'Entrées totales', value: `${athletes.reduce((s, a) => s + a.entries, 0)}`, emoji: '📊' },
                { label: 'Rôle', value: 'Coach', emoji: '📋' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(240,240,245,0.45)' }}>{item.emoji} {item.label}</span>
                  <span style={{ fontSize: 13, color: '#f0f0f5', fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
