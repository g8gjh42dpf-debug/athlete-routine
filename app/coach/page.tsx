'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type User = { id: string; email: string; name: string; entries: number; last_entry: string | null; avg_sleep: number | null; avg_rpe: number | null }

export default function CoachPage() {
  const router = useRouter()
  const supabase = createClient()
  const [athletes, setAthletes] = useState<User[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'athletes' | 'stats'>('athletes')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_COACH_EMAIL) {
        router.replace('/')
        return
      }
      loadAthletes()
    })
  }, [])

  async function loadAthletes() {
    setLoading(true)
    // Get all entries grouped by user
    const { data: allEntries } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false })

    if (!allEntries) { setLoading(false); return }

    // Build per-user stats
    const byUser: Record<string, any[]> = {}
    for (const e of allEntries) {
      if (!byUser[e.user_id]) byUser[e.user_id] = []
      byUser[e.user_id].push(e)
    }

    // Fetch profiles
    const { data: profiles } = await supabase.from('profiles').select('*')
    const profileMap: Record<string, string> = {}
    profiles?.forEach((p: any) => { profileMap[p.id] = p.full_name || p.email })

    const users: User[] = Object.entries(byUser).map(([uid, ents]) => {
      const mornings = ents.filter(e => e.type === 'morning' && e.data.sleep_quality)
      const journals = ents.filter(e => e.type === 'journal' && e.data.rpe)
      return {
        id: uid,
        email: uid,
        name: profileMap[uid] || 'Athlète',
        entries: ents.length,
        last_entry: ents[0]?.created_at || null,
        avg_sleep: mornings.length ? +(mornings.reduce((s, e) => s + e.data.sleep_quality, 0) / mornings.length).toFixed(1) : null,
        avg_rpe: journals.length ? +(journals.reduce((s, e) => s + e.data.rpe, 0) / journals.length).toFixed(1) : null,
      }
    })

    setAthletes(users)
    setLoading(false)
  }

  async function loadUserEntries(userId: string) {
    const { data } = await supabase.from('entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
    setEntries(data || [])
    setSelected(userId)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  const accent = '#7b6af5'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: 'fixed', inset: 0, background: `radial-gradient(ellipse 50% 40% at 80% 20%, rgba(123,106,245,0.15), transparent 60%)`, pointerEvents: 'none', zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: accent }}>COACH DASHBOARD</span>
          <span style={{ marginLeft: 12, fontSize: 11, color: 'rgba(240,240,245,0.3)', letterSpacing: 1, textTransform: 'uppercase' }}>Athlete Routine</span>
        </div>
        <button onClick={logout} style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 1 }}>DÉCONNEXION</button>
      </nav>

      <main style={{ paddingTop: 80, paddingBottom: 40, position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '80px 20px 40px' }}>

        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {(['athletes', 'stats'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${tab === t ? accent : 'rgba(255,255,255,0.07)'}`, background: tab === t ? accent : '#12121a', color: tab === t ? '#fff' : 'rgba(240,240,245,0.6)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {t === 'athletes' ? '👥 Athlètes' : '📊 Stats globales'}
            </button>
          ))}
        </div>

        {/* Athletes tab */}
        {tab === 'athletes' && (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
            {/* List */}
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)', marginBottom: 16, fontWeight: 500 }}>
                {loading ? 'Chargement...' : `${athletes.length} athlète${athletes.length !== 1 ? 's' : ''} actif${athletes.length !== 1 ? 's' : ''}`}
              </div>
              {athletes.length === 0 && !loading && (
                <div style={{ background: '#12121a', borderRadius: 16, padding: 32, textAlign: 'center', color: 'rgba(240,240,245,0.45)', fontSize: 14 }}>
                  Aucun athlète inscrit pour l'instant.<br />Partage le lien de l'app !
                </div>
              )}
              {athletes.map(a => (
                <div key={a.id} onClick={() => loadUserEntries(a.id)}
                  style={{ background: selected === a.id ? '#1a1a26' : '#12121a', border: `1px solid ${selected === a.id ? accent : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: 20, marginBottom: 10, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 15 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', marginTop: 2 }}>
                        {a.last_entry ? `Dernière entrée : ${new Date(a.last_entry).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'Aucune entrée'}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: accent }}>{a.entries} <span style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,240,245,0.4)' }}>entrées</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {a.avg_sleep && <div style={{ flex: 1, background: '#0a0a0f', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: '#f5a623' }}>{a.avg_sleep}</div>
                      <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.4)', letterSpacing: 0.5 }}>SOMMEIL</div>
                    </div>}
                    {a.avg_rpe && <div style={{ flex: 1, background: '#0a0a0f', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 500, color: '#3dd68c' }}>{a.avg_rpe}</div>
                      <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.4)', letterSpacing: 0.5 }}>RPE MOY.</div>
                    </div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Detail panel */}
            {selected && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)', fontWeight: 500 }}>Détail athlète</div>
                  <button onClick={() => setSelected(null)} style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Fermer</button>
                </div>
                {entries.map(e => (
                  <div key={e.id} style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: e.type === 'night' ? 'rgba(123,106,245,0.15)' : e.type === 'morning' ? 'rgba(245,166,35,0.15)' : 'rgba(61,214,140,0.15)', color: e.type === 'night' ? '#7b6af5' : e.type === 'morning' ? '#f5a623' : '#3dd68c' }}>
                        {e.type === 'night' ? '🌙 Night' : e.type === 'morning' ? '☀️ Morning' : '📓 Journal'}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)' }}>
                        {new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {Object.entries(e.data).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 13, color: 'rgba(240,240,245,0.7)', marginTop: 4 }}>
                        <span style={{ color: 'rgba(240,240,245,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{k.replace('_', ' ')} </span>
                        {String(v)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats tab */}
        {tab === 'stats' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              {[
                { val: athletes.length, lbl: 'Athlètes', color: accent },
                { val: athletes.reduce((s, a) => s + a.entries, 0), lbl: 'Entrées totales', color: '#3dd68c' },
                { val: athletes.filter(a => a.avg_sleep).length ? (athletes.filter(a => a.avg_sleep).reduce((s, a) => s + (a.avg_sleep || 0), 0) / athletes.filter(a => a.avg_sleep).length).toFixed(1) : '—', lbl: 'Sommeil moyen', color: '#f5a623' },
                { val: athletes.filter(a => a.avg_rpe).length ? (athletes.filter(a => a.avg_rpe).reduce((s, a) => s + (a.avg_rpe || 0), 0) / athletes.filter(a => a.avg_rpe).length).toFixed(1) : '—', lbl: 'RPE moyen', color: '#3dd68c' },
              ].map(s => (
                <div key={s.lbl} style={{ background: '#12121a', borderRadius: 16, padding: '20px 24px', flex: '1 1 140px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.45)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#12121a', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)', marginBottom: 16, fontWeight: 500 }}>Classement engagement</div>
              {[...athletes].sort((a, b) => b.entries - a.entries).map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: i === 0 ? '#f5a623' : i === 1 ? '#888' : i === 2 ? '#c87941' : 'rgba(240,240,245,0.3)', width: 30 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', marginTop: 2 }}>{a.entries} entrées</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: accent }}>{a.avg_sleep ?? '—'} <span style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,240,245,0.4)' }}>SOMMEIL</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
