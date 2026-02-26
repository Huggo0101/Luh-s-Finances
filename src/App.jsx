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

  const carregarDadosIniciais = async () => {
    if (!session) return
    const { data: tData } = await supabase.from('transacoes').select('*').order('data_transacao', { ascending: false })
    if (tData) setTransacoes(tData)

    const { data: pData, error } = await supabase.from('perfis').select('meta_poupanca').eq('id', session.user.id).single()
    if (pData) {
      setMetaPoupanca(pData.meta_poupanca)
      setMetaInput(Number(pData.meta_poupanca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
    } else if (error && error.code === 'PGRST116') {
      await supabase.from('perfis').insert([{ id: session.user.id, meta_poupanca: 2000 }])
    }
  }

  useEffect(() => { if (session) carregarDadosIniciais() }, [session])

  const atualizarMetaNoBanco = async (novoValor) => {
    const valorNumerico = parseFloat(novoValor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    setMetaPoupanca(valorNumerico)
    await supabase.from('perfis').update({ meta_poupanca: valorNumerico }).eq('id', session.user.id)
  }

  useEffect(() => {
    const [ano, mes] = mesFiltro.split('-');
    const hoje = new Date();
    if (mesFiltro === `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`) {
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

  const porcentagemMeta = metaPoupanca > 0 ? Math.min((totalPoupanca / metaPoupanca) * 100, 100).toFixed(1) : 0;

  // --- FUNÇÕES DE EDIÇÃO E EXCLUSÃO ---
  const prepararEdicao = (item) => {
    setEditandoId(item.id);
    setDescricao(item.descricao);
    setValor(Number(item.valor).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
    setTipo(item.tipo);
    setMetodoPagamento(item.metodo_pagamento || 'debito');
    setParcelas(1);
    if (item.data_transacao) setDataLancamento(item.data_transacao.substring(0, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cancelarEdicao = () => {
    setEditandoId(null);
    setDescricao('');
    setValor('');
    setTipo('despesa');
    setMetodoPagamento('debito');
    setParcelas(1);
    const [ano, mes] = mesFiltro.split('-');
    setDataLancamento(`${ano}-${mes}-01`);
  }

  const deletarTransacao = async (id) => {
    if (confirm("Deseja apagar este registo? (Se for parcelado, apagará apenas esta parcela)")) {
      const { error } = await supabase.from('transacoes').delete().eq('id', id)
      if (!error) carregarDadosIniciais()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setCarregando(true);
    const valorNum = parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    const [ano, mes, dia] = dataLancamento.split('-');
    
    if (editandoId) {
      const { error } = await supabase.from('transacoes').update({ descricao, valor: valorNum, tipo, metodo_pagamento: tipo === 'despesa' ? metodoPagamento : null, data_transacao: new Date(ano, mes-1, dia, 12).toISOString() }).eq('id', editandoId)
      if (!error) { cancelarEdicao(); carregarDadosIniciais(); }
    } else {
      const numP = (tipo === 'despesa' && metodoPagamento === 'credito') ? Number(parcelas) : 1;
      const vP = valorNum / numP; const insercoes = [];
      for (let i = 0; i < numP; i++) {
        let d = new Date(ano, mes-1 + i, 1, 12); 
        d.setDate(Math.min(dia, new Date(ano, mes-1 + i + 1, 0).getDate()));
        insercoes.push({ descricao, valor: vP, tipo, metodo_pagamento: tipo === 'despesa' ? metodoPagamento : null, parcela_atual: i + 1, total_parcelas: numP, data_transacao: d.toISOString(), user_id: session.user.id });
      }
      await supabase.from('transacoes').insert(insercoes); 
      setDescricao(''); setValor(''); setParcelas(1); carregarDadosIniciais();
    }
    setCarregando(false)
  }

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatarDataBR = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const formatarMesBR = (m) => { const [y, mon] = m.split('-'); return new Date(y, mon - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase() }

  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-3 md:p-10 font-sans pb-20 text-gray-800">
      
      {/* HEADER E NAVEGAÇÃO */}
      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 w-full md:w-auto">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${abaAtiva === 'lancamentos' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>Lançamentos</button>
          <button onClick={() => setAbaAtiva('analise')} className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${abaAtiva === 'analise' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>Visão Geral</button>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 w-full md:w-auto justify-between">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{formatarMesBR(mesFiltro)}</span>
          <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-transparent border-none outline-none font-bold text-indigo-600 cursor-pointer text-sm" />
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl w-full mb-8">
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-indigo-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Saldo em Conta</p>
          <p className={`text-sm md:text-lg font-black ${saldoConta >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>{formatarMoeda(saldoConta)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-emerald-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Entradas (mês)</p>
          <p className="text-sm md:text-lg font-black text-emerald-600">{formatarMoeda(entradasMes)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-rose-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Saídas (mês)</p>
          <p className="text-sm md:text-lg font-black text-rose-600">{formatarMoeda(despesasMes)}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border-l-4 border-sky-500">
          <p className="text-[9px] text-gray-400 font-black uppercase mb-1">Poupança Acumulada</p>
          <p className="text-sm md:text-lg font-black text-sky-600">{formatarMoeda(totalPoupanca)}</p>
        </div>
      </div>

      {abaAtiva === 'lancamentos' ? (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário */}
          <div className={`bg-white p-6 md:p-8 rounded-3xl shadow-xl border h-fit transition-all duration-300 ${editandoId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-100'}`}>
            <h2 className="text-xl font-black text-gray-800 mb-6 text-center italic uppercase tracking-tighter">{editandoId ? 'A Editar Registo' : 'Financeiro da Luh'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-1/3 p-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none text-xs font-bold text-gray-500 cursor-pointer" />
                <input required type="text" placeholder={placeholders[tipo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-2/3 p-3 rounded-2xl border border-gray-100 bg-gray-50 outline-none font-medium text-sm" />
              </div>
              <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
                let v = e.target.value.replace(/\D/g, ""); setValor((Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
              }} className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none font-black text-2xl text-center text-indigo-600" />
              
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setTipo('receita')} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tipo === 'receita' ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>Receita</button>
                <button type="button" onClick={() => setTipo('despesa')} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tipo === 'despesa' ? 'bg-rose-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>Despesa</button>
                <button type="button" onClick={() => setTipo('poupanca')} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tipo === 'poupanca' ? 'bg-sky-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>Guardar</button>
                <button type="button" onClick={() => setTipo('resgate')} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tipo === 'resgate' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>Resgatar</button>
              </div>

              {tipo === 'despesa' && (
                <>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button type="button" onClick={() => setMetodoPagamento('debito')} className={`py-3 rounded-xl font-bold text-[9px] border-2 transition-all ${metodoPagamento === 'debito' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-transparent bg-gray-50 text-gray-400'}`}>DÉBITO / PIX</button>
                    <button type="button" onClick={() => setMetodoPagamento('credito')} className={`py-3 rounded-xl font-bold text-[9px] border-2 transition-all ${metodoPagamento === 'credito' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-transparent bg-gray-50 text-gray-400'}`}>CARTÃO CRÉDITO</button>
                  </div>
                  {!editandoId && metodoPagamento === 'credito' && (
                    <div className="flex items-center justify-between bg-orange-50 p-3 rounded-xl border border-orange-100 mt-2 transition-all">
                      <span className="text-[10px] font-black text-orange-800 uppercase">Parcelar em:</span>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" max="48" value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-12 p-1 rounded-lg border border-orange-200 text-center font-bold text-gray-700 text-xs" />
                        <span className="text-xs font-bold text-orange-600">x</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 mt-4">
                {editandoId && (
                  <button type="button" onClick={cancelarEdicao} className="w-1/3 bg-gray-100 text-gray-600 py-4 rounded-2xl font-black shadow-sm uppercase tracking-widest hover:bg-gray-200 transition-all text-[10px] md:text-xs">Cancelar</button>
                )}
                <button type="submit" disabled={carregando} className={`${editandoId ? 'w-2/3' : 'w-full'} bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg uppercase tracking-widest hover:bg-indigo-700 transition-all text-[10px] md:text-xs`}>
                  {carregando ? 'Processando...' : editandoId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>

          {/* Histórico Restituído */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit max-h-[600px] overflow-y-auto">
             <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
                <h3 className="font-black text-gray-700 uppercase text-xs tracking-tighter">Histórico de {formatarMesBR(mesFiltro)}</h3>
                <span className="text-[10px] bg-gray-100 px-2 py-1 rounded-full font-bold text-gray-400">{transacoesDoMes.length}</span>
             </div>
             <div className="space-y-3">
               {transacoesDoMes.length === 0 ? (
                 <p className="text-center text-gray-300 text-xs italic py-10 uppercase tracking-widest font-bold">Nenhum registo este mês</p>
               ) : (
                 transacoesDoMes.map(item => (
                   <div key={item.id} className="flex justify-between items-center p-3 md:p-4 bg-gray-50 rounded-2xl group transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100">
                      
                      <div className="flex gap-3 items-center overflow-hidden">
                         <div className="flex flex-col sm:flex-row gap-1">
                           <button onClick={() => deletarTransacao(item.id)} className="p-1 text-gray-300 hover:text-rose-500 transition-colors flex-shrink-0" title="Excluir">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                           </button>
                           <button onClick={() => prepararEdicao(item)} className="p-1 text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0" title="Editar">
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                           </button>
                         </div>

                         <div className="flex flex-col min-w-0 ml-1">
                            <div className="flex flex-wrap items-center gap-1 md:gap-2">
                              <p className="text-xs font-black text-gray-700 leading-none truncate max-w-[100px] sm:max-w-[160px]">{item.descricao}</p>
                              
                              {/* TAGS RESTAURADAS */}
                              {item.tipo === 'despesa' && item.metodo_pagamento === 'credito' && (
                                <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider border border-orange-200 whitespace-nowrap">
                                  {item.total_parcelas > 1 ? `${item.parcela_atual}/${item.total_parcelas} Crédito` : 'Crédito'}
                                </span>
                              )}
                              {item.tipo === 'despesa' && item.metodo_pagamento === 'debito' && (
                                <span className="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider border border-indigo-100 whitespace-nowrap">
                                  Débito/Pix
                               </span>
                              )}
                            </div>
                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-1.5">{formatarDataBR(item.data_transacao)}</p>
                         </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-2">
                        <p className={`text-xs font-black ${item.tipo === 'receita' ? 'text-emerald-500' : item.tipo === 'resgate' ? 'text-amber-500' : item.tipo === 'poupanca' ? 'text-sky-500' : 'text-rose-600'}`}>
                          {item.tipo === 'receita' ? '+' : item.tipo === 'resgate' ? '🔓' : item.tipo === 'poupanca' ? '🔒' : '-'} {formatarMoeda(item.valor)}
                        </p>
                      </div>

                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      ) : (
        /* ABA DE VISÃO GERAL */
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center min-h-[400px]">
            <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-[0.3em] mb-10 text-center">Análise de Gastos</h3>
            {([despesasDebito, despesasCredito, poupadoMes].some(v => v > 0)) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={[ { name: 'Débito/Pix', value: despesasDebito, color: '#6366f1' }, { name: 'Crédito', value: despesasCredito, color: '#f43f5e' }, { name: 'Guardado', value: poupadoMes, color: '#0ea5e9' } ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value">
                    {([ { name: 'Débito/Pix', value: despesasDebito, color: '#6366f1' }, { name: 'Crédito', value: despesasCredito, color: '#f43f5e' }, { name: 'Guardado', value: poupadoMes, color: '#0ea5e9' } ].filter(d => d.value > 0)).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(v)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-10">
                 <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z"></path></svg></div>
                 <p className="text-gray-300 text-xs font-bold uppercase tracking-widest leading-relaxed">Lance despesas para <br/> gerar o gráfico</p>
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <h3 className="font-black text-gray-800 uppercase text-xs mb-6 tracking-[0.2em]">Meta de Poupança</h3>
              <div className="flex justify-between items-end mb-4">
                 <p className="text-4xl font-black text-indigo-600 tracking-tighter">{porcentagemMeta}%</p>
                 <div className="text-right">
                    <p className="text-[8px] text-gray-400 font-black uppercase">Objetivo da Luh:</p>
                    <input type="text" value={metaInput} 
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "");
                        setMetaInput(v === "" ? "" : (Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
                      }} 
                      onBlur={(e) => atualizarMetaNoBanco(e.target.value)}
                      className="text-sm font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-lg border-none outline-none text-right w-28" 
                    />
                    <p className="text-[7px] text-gray-300 italic mt-1 pr-1">Salvo no Supabase</p>
                 </div>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                 <div className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-400 transition-all duration-1000" style={{ width: `${porcentagemMeta}%` }}></div>
              </div>
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-4">
               <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                  <p className="text-[8px] text-emerald-600 font-black uppercase tracking-widest mb-1">Guardado</p>
                  <p className="text-sm font-black text-emerald-700">{formatarMoeda(poupadoMes)}</p>
               </div>
               <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 shadow-sm">
                  <p className="text-[8px] text-amber-600 font-black uppercase tracking-widest mb-1">Resgatado</p>
                  <p className="text-sm font-black text-amber-700">{formatarMoeda(resgatadoMes)}</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <button onClick={() => supabase.auth.signOut()} className="mt-12 text-[9px] font-black text-gray-300 hover:text-rose-500 uppercase tracking-[0.5em] transition-all py-4 px-8 border border-transparent hover:border-gray-200 rounded-full">Sair da Conta</button>
    </div>
  )
}

export default App