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
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 12px' },
  divLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' },
  divText: { fontSize: 11, color: 'rgba(240,240,245,0.3)', letterSpacing: 1 },
  btnGoogle: { width: '100%', padding: '13px', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f0f0f5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 14 },
  success: { background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#3dd68c', marginBottom: 14 },
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
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
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        setSuccess('Compte créé ! Vérifie ton email pour confirmer.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.user?.email === process.env.NEXT_PUBLIC_COACH_EMAIL) {
          router.replace('/coach')
        } else {
          router.replace('/athlete')
        }
      }
    } catch (e: any) {
      setError(e.message || 'Une erreur est survenue')
    } finally { setLoading(false) }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/` }
    })
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
            <button key={m} style={{ ...s.tab, background: mode === m ? '#7b6af5' : 'transparent', color: mode === m ? '#fff' : 'rgba(240,240,245,0.45)' }} onClick={() => { setMode(m); setError(''); setSuccess('') }}>
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        {error && <div style={s.error}>{error}</div>}
        {success && <div style={s.success}>{success}</div>}

        {mode === 'signup' && (
          <>
            <div style={s.label}>Prénom</div>
            <input style={s.input} type="text" placeholder="Ton prénom" value={name} onChange={e => setName(e.target.value)} />
          </>
        )}
        <div style={s.label}>Email</div>
        <input style={s.input} type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <div style={s.label}>Mot de passe</div>
        <input style={s.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

        <button style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>

        <div style={s.divider}>
          <div style={s.divLine} /><span style={s.divText}>OU</span><div style={s.divLine} />
        </div>

        <button style={s.btnGoogle} onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          Continuer avec Google
        </button>
      </div>
    </div>
  )
}
