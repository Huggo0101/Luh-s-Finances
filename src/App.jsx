import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './Login'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { IconFlower, IconPaint, IconSpray, IconTrash, IconPencil, IconX, IconCheck, IconTrashX } from '@tabler/icons-react';

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
    despesa: "O que foi pago? (ex: Spray, Tinta...)",
    poupanca: "O que vai guardar? 🐷",
    resgate: "O que vai retirar? 🔓"
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

  const dataGrafico = [
    { name: 'Débito/Pix', value: despesasDebito, color: '#4ADE80' },
    { name: 'Crédito', value: despesasCredito, color: '#F87171' },
    { name: 'Guardado', value: poupadoMes, color: '#FB923C' }
  ].filter(d => d.value > 0);

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
    if (confirm("Deseja apagar este registo? 🥺 (Se for parcelado, apagará apenas esta parcela)")) {
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

  // Função para renderizar o gráfico como um lírio
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name, color }) => {
    const RADIAN = Math.PI / 180;
    const radius = 25 + innerRadius + (outerRadius - innerRadius);
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
    return (
      <text x={x} y={y} fill={color} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-black uppercase tracking-widest">
        {name} ({formatarMoeda(value)})
      </text>
    );
  };

  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-stone-900/90 flex flex-col items-center p-3 md:p-10 font-sans pb-20 text-stone-300 selection:bg-teal-700/50">
      
      {/* HEADER E NAVEGAÇÃO */}
      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-10 gap-5 border-b border-teal-800 pb-5">
        <h1 className="text-4xl md:text-5xl font-black text-teal-400 tracking-tighter uppercase style-graffiti-main">Financeiro da Luh</h1>
        
        <div className="flex bg-stone-900 p-2 rounded-2xl border-2 border-teal-800 shadow-xl shadow-teal-900/20 w-full md:w-auto">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${abaAtiva === 'lancamentos' ? 'bg-teal-700 text-stone-900 shadow-lg style-graffiti-tab' : 'text-teal-600 hover:text-teal-400'}`}>Lançamentos</button>
          <button onClick={() => setAbaAtiva('analise')} className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${abaAtiva === 'analise' ? 'bg-teal-700 text-stone-900 shadow-lg style-graffiti-tab' : 'text-teal-600 hover:text-teal-400'}`}>Visão Geral</button>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl w-full mb-10">
        {[
          { label: 'Saldo em Conta', value: saldoConta, color: 'teal' },
          { label: 'Entradas (mês)', value: entradasMes, color: 'emerald' },
          { label: 'Saídas (mês)', value: despesasMes, color: 'rose' },
          { label: 'Poupança Acumulada', value: totalPoupanca, color: 'orange' }
        ].map(card => (
          <div key={card.label} className={`bg-stone-900/80 p-6 rounded-3xl border-l-8 border-${card.color}-600/70 hover:border-${card.color}-400/90 transition-all shadow-xl shadow-${card.color}-900/10`}>
            <p className={`text-[10px] text-${card.color}-400 font-black uppercase mb-1.5 tracking-wider style-graffiti-label`}>{card.label} <IconFlower className="inline size-3" /></p>
            <p className={`text-sm md:text-xl font-black ${card.value >= 0 ? 'text-stone-100' : 'text-rose-400'} style-graffiti-value`}>{formatarMoeda(card.value)}</p>
          </div>
        ))}
      </div>

      {abaAtiva === 'lancamentos' ? (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Formulário */}
          <div className={`bg-stone-900/80 p-8 rounded-[3rem] border-2 shadow-2xl ${editandoId ? 'border-amber-600 shadow-amber-900/30' : 'border-teal-800 shadow-teal-900/20'} h-fit`}>
            <h2 className="text-3xl font-black text-teal-400 mb-8 text-center style-graffiti-form">{editandoId ? 'Editar Registo' : 'Novo Registo'}</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex gap-2.5">
                <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-1/3 p-4 rounded-2xl border border-teal-800 bg-stone-950/40 text-sm font-bold text-teal-500 cursor-pointer focus:border-teal-400" />
                <input required type="text" placeholder={placeholders[tipo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-2/3 p-4 rounded-2xl border border-teal-800 bg-stone-950/40 font-medium text-sm text-stone-100 placeholder-teal-700 focus:border-teal-400" />
              </div>
              <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
                let v = e.target.value.replace(/\D/g, ""); setValor((Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
              }} className="w-full p-5 rounded-2xl border border-teal-800 bg-stone-950/40 font-black text-3xl text-center text-teal-400 placeholder-teal-800 focus:border-teal-400" />
              
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {[
                  { id: 'receita', icon: IconPaint, color: 'emerald' },
                  { id: 'despesa', icon: IconSpray, color: 'rose' },
                  { id: 'poupanca', icon: IconFlower, color: 'orange' },
                  { id: 'resgate', icon: IconX, color: 'amber' }
                ].map(b => (
                  <button key={b.id} type="button" onClick={() => setTipo(b.id)} className={`py-4 flex items-center justify-center gap-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${tipo === b.id ? `bg-${b.color}-600/80 text-stone-950 shadow-lg style-graffiti-btn` : `bg-stone-950 text-${b.color}-500 hover:bg-${b.color}-950 hover:text-${b.color}-300`}`}>
                    <b.icon className="size-4" />
                    {b.id}
                  </button>
                ))}
              </div>

              {tipo === 'despesa' && (
                <>
                  <div className="grid grid-cols-2 gap-2.5 mt-2">
                    <button type="button" onClick={() => setMetodoPagamento('debito')} className={`py-3.5 rounded-xl font-bold text-[10px] border-2 transition-all uppercase tracking-wider ${metodoPagamento === 'debito' ? 'border-teal-600 bg-teal-950/50 text-teal-300 style-graffiti-method' : 'border-stone-800 bg-stone-950/50 text-stone-500 hover:bg-stone-800'}`}>DÉBITO / PIX</button>
                    <button type="button" onClick={() => setMetodoPagamento('credito')} className={`py-3.5 rounded-xl font-bold text-[10px] border-2 transition-all uppercase tracking-wider ${metodoPagamento === 'credito' ? 'border-rose-600 bg-rose-950/50 text-rose-300 style-graffiti-method' : 'border-stone-800 bg-stone-950/50 text-stone-500 hover:bg-stone-800'}`}>CARTÃO CRÉDITO</button>
                  </div>
                  {!editandoId && metodoPagamento === 'credito' && (
                    <div className="flex items-center justify-between bg-stone-950/40 p-3.5 rounded-2xl border border-teal-800 mt-2 transition-all">
                      <span className="text-[11px] font-black text-teal-500 uppercase tracking-wider">Parcelar em:</span>
                      <div className="flex items-center gap-2.5">
                        <input type="number" min="1" max="48" value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-14 p-1.5 rounded-xl border border-teal-800 bg-stone-950/40 text-center font-bold text-stone-100 text-xs focus:border-teal-400" />
                        <span className="text-xs font-bold text-teal-500 style-graffiti-parcel">x</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2.5 mt-5">
                {editandoId && (
                  <button type="button" onClick={cancelarEdicao} className="w-1/3 bg-stone-950 text-stone-400 py-4.5 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-800 transition-all text-xs">Cancelar</button>
                )}
                <button type="submit" disabled={carregando} className={`${editandoId ? 'w-2/3' : 'w-full'} bg-teal-700 text-stone-950 py-4.5 rounded-2xl font-black shadow-lg shadow-teal-950/30 uppercase tracking-widest hover:bg-teal-600 transition-all text-xs style-graffiti-confirm`}>
                  {carregando ? 'A Processar...' : editandoId ? 'Salvar' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>

          {/* Histórico */}
          <div className="bg-stone-900/80 p-8 rounded-[3rem] border-2 border-teal-800 shadow-2xl shadow-teal-900/10 h-fit max-h-[650px] overflow-y-auto style-graffiti-history">
             <div className="flex justify-between items-center mb-7 border-b border-teal-800 pb-5">
                <h3 className="font-black text-teal-500 uppercase text-sm tracking-widest style-graffiti-history-title">Histórico de {formatarMesBR(mesFiltro)}</h3>
                <span className="text-[10px] bg-teal-950 text-teal-300 px-3 py-1.5 rounded-full font-black style-graffiti-history-count">{transacoesDoMes.length}</span>
             </div>
             <div className="space-y-4">
               {transacoesDoMes.length === 0 ? (
                 <p className="text-center text-teal-700 text-xs italic py-12 uppercase tracking-widest font-bold style-graffiti-history-empty">Nada para ver aqui...</p>
               ) : (
                 transacoesDoMes.map(item => (
                   <div key={item.id} className="flex justify-between items-center p-4 bg-stone-950/40 rounded-2xl transition-all hover:bg-stone-800 hover:shadow-xl border border-transparent hover:border-teal-800 style-graffiti-history-item">
                      <div className="flex gap-3.5 items-center overflow-hidden">
                         <div className="flex flex-col sm:flex-row gap-1.5">
                           <button onClick={() => deletarTransacao(item.id)} className="p-1.5 text-stone-600 hover:text-rose-400 transition-colors"><IconTrashX className="size-4" /></button>
                           <button onClick={() => prepararEdicao(item)} className="p-1.5 text-stone-600 hover:text-amber-400 transition-colors"><IconPencil className="size-4" /></button>
                         </div>
                         <div className="flex flex-col min-w-0 ml-1">
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                              <p className="text-xs font-black text-stone-100 leading-none truncate max-w-[120px] style-graffiti-history-desc">{item.descricao}</p>
                              {item.tipo === 'despesa' && item.metodo_pagamento === 'credito' && (
                                <span className="text-[8px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full uppercase font-black tracking-wider border border-rose-800 style-graffiti-history-tag">
                                  {item.total_parcelas > 1 ? `${item.parcela_atual}/${item.total_parcelas} Crédito` : 'Crédito'}
                                </span>
                              )}
                              {item.tipo === 'despesa' && item.metodo_pagamento === 'debito' && (
                                <span className="text-[8px] bg-teal-950 text-teal-300 px-2 py-0.5 rounded-full uppercase font-black tracking-wider border border-teal-800 style-graffiti-history-tag">
                                  Débito/Pix
                               </span>
                              )}
                            </div>
                            <p className="text-[9px] text-teal-600 font-bold uppercase mt-2.5 style-graffiti-history-date">{formatarDataBR(item.data_transacao)}</p>
                         </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-xs font-black ${item.tipo === 'receita' ? 'text-emerald-400' : item.tipo === 'resgate' ? 'text-amber-400' : item.tipo === 'poupanca' ? 'text-orange-400' : 'text-rose-400'} style-graffiti-history-value`}>
                          {item.tipo === 'receita' ? '+' : item.tipo === 'resgate' ? '🔓' : item.tipo === 'poupanca' ? '🐷' : '-'} {formatarMoeda(item.valor)}
                        </p>
                      </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      ) : (
        /* VISÃO GERAL */
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in duration-500">
          <div className="bg-stone-900/80 p-8 md:p-10 rounded-[3rem] border-2 border-teal-800 shadow-2xl shadow-teal-900/10 flex flex-col items-center min-h-[450px]">
            <h3 className="font-black text-teal-500 uppercase text-xs tracking-[0.4em] mb-12 text-center style-graffiti-analise-title">O Lírio dos Teus Gastos ⚜️</h3>
            {dataGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={dataGrafico}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={10}
                    dataKey="value"
                    label={renderCustomizedLabel}
                    labelLine={true}
                  >
                    {dataGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#1C1917" strokeWidth={3} />
                    ))}
                    {/* Elementos centrais para formar o miolo do lírio */}
                    <circle cx="50%" cy="50%" r="65" fill="#FB923C" fillOpacity={0.15} stroke="#FB923C" strokeWidth={1} strokeDasharray="5 5" />
                    <circle cx="50%" cy="50%" r="55" fill="#FACC15" fillOpacity={0.8} />
                    <circle cx="50%" cy="50%" r="10" fill="#CA8A04" />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-4xl font-black text-stone-950 style-graffiti-flower-center">⚜️</text>
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(v)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#52525B' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12">
                 <div className="w-24 h-24 bg-stone-950 rounded-full flex items-center justify-center mb-6 border-2 border-teal-800"><IconFlower className="size-10 text-teal-800" strokeWidth={1.5}/></div>
                 <p className="text-teal-700 text-xs font-bold uppercase tracking-widest style-graffiti-analise-empty">Pinta alguns gastos para florescer o gráfico...</p>
              </div>
            )}
          </div>

          <div className="bg-stone-900/80 p-8 md:p-10 rounded-[3rem] border-2 border-teal-800 shadow-2xl shadow-teal-900/10 flex flex-col justify-between">
            <div>
              <h3 className="font-black text-teal-500 uppercase text-xs mb-8 tracking-[0.3em] style-graffiti-meta-title">Nossa Meta Permanente ⚜️🐷</h3>
              <div className="flex justify-between items-end mb-5">
                 <p className="text-5xl font-black text-teal-400 tracking-tighter style-graffiti-meta-per">{porcentagemMeta}%</p>
                 <div className="text-right">
                    <p className="text-[9px] text-teal-600 font-black uppercase">O Alvo da Luh:</p>
                    <input type="text" value={metaInput} 
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "");
                        setMetaInput(v === "" ? "" : (Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
                      }} 
                      onBlur={(e) => atualizarMetaNoBanco(e.target.value)}
                      className="text-sm font-black text-stone-100 bg-stone-950 px-3 py-1.5 rounded-xl border-none outline-none text-right w-32 focus:ring-2 focus:ring-teal-500 style-graffiti-meta-input" 
                    />
                    <p className="text-[8px] text-stone-500 italic mt-1.5 style-graffiti-meta-save">Salvo automático.</p>
                 </div>
              </div>
              <div className="w-full h-5 bg-stone-950 rounded-full overflow-hidden shadow-inner border border-teal-900">
                 <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-orange-400 transition-all duration-1000 style-graffiti-meta-bar" style={{ width: `${porcentagemMeta}%` }}></div>
              </div>
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-5">
               <div className="bg-emerald-950 p-6 rounded-3xl border border-emerald-800 shadow-xl shadow-emerald-950/20 style-graffiti-meta-box">
                  <p className="text-[9px] text-emerald-300 font-black uppercase tracking-widest mb-1.5">Guardado <IconFlower className="inline size-3"/></p>
                  <p className="text-sm font-black text-emerald-100 style-graffiti-meta-value">{formatarMoeda(poupadoMes)}</p>
               </div>
               <div className="bg-amber-950 p-6 rounded-3xl border border-amber-800 shadow-xl shadow-amber-950/20 style-graffiti-meta-box">
                  <p className="text-[9px] text-amber-300 font-black uppercase tracking-widest mb-1.5">Resgatado 🔓</p>
                  <p className="text-sm font-black text-amber-100 style-graffiti-meta-value">{formatarMoeda(resgatadoMes)}</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <button onClick={() => supabase.auth.signOut()} className="mt-12 text-[10px] font-black text-stone-600 hover:text-teal-400 uppercase tracking-[0.6em] transition-all py-5 px-10 border border-transparent hover:border-teal-900 rounded-full style-graffiti-exit">Sair</button>
    </div>
  )
}

export default App