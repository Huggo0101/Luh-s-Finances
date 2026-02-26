import { useState } from 'react'
import { supabase } from './lib/supabaseClient'

export function Login() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Registro feito! Pode fazer login agora.')
        setIsRegistering(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) { alert(error.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-0 overflow-hidden">
      
      {/* BACKGROUND RESPONSIVO */}
      <div className="fixed top-0 left-0 w-full h-full -z-20 overflow-hidden bg-[#e8e2d7] pointer-events-none">
        <img src="/img/papledefundo.jpg" alt="Fundo" className="absolute top-0 left-0 w-full h-full object-cover opacity-60 mix-blend-multiply" />
        <img src="/img/soldouradao.png" alt="Sol" className="absolute top-[1%] left-[1%] w-20 md:w-48" />
        <img src="/img/meialuadourada.png" alt="Lua" className="absolute top-[1%] right-[1%] w-16 md:w-36" />
        <img src="/img/conchaseestrela.png" alt="Conchas" className="absolute w-24 md:w-56" style={{ bottom: '-5px', right: '-5px' }} />
      </div>

      <div className="glass-panel p-8 md:p-14 rounded-[3rem] shadow-2xl w-full max-w-sm md:max-w-md z-10">
        <h1 className="text-4xl md:text-6xl text-pink-500 font-hesorder text-center mb-2 transform -rotate-2">Olá, Luh!</h1>
        <form onSubmit={handleAuth} className="space-y-4 mt-6">
          <input type="email" placeholder="E-mail" value={email} required onChange={(e) => setEmail(e.target.value)} className="w-full p-4 rounded-2xl bg-white/60 border border-pink-200 text-sm font-bold outline-none" />
          <input type="password" placeholder="Senha" value={password} required onChange={(e) => setPassword(e.target.value)} className="w-full p-4 rounded-2xl bg-white/60 border border-pink-200 text-sm font-bold outline-none" />
          <button className="w-full bg-pink-500 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-lg">
            {loading ? '...' : isRegistering ? 'Criar' : 'Entrar'}
          </button>
        </form>
      </div>

      {/* LÍRIOS FRONTAIS AFASTADOS NO MOBILE */}
      <div className="fixed top-0 left-0 w-full h-full z-50 pointer-events-none overflow-hidden">
        <img src="/img/lirioamarelo.png" alt="Lírio" className="floating-lily absolute w-16 md:w-32" style={{top: '5%', left: '5%'}} />
        <img src="/img/lirioamarelolindo.png" alt="Lírio" className="floating-lily absolute w-24 md:w-40" style={{bottom: '5%', right: '5%'}} />
      </div>
    </div>
  )
}