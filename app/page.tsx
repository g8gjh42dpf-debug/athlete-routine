'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Athlete = { id: string; name: string; email: string; athlete_id: string; entries: number; last_entry: string | null; avg_sleep: number | null; avg_rpe: number | null }
type Entry = { id: string; type: string; data: any; created_at: string }

export default function CoachPage() {
  const router = useRouter()
  const supabase = createClient()
  const [coachName, setCoachName] = useState('')
  const [coachEmail, setCoachEmail] = useState('')
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'athletes' | 'stats' | 'ajouter' | 'profil'>('athletes')
  const [addId, setAddId] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [coachId, setCoachId] = useState<string | null>(null)

  const accent = '#f5a623'

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
      if (profile?.role !== 'coach') { router.replace('/athlete'); return }
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
    if (!links || links.length === 0) { setAthletes([]); setLoading(false); return }

    const athleteIds = links.map((l: any) => l.athlete_user_id)
    const { data: profiles } = await supabase
      .from('profiles').select('*').in('id', athleteIds)
    const { data: allEntries } = await supabase
      .from('entries').select('*').in('user_id', athleteIds).order('created_at', { ascending: false })

    const byUser: Record<string, any[]> = {}
    allEntries?.forEach((e: any) => { if (!byUser[e.user_id]) byUser[e.user_id] = []; byUser[e.user_id].push(e) })

    const list: Athlete[] = (profiles || []).map((p: any) => {
      const ents = byUser[p.id] || []
      const mornings = ents.filter((e: any) => e.type === 'morning' && e.data.sleep_quality)
      const journals = ents.filter((e: any) => e.type === 'journal' && e.data.rpe)
      return {
        id: p.id, name: p.full_name || 'Athlète', email: p.email || '',
        athlete_id: p.athlete_id || '------',
        entries: ents.length,
        last_entry: ents[0]?.created_at || null,
        avg_sleep: mornings.length ? +(mornings.reduce((s: number, e: any) => s + e.data.sleep_quality, 0) / mornings.length).toFixed(1) : null,
        avg_rpe: journals.length ? +(journals.reduce((s: number, e: any) => s + e.data.rpe, 0) / journals.length).toFixed(1) : null,
      }
    })
    setAthletes(list)
    setLoading(false)
  }

  async function addAthlete() {
    if (!coachId || !addId.trim()) return
    setAddLoading(true); setAddMsg(null)
    const cleanId = addId.trim().padStart(6, '0')
    const { data: profile } = await supabase
      .from('profiles').select('id, full_name, role').eq('athlete_id', cleanId).single()
    if (!profile) { setAddMsg({ type: 'error', text: `Aucun athlète trouvé avec l'ID ${cleanId}` }); setAddLoading(false); return }
    if (profile.role !== 'athlete') { setAddMsg({ type: 'error', text: 'Cet ID correspond à un coach, pas un athlète.' }); setAddLoading(false); return }
    const { error } = await supabase.from('coach_athletes').insert({ coach_id: coachId, athlete_user_id: profile.id })
    if (error?.code === '23505') { setAddMsg({ type: 'error', text: `${profile.full_name} est déjà dans ta liste.` }); setAddLoading(false); return }
    if (error) { setAddMsg({ type: 'error', text: 'Erreur lors de l\'ajout.' }); setAddLoading(false); return }
    setAddMsg({ type: 'success', text: `✓ ${profile.full_name} ajouté à ta liste !` })
    setAddId('')
    loadAthletes(coachId)
    setAddLoading(false)
  }

  async function removeAthlete(athleteUserId: string, athleteName: string) {
    if (!coachId) return
    if (!confirm(`Retirer ${athleteName} de ta liste ?`)) return
    await supabase.from('coach_athletes').delete().eq('coach_id', coachId).eq('athlete_user_id', athleteUserId)
    setAthletes(prev => prev.filter(a => a.id !== athleteUserId))
    if (selected === athleteUserId) setSelected(null)
  }

  async function loadUserEntries(userId: string) {
    const { data } = await supabase.from('entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
    setEntries(data || [])
    setSelected(userId)
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth') }

  const typeConfig: Record<string, { emoji: string; color: string }> = {
    morning: { emoji: '☀️', color: '#f5a623' },
    night:   { emoji: '🌙', color: '#7b6af5' },
    journal: { emoji: '📓', color: '#3dd68c' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: 'fixed', inset: 0, background: `radial-gradient(ellipse 50% 40% at 80% 20%, rgba(245,166,35,0.1), transparent 60%)`, pointerEvents: 'none', zIndex: 0 }} />

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: accent }}>COACH</span>
          <span style={{ marginLeft: 8, fontSize: 13, color: 'rgba(240,240,245,0.5)' }}>{coachName}</span>
        </div>
        <button onClick={logout} style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: 1 }}>DÉCONNEXION</button>
      </nav>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '80px 20px 40px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[
            { id: 'athletes', label: '👥 Mes athlètes' },
            { id: 'stats',    label: '📊 Stats globales' },
            { id: 'ajouter',  label: '➕ Ajouter' },
            { id: 'profil',   label: '👤 Profil' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${tab === t.id ? accent : 'rgba(255,255,255,0.07)'}`, background: tab === t.id ? accent : '#12121a', color: tab === t.id ? '#0a0a0f' : 'rgba(240,240,245,0.6)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Ajouter un athlète ── */}
        {tab === 'ajouter' && (
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, marginBottom: 8, color: accent }}>AJOUTER UN ATHLÈTE</div>
            <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.45)', marginBottom: 24 }}>Demande à ton athlète son ID à 6 chiffres (visible dans son profil) et entre-le ici.</div>

            <div style={{ background: '#12121a', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(240,240,245,0.4)', marginBottom: 10, fontWeight: 500 }}>ID athlète (6 chiffres)</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={addId}
                  onChange={e => setAddId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="ex: 483921"
                  onKeyDown={e => e.key === 'Enter' && addAthlete()}
                  style={{ flex: 1, background: '#1a1a26', border: `1px solid ${addMsg?.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, color: '#f0f0f5', fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 6, padding: '12px 16px', outline: 'none', textAlign: 'center' }}
                />
                <button onClick={addAthlete} disabled={addLoading || addId.length < 6}
                  style={{ padding: '12px 20px', borderRadius: 12, background: addId.length === 6 ? accent : '#1a1a26', border: 'none', color: addId.length === 6 ? '#0a0a0f' : 'rgba(240,240,245,0.3)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: addId.length === 6 ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                  {addLoading ? '...' : 'Ajouter'}
                </button>
              </div>
              {addMsg && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: addMsg.type === 'success' ? 'rgba(61,214,140,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${addMsg.type === 'success' ? 'rgba(61,214,140,0.3)' : 'rgba(239,68,68,0.3)'}`, color: addMsg.type === 'success' ? '#3dd68c' : '#f87171' }}>
                  {addMsg.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Liste athlètes ── */}
        {tab === 'athletes' && (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)', marginBottom: 16, fontWeight: 500 }}>
                {loading ? 'Chargement...' : `${athletes.length} athlète${athletes.length !== 1 ? 's' : ''}`}
              </div>

              {athletes.length === 0 && !loading && (
                <div style={{ background: '#12121a', borderRadius: 16, padding: 32, textAlign: 'center', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                  <div style={{ fontSize: 14, color: 'rgba(240,240,245,0.45)', marginBottom: 16 }}>Aucun athlète dans ta liste.</div>
                  <button onClick={() => setTab('ajouter')} style={{ padding: '10px 20px', borderRadius: 10, background: accent, border: 'none', color: '#0a0a0f', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    ➕ Ajouter un athlète
                  </button>
                </div>
              )}

              {athletes.map(a => (
                <div key={a.id} style={{ background: selected === a.id ? '#1a1a26' : '#12121a', border: `1px solid ${selected === a.id ? accent : 'rgba(255,255,255,0.07)'}`, borderRadius: 16, padding: 20, marginBottom: 10, transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => loadUserEntries(a.id)}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: accent, letterSpacing: 2, background: `${accent}15`, padding: '2px 8px', borderRadius: 6 }}>#{a.athlete_id}</span>
                        <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.3)' }}>
                          {a.last_entry ? `Dernière entrée : ${new Date(a.last_entry).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'Aucune entrée'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: accent }}>{a.entries} <span style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,240,245,0.4)' }}>entrées</span></div>
                      <button onClick={() => removeAthlete(a.id, a.name)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>×</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, cursor: 'pointer' }} onClick={() => loadUserEntries(a.id)}>
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

            {/* Détail athlète */}
            {selected && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,240,245,0.45)', fontWeight: 500 }}>
                    {athletes.find(a => a.id === selected)?.name}
                  </div>
                  <button onClick={() => setSelected(null)} style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Fermer</button>
                </div>
                {entries.map(e => {
                  const cfg = typeConfig[e.type] || { emoji: '📄', color: '#888' }
                  return (
                    <div key={e.id} style={{ background: '#12121a', border: `1px solid ${cfg.color}33`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${cfg.color}18`, color: cfg.color }}>{cfg.emoji} {e.type}</span>
                        <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.35)' }}>{new Date(e.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {Object.entries(e.data).filter(([k, v]) => v && !k.startsWith('custom_')).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 13, color: 'rgba(240,240,245,0.7)', marginTop: 4 }}>
                          <span style={{ color: 'rgba(240,240,245,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{k.replace(/_/g, ' ')} </span>
                          {String(v)}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Stats globales ── */}
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
                    <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', marginTop: 2 }}>{a.entries} entrées · #{a.athlete_id}</div>
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

        {/* ── Profil Coach ── */}
        {tab === 'profil' && (
          <div style={{ maxWidth: 440 }}>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:48, marginBottom:8 }}>📋</div>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, letterSpacing:3, color: accent }}>MON PROFIL COACH</div>
            </div>

            <div style={{ background:'#12121a', borderRadius:16, padding:24, marginBottom:16, border:`1px solid ${accent}33` }}>
              <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(240,240,245,0.35)', marginBottom:14, fontWeight:500 }}>Mes informations</div>
              {[
                { label:'Prénom', value: coachName, emoji:'🏆' },
                { label:'Email', value: coachEmail, emoji:'📧' },
                { label:'Rôle', value: 'Coach', emoji:'📋' },
                { label:'Athlètes suivis', value: String(athletes.length), emoji:'👥' },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:13, color:'rgba(240,240,245,0.45)' }}>{item.emoji} {item.label}</span>
                  <span style={{ fontSize:13, color:'#f0f0f5', fontWeight:500 }}>{item.value || '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ background:'#12121a', borderRadius:16, padding:20, border:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(240,240,245,0.35)', marginBottom:14, fontWeight:500 }}>Comment ajouter un athlète</div>
              <div style={{ fontSize:13, color:'rgba(240,240,245,0.6)', lineHeight:1.8 }}>
                <div>1️⃣ L'athlète s'inscrit sur l'app</div>
                <div>2️⃣ Il va dans l'onglet <span style={{ color: accent, fontWeight:600 }}>Profil</span></div>
                <div>3️⃣ Il te donne son ID à 6 chiffres</div>
                <div>4️⃣ Tu vas dans <span style={{ color: accent, fontWeight:600 }}>➕ Ajouter</span> et tu entres son ID</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
