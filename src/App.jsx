import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './Login'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function App() {
  const [session, setSession] = useState(null)
  const [transacoes, setTransacoes] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('lancamentos') 
  
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().substring(0, 10))
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState('despesa')
  const [metodoPagamento, setMetodoPagamento] = useState('debito')
  const [parcelas, setParcelas] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  // --- NOVA LOGICA DE META PERSISTENTE ---
  const [metaPoupanca, setMetaPoupanca] = useState(2000) 
  const [metaInput, setMetaInput] = useState('R$ 2.000,00')

  const dataAtual = new Date();
  const mesAtualPadrao = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesAtualPadrao);

  const placeholders = {
    receita: "O que entrou? (ex: Salário...)",
    despesa: "O que foi pago? (ex: Mercado...)",
    poupanca: "O que vai guardar?",
    resgate: "O que vai retirar?"
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  // Buscar Transações e Meta do Perfil
  const carregarDadosIniciais = async () => {
    if (!session) return
    
    // 1. Busca Transações
    const { data: tData } = await supabase.from('transacoes').select('*').order('data_transacao', { ascending: false })
    if (tData) setTransacoes(tData)

    // 2. Busca Meta no Perfil
    const { data: pData, error } = await supabase.from('perfis').select('meta_poupanca').eq('id', session.user.id).single()
    
    if (pData) {
      setMetaPoupanca(pData.meta_poupanca)
      setMetaInput(Number(pData.meta_poupanca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
    } else if (error && error.code === 'PGRST116') {
      // Se não existir perfil, cria um agora
      await supabase.from('perfis').insert([{ id: session.user.id, meta_poupanca: 2000 }])
    }
  }

  useEffect(() => { if (session) carregarDadosIniciais() }, [session])

  // --- FUNÇÃO PARA SALVAR META (Persistência) ---
  const atualizarMetaNoBanco = async (novoValor) => {
    const valorNumerico = parseFloat(novoValor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    setMetaPoupanca(valorNumerico)
    await supabase.from('perfis').update({ meta_poupanca: valorNumerico }).eq('id', session.user.id)
  }

  // Sincroniza data com filtro
  useEffect(() => {
    const [ano, mes] = mesFiltro.split('-');
    const hoje = new Date();
    if (mesFiltro === `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`) {
      setDataLancamento(hoje.toISOString().substring(0, 10));
    } else {
      setDataLancamento(`${ano}-${mes}-01`);
    }
  }, [mesFiltro]);

  // Cálculos
  const transacoesDoMes = transacoes.filter(t => t.data_transacao.substring(0, 7) === mesFiltro);
  const transacoesAteMes = transacoes.filter(t => t.data_transacao.substring(0, 7) <= mesFiltro);

  const entradasMes = transacoesDoMes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0)
  const despesasMes = transacoesDoMes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0)
  const poupadoMes = transacoesDoMes.filter(t => t.tipo === 'poupanca').reduce((acc, t) => acc + t.valor, 0)
  const resgatadoMes = transacoesDoMes.filter(t => t.tipo === 'resgate').reduce((acc, t) => acc + t.valor, 0)
  const despesasCredito = transacoesDoMes.filter(t => t.tipo === 'despesa' && t.metodo_pagamento === 'credito').reduce((acc, t) => acc + t.valor, 0)
  const despesasDebito = transacoesDoMes.filter(t => t.tipo === 'despesa' && (t.metodo_pagamento === 'debito' || !t.metodo_pagamento)).reduce((acc, t) => acc + t.valor, 0)

  const receitasAcumuladas = transacoesAteMes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0)
  const despesasAcumuladas = transacoesAteMes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0)
  const poupadoAcumulado = transacoesAteMes.filter(t => t.tipo === 'poupanca').reduce((acc, t) => acc + t.valor, 0)
  const resgatadoAcumulado = transacoesAteMes.filter(t => t.tipo === 'resgate').reduce((acc, t) => acc + t.valor, 0)

  const totalPoupanca = poupadoAcumulado - resgatadoAcumulado;
  const saldoConta = receitasAcumuladas - despesasAcumuladas - poupadoAcumulado + resgatadoAcumulado;

  const porcentagemMeta = metaPoupanca > 0 ? Math.min((totalPoupanca / metaPoupanca) * 100, 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault(); setCarregando(true);
    const valorNum = parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    const [ano, mes, dia] = dataLancamento.split('-');
    
    if (editandoId) {
      const { error } = await supabase.from('transacoes').update({ descricao, valor: valorNum, tipo, metodo_pagamento: tipo === 'despesa' ? metodoPagamento : null, data_transacao: new Date(ano, mes-1, dia, 12).toISOString() }).eq('id', editandoId)
      if (!error) { setEditandoId(null); setDescricao(''); setValor(''); carregarDadosIniciais(); }
    } else {
      const numP = (tipo === 'despesa' && metodoPagamento === 'credito') ? Number(parcelas) : 1;
      const vP = valorNum / numP; const insercoes = [];
      for (let i = 0; i < numP; i++) {
        let d = new Date(ano, mes-1 + i, 1, 12); 
        d.setDate(Math.min(dia, new Date(ano, mes + i, 0).getDate()));
        insercoes.push({ descricao, valor: vP, tipo, metodo_pagamento: tipo === 'despesa' ? metodoPagamento : null, parcela_atual: i + 1, total_parcelas: numP, data_transacao: d.toISOString(), user_id: session.user.id });
      }
      await supabase.from('transacoes').insert(insercoes); setDescricao(''); setValor(''); setParcelas(1); carregarDadosIniciais();
    }
    setCarregando(false)
  }

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatarDataBR = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const formatarMesBR = (m) => { const [y, mon] = m.split('-'); return new Date(y, mon - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase() }

  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-3 md:p-10 font-sans pb-20 text-gray-800">
      
      {/* HEADER */}
      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 w-full md:w-auto">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${abaAtiva === 'lancamentos' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>Lançamentos</button>
          <button onClick={() => setAbaAtiva('analise')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${abaAtiva === 'analise' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>Visão Geral</button>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 w-full md:w-auto justify-between">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{formatarMesBR(mesFiltro)}</span>
          <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-transparent border-none outline-none font-bold text-indigo-600 cursor-pointer text-sm" />
        </div>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl w-full mb-8">
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-indigo-500"><p className="text-[9px] text-gray-400 font-black uppercase mb-1">Saldo em Conta</p><p className="text-sm md:text-lg font-black">{formatarMoeda(saldoConta)}</p></div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-emerald-500"><p className="text-[9px] text-gray-400 font-black uppercase mb-1">Entradas (mês)</p><p className="text-sm md:text-lg font-black text-emerald-600">{formatarMoeda(entradasMes)}</p></div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-rose-500"><p className="text-[9px] text-gray-400 font-black uppercase mb-1">Saídas (mês)</p><p className="text-sm md:text-lg font-black text-rose-600">{formatarMoeda(despesasMes)}</p></div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-sky-500"><p className="text-[9px] text-gray-400 font-black uppercase mb-1">Poupança Acumulada</p><p className="text-sm md:text-lg font-black text-sky-600">{formatarMoeda(totalPoupanca)}</p></div>
      </div>

      {abaAtiva === 'lancamentos' ? (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 h-fit">
            <h2 className="text-xl font-black text-gray-800 mb-6 text-center italic uppercase tracking-tighter">Financeiro da Luh</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-1/3 p-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none text-xs font-bold text-gray-500" />
                <input required type="text" placeholder={placeholders[tipo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-2/3 p-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none" />
              </div>
              <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
                let v = e.target.value.replace(/\D/g, ""); setValor((Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
              }} className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none font-black text-2xl text-center text-indigo-600" />
              <div className="grid grid-cols-2 gap-2">
                {['receita', 'despesa', 'poupanca', 'resgate'].map(t => (
                  <button key={t} type="button" onClick={() => setTipo(t)} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${tipo === t ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>{t}</button>
                ))}
              </div>
              {tipo === 'despesa' && (
                <>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button type="button" onClick={() => setMetodoPagamento('debito')} className={`py-3 rounded-xl font-bold text-[9px] border-2 ${metodoPagamento === 'debito' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-transparent bg-gray-50'}`}>DÉBITO / PIX</button>
                    <button type="button" onClick={() => setMetodoPagamento('credito')} className={`py-3 rounded-xl font-bold text-[9px] border-2 ${metodoPagamento === 'credito' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-transparent bg-gray-50'}`}>CARTÃO CRÉDITO</button>
                  </div>
                  {metodoPagamento === 'credito' && (
                    <div className="flex items-center justify-between bg-orange-50 p-3 rounded-xl border border-orange-100 mt-2">
                      <span className="text-[10px] font-black text-orange-800 uppercase">Parcelar em:</span>
                      <input type="number" min="1" max="48" value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-12 p-1 rounded-lg border border-orange-200 text-center font-bold text-gray-700 text-xs" />
                    </div>
                  )}
                </>
              )}
              <button type="submit" disabled={carregando} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg uppercase tracking-widest hover:bg-indigo-700 transition-all mt-4 text-xs">Confirmar</button>
            </form>
          </div>

          {/* Histórico */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit max-h-[600px] overflow-y-auto">
             <h3 className="font-black text-gray-700 uppercase text-xs mb-6">Histórico de {formatarMesBR(mesFiltro)}</h3>
             <div className="space-y-3">
               {transacoesDoMes.map(item => (
                 <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                    <div>
                       <p className="text-xs font-black text-gray-700 leading-none mb-1">{item.descricao}</p>
                       <p className="text-[9px] text-gray-400 font-bold uppercase">{formatarDataBR(item.data_transacao)}</p>
                    </div>
                    <p className={`text-xs font-black ${item.tipo === 'receita' ? 'text-emerald-500' : 'text-rose-500'}`}>{formatarMoeda(item.valor)}</p>
                 </div>
               ))}
             </div>
          </div>
        </div>
      ) : (
        /* VISÃO GERAL */
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center min-h-[400px]">
            <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-[0.3em] mb-10">Distribuição</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={[ { name: 'Débito', value: despesasDebito, color: '#6366f1' }, { name: 'Crédito', value: despesasCredito, color: '#f43f5e' }, { name: 'Poupança', value: poupadoMes, color: '#0ea5e9' } ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                  {[0,1,2].map((i) => <Cell key={i} fill={['#6366f1', '#f43f5e', '#0ea5e9'][i]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatarMoeda(v)} /><Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-800 uppercase text-xs mb-6 tracking-[0.2em]">Meta de Poupança Permanente</h3>
            <div className="flex justify-between items-end mb-4">
               <p className="text-4xl font-black text-indigo-600">{porcentagemMeta}%</p>
               <div className="text-right">
                  <p className="text-[8px] text-gray-400 font-black uppercase">Sua Meta Fixa:</p>
                  <input type="text" value={metaInput} 
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      const fmt = (Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                      setMetaInput(fmt);
                    }} 
                    onBlur={(e) => atualizarMetaNoBanco(e.target.value)}
                    className="text-sm font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-lg border-none outline-none text-right w-32" 
                  />
                  <p className="text-[7px] text-gray-300 italic mt-1">Salvo automaticamente ao sair do campo</p>
               </div>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
               <div className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-1000" style={{ width: `${porcentagemMeta}%` }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App