'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden' },
  glow: { position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' },
  card: { width: '100%', maxWidth: 400, background: '#12121a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '36px 28px', position: 'relative', zIndex: 1 },
  logo: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 4, color: '#7b6af5', textAlign: 'center', marginBottom: 4 },
  tagline: { fontSize: 13, color: 'rgba(240,240,245,0.45)', textAlign: 'center', marginBottom: 32, fontWeight: 300 },
  tabs: { display: 'flex', background: '#1a1a26', borderRadius: 12, padding: 4, marginBottom: 28, gap: 4 },
  tab: { flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s' },
  label: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: 'rgba(240,240,245,0.45)', marginBottom: 8, fontWeight: 500 },
  input: { width: '100%', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '13px 16px', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 },
  btnPrimary: { width: '100%', padding: '14px', background: '#7b6af5', border: 'none', borderRadius: 12, color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 12, letterSpacing: 0.5 },
  error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 14 },
  success: { background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#3dd68c', marginBottom: 14 },
}

type Role = 'athlete' | 'coach'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [role, setRole] = useState<Role>('athlete')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true); setError(''); setSuccess('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        if (data.user) {
          await supabase.from('profiles').update({ role }).eq('id', data.user.id)
        }
        setSuccess('Compte créé ! Vérifie ton email pour confirmer.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', data.user.id).single()
        if (profile?.role === 'coach') {
          router.replace('/coach')
        } else {
          router.replace('/athlete')
        }
      }
    } catch (e: any) {
      setError(e.message || 'Une erreur est survenue')
    } finally { setLoading(false) }
  }

  const roleConfig = {
    athlete: { emoji: '🏋️', label: 'Athlète', desc: 'Je veux suivre mes routines', color: '#7b6af5' },
    coach:   { emoji: '📋', label: 'Coach',   desc: 'Je veux suivre mes athlètes', color: '#f5a623' },
  }

  return (
    <div style={s.page}>
      <div style={{ ...s.glow, width: 300, height: 300, background: 'rgba(123,106,245,0.15)', top: -80, left: -80 }} />
      <div style={{ ...s.glow, width: 200, height: 200, background: 'rgba(123,106,245,0.1)', bottom: -40, right: -40 }} />
      <div style={s.card}>
        <div style={s.logo}>ATHLETE</div>
        <div style={s.tagline}>Ta routine quotidienne d'athlète</div>
        <div style={s.tabs}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} style={{ ...s.tab, background: mode === m ? '#7b6af5' : 'transparent', color: mode === m ? '#fff' : 'rgba(240,240,245,0.45)' }}
              onClick={() => { setMode(m); setError(''); setSuccess('') }}>
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>
        {error && <div style={s.error}>{error}</div>}
        {success && <div style={s.success}>{success}</div>}
        {mode === 'signup' && (
          <div style={{ marginBottom: 20 }}>
            <div style={s.label}>Je suis...</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['athlete', 'coach'] as Role[]).map(r => (
                <button key={r} onClick={() => setRole(r)} style={{
                  flex: 1, padding: '14px 10px', borderRadius: 14,
                  border: `1px solid ${role === r ? roleConfig[r].color : 'rgba(255,255,255,0.07)'}`,
                  background: role === r ? `${roleConfig[r].color}18` : '#1a1a26',
                  cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{roleConfig[r].emoji}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: role === r ? roleConfig[r].color : '#f0f0f5', marginBottom: 2 }}>{roleConfig[r].label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.35)', lineHeight: 1.3 }}>{roleConfig[r].desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === 'signup' && (
          <>
            <div style={s.label}>Prénom {role === 'coach' ? '(ton nom de coach)' : ''}</div>
            <input style={s.input} type="text" placeholder={role === 'coach' ? 'Ex: Nicolas' : 'Ton prénom'} value={name} onChange={e => setName(e.target.value)} />
          </>
        )}
        <div style={s.label}>Email</div>
        <input style={s.input} type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <div style={s.label}>Mot de passe</div>
        <input style={s.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        <button style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : `Créer mon compte ${roleConfig[role].emoji}`}
        </button>
      </div>
    </div>
  )
}
