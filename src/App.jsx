import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './Login'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function App() {
  const [session, setSession] = useState(null)
  const [transacoes, setTransacoes] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('lancamentos') // 'lancamentos' ou 'analise'
  
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().substring(0, 10))
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState('despesa')
  const [metodoPagamento, setMetodoPagamento] = useState('debito')
  const [parcelas, setParcelas] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [filtroLista, setFiltroLista] = useState('todos') 
  const [metaExibicao, setMetaExibicao] = useState('R$ 2.000,00')
  const [editandoId, setEditandoId] = useState(null)

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

  const buscarTransacoes = async () => {
    if (!session) return
    const { data, error } = await supabase.from('transacoes').select('*').order('data_transacao', { ascending: false })
    if (!error) setTransacoes(data)
  }

  useEffect(() => { if (session) buscarTransacoes() }, [session])

  useEffect(() => {
    const [ano, mes] = mesFiltro.split('-');
    const hoje = new Date();
    const mesAtualReal = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    if (mesFiltro === mesAtualReal) {
      setDataLancamento(hoje.toISOString().substring(0, 10));
    } else {
      setDataLancamento(`${ano}-${mes}-01`);
    }
  }, [mesFiltro]);

  // --- CÁLCULOS ---
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

  // --- DADOS DO GRÁFICO ---
  const dadosGrafico = [
    { name: 'Débito/Pix', value: despesasDebito, color: '#6366f1' },
    { name: 'Crédito', value: despesasCredito, color: '#f43f5e' },
    { name: 'Guardado', value: poupadoMes, color: '#0ea5e9' }
  ].filter(d => d.value > 0);

  const metaCalculo = parseFloat(metaExibicao.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
  const porcentagemMeta = metaCalculo > 0 ? Math.min((totalPoupanca / metaCalculo) * 100, 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCarregando(true)
    const valorTotalNumerico = parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    const metodoFinal = tipo === 'despesa' ? metodoPagamento : null;
    const [anoStr, mesStr, diaStr] = dataLancamento.split('-');
    const ano = parseInt(anoStr, 10); const mes = parseInt(mesStr, 10) - 1; const dia = parseInt(diaStr, 10);
    
    if (editandoId) {
      const dataUpdate = new Date(ano, mes, dia, 12, 0, 0);
      const { error } = await supabase.from('transacoes').update({ 
          descricao, valor: valorTotalNumerico, tipo, metodo_pagamento: metodoFinal, data_transacao: dataUpdate.toISOString()
        }).eq('id', editandoId)
      if (!error) { setEditandoId(null); setDescricao(''); setValor(''); buscarTransacoes(); }
    } else {
      const numParcelas = (tipo === 'despesa' && metodoPagamento === 'credito') ? Number(parcelas) : 1;
      const valorPorParcela = numParcelas > 1 ? (valorTotalNumerico / numParcelas) : valorTotalNumerico;
      const insercoes = [];
      for (let i = 0; i < numParcelas; i++) {
        let m = mes + i; let y = ano + Math.floor(m / 12); m = m % 12; 
        let d = new Date(y, m, 1, 12, 0, 0);
        let ultimoDiaDoMes = new Date(y, m + 1, 0).getDate(); d.setDate(Math.min(dia, ultimoDiaDoMes)); 
        insercoes.push({
          descricao, valor: valorPorParcela, tipo, metodo_pagamento: metodoFinal, parcela_atual: i + 1, total_parcelas: numParcelas, data_transacao: d.toISOString(), user_id: session.user.id
        });
      }
      const { error } = await supabase.from('transacoes').insert(insercoes)
      if (!error) { setDescricao(''); setValor(''); buscarTransacoes(); }
    }
    setCarregando(false)
  }

  const deletarTransacao = async (id) => {
    if (confirm("Deseja apagar este registo?")) {
      const { error } = await supabase.from('transacoes').delete().eq('id', id)
      if (!error) buscarTransacoes()
    }
  }

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-3 md:p-10 font-sans pb-20 overflow-x-hidden">
      
      {/* HEADER E NAVEGAÇÃO */}
      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
          <button 
            onClick={() => setAbaAtiva('lancamentos')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'lancamentos' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Lançamentos
          </button>
          <button 
            onClick={() => setAbaAtiva('analise')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'analise' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Visão Geral
          </button>
        </div>

        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mês Referência:</span>
          <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-transparent border-none outline-none font-bold text-indigo-600 cursor-pointer" />
        </div>
      </div>

      {/* CARDS DE RESUMO (Sempre visíveis) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl w-full mb-8">
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-indigo-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Saldo Livre</p>
          <p className={`text-sm md:text-lg font-black ${saldoConta >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>{formatarMoeda(saldoConta)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-emerald-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Receitas</p>
          <p className="text-sm md:text-lg font-black text-emerald-600">{formatarMoeda(entradasMes)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-rose-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Despesas</p>
          <p className="text-sm md:text-lg font-black text-rose-600">{formatarMoeda(despesasMes)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-sky-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Poupança Total</p>
          <p className="text-sm md:text-lg font-black text-sky-600">{formatarMoeda(totalPoupanca)}</p>
        </div>
      </div>

      {/* CONTEÚDO DINÂMICO POR ABA */}
      {abaAtiva === 'lancamentos' ? (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className={`bg-white p-6 md:p-8 rounded-3xl shadow-xl border h-fit ${editandoId ? 'border-amber-400' : 'border-gray-100'}`}>
            <h2 className="text-xl font-black text-gray-800 mb-6 text-center italic">{editandoId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-1/3 p-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none text-xs font-bold text-gray-500" />
                <input required type="text" placeholder={placeholders[tipo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-2/3 p-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none" />
              </div>
              <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
                let v = e.target.value.replace(/\D/g, ""); setValor((Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
              }} className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none font-black text-2xl text-center text-indigo-600" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTipo('receita')} className={`py-3 rounded-xl font-bold text-[10px] ${tipo === 'receita' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>RECEITA</button>
                <button type="button" onClick={() => setTipo('despesa')} className={`py-3 rounded-xl font-bold text-[10px] ${tipo === 'despesa' ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-400'}`}>DESPESA</button>
              </div>
              {tipo === 'despesa' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button type="button" onClick={() => setMetodoPagamento('debito')} className={`py-3 rounded-xl font-bold text-[10px] border-2 ${metodoPagamento === 'debito' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-transparent bg-gray-50 text-gray-400'}`}>DÉBITO / PIX</button>
                  <button type="button" onClick={() => setMetodoPagamento('credito')} className={`py-3 rounded-xl font-bold text-[10px] border-2 ${metodoPagamento === 'credito' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-transparent bg-gray-50 text-gray-400'}`}>CRÉDITO</button>
                </div>
              )}
              <button type="submit" disabled={carregando} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg uppercase tracking-widest hover:bg-indigo-700 transition-all">
                {carregando ? 'A Processar...' : 'Confirmar'}
              </button>
            </form>
          </div>

          {/* Histórico */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit max-h-[600px] overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-gray-700 uppercase text-sm">Histórico do Mês</h3>
                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-full font-bold text-gray-400">{transacoesDoMes.length} itens</span>
             </div>
             <div className="space-y-3">
               {transacoesDoMes.length === 0 ? (
                 <p className="text-center text-gray-300 text-xs italic py-10">Nenhum lançamento encontrado.</p>
               ) : (
                 transacoesDoMes.map(item => (
                   <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl group transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100">
                      <div className="flex gap-3 items-center">
                         <button onClick={() => deletarTransacao(item.id)} className="text-gray-200 hover:text-rose-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button>
                         <div>
                            <p className="text-xs font-bold text-gray-700 leading-none mb-1">{item.descricao}</p>
                            <p className="text-[9px] text-gray-400 font-medium uppercase">{new Date(item.data_transacao).toLocaleDateString('pt-BR')}</p>
                         </div>
                      </div>
                      <span className={`text-xs font-black ${item.tipo === 'receita' ? 'text-emerald-500' : 'text-rose-500'}`}>{item.tipo === 'receita' ? '+' : '-'} {formatarMoeda(item.valor)}</span>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      ) : (
        /* ABA DE ANÁLISE / VISÃO GERAL */
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Gráfico de Distribuição */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center min-h-[400px]">
            <h3 className="font-black text-gray-400 uppercase text-xs tracking-widest mb-10 text-center">Para onde vai o dinheiro?</h3>
            {dadosGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={dadosGrafico} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                    {dadosGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(v)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                 <p className="text-gray-300 text-sm italic">O gráfico aparecerá assim que houver <br/> despesas ou poupança em {mesFiltro}.</p>
              </div>
            )}
          </div>

          {/* Meta de Poupança Detalhada */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="font-black text-gray-800 uppercase text-sm mb-6 tracking-tighter">Meta de Poupança Acumulada</h3>
              <div className="flex justify-between items-end mb-4">
                 <p className="text-3xl font-black text-indigo-600">{porcentagemMeta}%</p>
                 <div className="text-right">
                    <p className="text-[9px] text-gray-400 font-black uppercase">Objetivo final:</p>
                    <input type="text" value={metaExibicao} onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, ""); setMetaExibicao(v === "" ? "" : (Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
                    }} className="text-sm font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded-lg border-none outline-none text-right" />
                 </div>
              </div>
              <div className="w-full h-6 bg-gray-100 rounded-full overflow-hidden p-1 shadow-inner">
                 <div className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full transition-all duration-1000" style={{ width: `${porcentagemMeta}%` }}></div>
              </div>
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-4">
               <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[8px] text-emerald-600 font-black uppercase">Guardado (Mês)</p>
                  <p className="text-sm font-black text-emerald-700">{formatarMoeda(poupadoMes)}</p>
               </div>
               <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[8px] text-amber-600 font-black uppercase">Resgatado (Mês)</p>
                  <p className="text-sm font-black text-amber-700">{formatarMoeda(resgatadoMes)}</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <button onClick={() => supabase.auth.signOut()} className="mt-12 text-[9px] font-black text-gray-300 hover:text-rose-500 uppercase tracking-[0.3em] transition-all">Sair da Conta</button>
    </div>
  )
}

export default App