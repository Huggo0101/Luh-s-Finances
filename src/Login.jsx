import { useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { IconFlower, IconSpray, IconUserPlus, IconLogin } from '@tabler/icons-react'

export function Login() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Estado para alternar entre Login e Cadastro
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Se estiver no modo de Cadastro
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) {
        alert("Erro ao criar conta: " + error.message)
      } else {
        alert("Conta criada com sucesso! Você já pode acessar.")
        setIsSignUp(false) // Volta para a tela de login
      }
    } 
    // Se estiver no modo de Login
    else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        alert("Erro ao entrar: " + error.message)
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-stone-900/90 flex flex-col items-center justify-center p-4 font-sans selection:bg-teal-700/50">
      
      {/* TÍTULO PRINCIPAL (FORA DA CAIXA) */}
      <div className="mb-10 text-center animate-in fade-in duration-700">
        <h1 className="text-5xl md:text-6xl font-black text-teal-400 tracking-tighter uppercase style-graffiti-main mb-3">
          Financeiro da Luh
        </h1>
        <p className="text-teal-600 font-black uppercase tracking-[0.4em] text-xs flex items-center justify-center gap-2">
          <IconFlower className="size-4" /> Arte Financeira <IconSpray className="size-4" />
        </p>
      </div>

      {/* CAIXA DE LOGIN/REGISTO COM MUDANÇA VISUAL NOTÁVEL */}
      <div className={`p-8 md:p-10 rounded-[3rem] border-2 shadow-2xl max-w-sm w-full transition-all duration-500 transform ${isSignUp ? 'bg-stone-900/95 border-rose-600 shadow-rose-900/30 scale-[1.02]' : 'bg-stone-950/80 border-teal-800 shadow-teal-900/30'}`}>
        
        <div className="text-center mb-8 flex flex-col items-center transition-colors duration-500">
          {isSignUp ? <IconUserPlus className="size-12 text-rose-500 mb-3" strokeWidth={1.5} /> : <IconLogin className="size-12 text-teal-500 mb-3" strokeWidth={1.5} />}
          <h2 className={`text-3xl font-black uppercase tracking-widest style-graffiti-form transition-colors duration-500 ${isSignUp ? 'text-rose-400' : 'text-teal-400'}`}>
            {isSignUp ? 'Nova Tag' : 'Acesso'}
          </h2>
          <p className="text-[10px] text-stone-400 mt-2 font-black uppercase tracking-widest style-graffiti-label">
            {isSignUp ? 'Junta-te para gerir as finanças' : 'Aceda ao financeiro da Luh'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 style-graffiti-label transition-colors duration-500 ${isSignUp ? 'text-rose-500' : 'text-teal-600'}`}>
              E-mail
            </label>
            <input
              required
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-4 rounded-2xl border bg-stone-950/60 font-bold text-sm text-stone-100 outline-none transition-all duration-500 ${isSignUp ? 'border-rose-900 focus:border-rose-500 placeholder-rose-900/50' : 'border-teal-900 focus:border-teal-500 placeholder-teal-900/50'}`}
            />
          </div>

          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 style-graffiti-label transition-colors duration-500 ${isSignUp ? 'text-rose-500' : 'text-teal-600'}`}>
              Senha
            </label>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-4 rounded-2xl border bg-stone-950/60 font-bold text-sm text-stone-100 outline-none transition-all duration-500 ${isSignUp ? 'border-rose-900 focus:border-rose-500 placeholder-rose-900/50' : 'border-teal-900 focus:border-teal-500 placeholder-teal-900/50'}`}
            />
            {isSignUp && (
              <p className="text-[9px] text-rose-400/70 mt-2 font-bold uppercase tracking-widest transition-opacity duration-500">Mínimo de 6 caracteres.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-black shadow-lg uppercase tracking-widest transition-all duration-500 text-xs style-graffiti-confirm mt-4 border ${isSignUp ? 'bg-rose-700 text-stone-950 border-rose-500 shadow-rose-900/30 hover:bg-rose-600' : 'bg-teal-700 text-stone-950 border-teal-500 shadow-teal-900/30 hover:bg-teal-600'} disabled:opacity-50`}
          >
            {loading ? 'A processar...' : isSignUp ? 'Cadastrar 🎨' : 'Entrar ⚜️'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-800 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isSignUp ? 'text-stone-500 hover:text-teal-400' : 'text-stone-500 hover:text-rose-400'}`}
          >
            {isSignUp 
              ? 'Já tem uma conta? Entre aqui' 
              : 'Não tem conta? Crie uma agora'}
          </button>
        </div>
      </div>
    </div>
  )
}