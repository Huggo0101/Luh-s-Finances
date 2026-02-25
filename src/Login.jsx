import { useState } from 'react'
import { supabase } from './lib/supabaseClient'

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            {isSignUp ? 'Criar Conta' : 'Boas-vindas'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {isSignUp ? 'Cadastre-se para gerir as finanças' : 'Aceda ao financeiro da Luh'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              E-mail
            </label>
            <input
              required
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Senha
            </label>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {isSignUp && (
              <p className="text-[10px] text-gray-400 mt-1">Mínimo de 6 caracteres.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processando...' : isSignUp ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
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