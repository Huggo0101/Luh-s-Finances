import { useState } from 'react'
import { supabase } from './lib/supabaseClient'

export function Login() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
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
    } catch (error) {
      alert(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-0">
      
      {/* BACKGROUND COLAGEM EXATA PARA O LOGIN TAMBÉM */}
      <div className="fixed top-0 left-0 w-full h-full -z-20 overflow-hidden bg-[#e8e2d7]">
        <img src="/img/papledefundo.jpg" alt="Fundo" className="absolute top-0 left-0 w-full h-full object-cover opacity-60 mix-blend-multiply" />
        <img src="/img/marcerto.png" alt="Mar" className="absolute top-0 left-0 h-full w-auto max-w-[40vw] object-cover opacity-90" />
        <img src="/img/areiadapraia.png" alt="Areia" className="absolute bottom-0 right-0 h-auto w-[50vw] max-w-[600px] opacity-90" />
        <img src="/img/soldouradao.png" alt="Sol" className="absolute top-[5%] left-[5%] w-32 md:w-48 drop-shadow-xl" />
        <img src="/img/meialuadourada.png" alt="Lua" className="absolute top-[5%] right-[5%] w-24 md:w-36 drop-shadow-xl" />
        <img src="/img/tonycantri.png" alt="Yin Yang" className="absolute top-[20%] left-[15%] w-20 md:w-28 drop-shadow-lg" />
        <img src="/img/conchaseestrela.png" alt="Conchas" className="absolute bottom-[5%] right-[5%] w-32 md:w-48 drop-shadow-lg" />
        
        {/* LÍRIOS REAIS FLUTUANTES NO LOGIN */}
        <img src="/img/lirioamarelo.png" alt="Lírio" className="floating-lily lily-1 absolute w-24 md:w-32" style={{top: '25%', left: '35%'}} />
        <img src="/img/lirioamarelolindo.png" alt="Lírio" className="floating-lily lily-2 absolute w-32 md:w-40" style={{top: '55%', right: '25%'}} />
        <img src="/img/liriolindao.png" alt="Lírio" className="floating-lily lily-3 absolute w-28 md:w-36" style={{bottom: '20%', left: '20%'}} />
      </div>

      <div className="glass-panel p-10 md:p-14 rounded-[3rem] shadow-2xl w-full max-w-md border-2 border-white/60 relative overflow-hidden">
        <h1 className="text-5xl text-pink-500 font-hesorder text-center mb-2 drop-shadow-sm transform -rotate-2">Olá, Luh!</h1>
        <p className="text-[10px] text-pink-600 font-black uppercase tracking-[0.2em] text-center mb-8">O seu cofre pessoal</p>
        
        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <input
              type="email"
              placeholder="O seu E-mail"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded-2xl bg-white/60 border border-pink-200 text-sm font-bold text-gray-800 placeholder-pink-400 outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="A sua Senha"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 rounded-2xl bg-white/60 border border-pink-200 text-sm font-bold text-gray-800 placeholder-pink-400 outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>
          <button disabled={loading} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-lg transition-all transform hover:-translate-y-1">
            {loading ? 'Processando...' : isRegistering ? 'Criar Conta' : 'Entrar no Sistema'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs font-bold text-pink-600">
          {isRegistering ? 'Já tem a sua chave?' : 'Ainda não tem acesso?'}
          <button onClick={() => setIsRegistering(!isRegistering)} className="ml-2 text-pink-800 underline decoration-pink-300 decoration-2 underline-offset-4 hover:text-pink-500 transition-colors">
            {isRegistering ? 'Faça Login' : 'Registe-se'}
          </button>
        </p>
      </div>
    </div>
  )
}