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
        alert('Registro feito! Agora você pode fazer login.')
        setIsRegistering(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) { alert(error.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-0 overflow-hidden">
      
      <div className="fixed top-0 left-0 w-full h-full -z-20 overflow-hidden bg-[#e8e2d7] pointer-events-none">
        <img src="/img/papledefundo.jpg" alt="Fundo" className="absolute top-0 left-0 w-full h-full object-cover opacity-60 mix-blend-multiply" />
        <img src="/img/soldouradao.png" alt="Sol" className="absolute top-[1%] left-[1%] w-20 md:w-48" />
        <img src="/img/meialuadourada.png" alt="Lua" className="absolute top-[1%] right-[1%] w-16 md:w-36" />
        <img src="/img/conchaseestrela.png" alt="Conchas" className="absolute w-24 md:w-56" style={{ bottom: '-5px', right: '-5px' }} />
      </div>

      <div className="glass-panel p-8 md:p-14 rounded-[3rem] shadow-2xl w-full max-w-sm md:max-w-md z-10 flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl text-pink-500 font-hesorder text-center mb-2 transform -rotate-2">Olá, Luh!</h1>
        <p className="text-[10px] text-pink-400 font-black uppercase tracking-widest mb-6">
          {isRegistering ? "Crie sua nova conta" : "Entre no seu cofre pessoal"}
        </p>

        <form onSubmit={handleAuth} className="space-y-4 w-full">
          <input type="email" placeholder="Seu E-mail" value={email} required onChange={(e) => setEmail(e.target.value)} className="w-full p-4 rounded-2xl bg-white/60 border border-pink-100 text-sm font-bold outline-none focus:ring-2 focus:ring-pink-300" />
          <input type="password" placeholder="Sua Senha" value={password} required onChange={(e) => setPassword(e.target.value)} className="w-full p-4 rounded-2xl bg-white/60 border border-pink-100 text-sm font-bold outline-none focus:ring-2 focus:ring-pink-300" />
          <button type="submit" disabled={loading} className="w-full bg-pink-500 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-lg transition-all hover:bg-pink-600">
            {loading ? '...' : isRegistering ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <button onClick={() => setIsRegistering(!isRegistering)} className="mt-6 text-[10px] text-pink-600 font-bold uppercase underline decoration-2 underline-offset-4 hover:text-pink-800">
          {isRegistering ? "Já tenho conta? Entrar" : "Não tem conta? Registre-se"}
        </button>
      </div>

      <div className="fixed top-0 left-0 w-full h-full z-50 pointer-events-none overflow-hidden">
        {/* 1º Lírio: No mobile fica no topo direito, no PC volta pra posição original dele */}
        <img src="/img/lirioamarelo.png" alt="Lírio" className="floating-lily absolute w-16 md:w-32 top-[2%] right-[5%] md:top-auto md:right-auto md:bottom-[15%] md:left-[5%]" />
        {/* 2º Lírio: Oculto no mobile, visível no PC */}
        <img src="/img/lirioamarelolindo.png" alt="Lírio" className="floating-lily absolute hidden md:block w-24 md:w-40" style={{bottom: '5%', right: '5%'}} />
      </div>
    </div>
  )
}