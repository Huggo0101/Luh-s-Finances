import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './Login'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const IconLily = () => <span className="text-xl">⚜️</span>;
const IconBow = () => <span className="text-xl">🎀</span>;
const IconTrash = () => <span className="text-xs">🗑️</span>;
const IconPencil = () => <span className="text-xs">✏️</span>;

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

  const dataGrafico = [
    { name: 'Débito/Pix', value: despesasDebito, color: '#A5D6A7' }, 
    { name: 'Crédito', value: despesasCredito, color: '#FFAB91' }, 
    { name: 'Guardado', value: poupadoMes, color: '#FFE082' } 
  ].filter(d => d.value > 0);

  // BUG CORRIGIDO AQUI: Remoção do metaExibicao fantasma e uso direto do metaPoupanca
  const porcentagemMeta = metaPoupanca > 0 ? Math.min((totalPoupanca / metaPoupanca) * 100, 100).toFixed(1) : 0;

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
      const numP = (tipo === 'despesa' && metodoPagamento === 'credito' && parcelas) ? Number(parcelas) : 1;
      const vP = valorNum / numP; const insercoes = [];
      for (let i = 0; i < numP; i++) {
        let d = new Date(ano, mes-1 + i, 1, 12); 
        d.setDate(Math.min(dia, new Date(ano, mes-1 + i + 1, 0).getDate()));
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
    <div className="min-h-screen bg-[#FFFBF2] flex flex-col items-center p-3 md:p-10 font-sans pb-20 text-gray-700 selection:bg-pink-100 relative">
      
      {/* CAMADA DE LÍRIOS FLUTUANTES */}
      <div className="lily-background-collage">
        {[...Array(20)].map((_, i) => (
          <span key={i} className="floating-lily" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${10 + Math.random() * 20}s`,
            fontSize: `${1 + Math.random() * 3}rem`,
            color: i % 2 === 0 ? '#FFE082' : '#FFAB91',
            opacity: 0.05 + Math.random() * 0.1
          }}>{i % 3 === 0 ? '⚜️' : '🎀'}</span>
        ))}
      </div>

      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-pink-100 pb-5">
        <h1 className="text-4xl md:text-5xl font-extrabold text-pink-400 tracking-tighter uppercase style-feminine-expressive style-feminine-main">Financeiro da Luh</h1>
        
        <div className="flex bg-white p-1 rounded-full border border-pink-100 shadow-inner w-full md:w-auto">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${abaAtiva === 'lancamentos' ? 'bg-pink-300 text-white shadow-md' : 'text-pink-300 hover:text-pink-500 hover:bg-pink-50'}`}>🎀 Lançamentos</button>
          <button onClick={() => setAbaAtiva('analise')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${abaAtiva === 'analise' ? 'bg-pink-300 text-white shadow-md' : 'text-pink-300 hover:text-pink-500 hover:bg-pink-50'}`}>📊 Visão Geral</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl w-full mb-8">
        {[
          { label: 'Saldo em Conta 💖', value: saldoConta, color: 'pink' },
          { label: 'Entradas (mês) ✨', value: entradasMes, color: 'emerald' },
          { label: 'Saídas (mês) 🛍️', value: despesasMes, color: 'rose' },
          { label: 'Poupança Acumulada 🐷', value: totalPoupanca, color: 'orange' }
        ].map(card => (
          <div key={card.label} className="bg-white p-6 rounded-3xl shadow-sm border border-pink-100 hover:shadow-md transition-all">
            <p className={`text-[9px] text-${card.color}-400 font-black uppercase mb-1.5 tracking-wider style-feminine-expressive style-feminine-label`}>{card.label}</p>
            <p className={`text-sm md:text-xl font-extrabold ${card.value >= 0 ? 'text-gray-700' : 'text-rose-400'}`}>{formatarMoeda(card.value)}</p>
          </div>
        ))}
      </div>

      {abaAtiva === 'lancamentos' ? (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className={`bg-white p-8 rounded-[2rem] border-2 shadow-sm h-fit transition-all duration-300 ${editandoId ? 'border-amber-300 shadow-amber-100' : 'border-pink-100'}`}>
            <h2 className="text-2xl md:text-3xl font-extrabold text-pink-400 mb-8 text-center italic uppercase tracking-tighter style-feminine-expressive style-feminine-title">{editandoId ? 'Editando ✏️' : 'Financeiro da Luh'} <IconBow/></h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2.5">
                <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-1/3 p-4 rounded-2xl border border-pink-100 bg-pink-50/20 text-xs font-bold text-pink-500 focus:border-pink-400 focus:ring-1 focus:ring-pink-300 cursor-pointer" />
                <input required type="text" placeholder={placeholders[tipo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-2/3 p-4 rounded-2xl border border-pink-100 bg-pink-50/20 font-medium text-sm text-gray-700 placeholder-pink-200 focus:border-pink-400 focus:ring-1 focus:ring-pink-300" />
              </div>
              <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
                let v = e.target.value.replace(/\D/g, ""); setValor((Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
              }} className="w-full p-5 rounded-2xl border border-pink-100 bg-pink-50/20 font-extrabold text-3xl text-center text-pink-500 placeholder-pink-100 focus:border-pink-400 focus:ring-1 focus:ring-pink-300 relative" />
              
              <div className="grid grid-cols-2 gap-2.5 pt-2 relative">
                {[
                  { id: 'receita', color: 'emerald', text: 'Receita ✨' },
                  { id: 'despesa', color: 'rose', text: 'Despesa 🛍️' },
                  { id: 'poupanca', color: 'orange', text: 'Guardar 🐷' },
                  { id: 'resgate', color: 'amber', text: 'Resgatar 🔓' }
                ].map(b => (
                  <button key={b.id} type="button" onClick={() => setTipo(b.id)} className={`py-4 rounded-xl font-extrabold text-[10px] uppercase tracking-widest transition-all ${tipo === b.id ? `bg-${b.color}-400 text-white shadow-md style-feminine-btn` : `bg-white text-${b.color}-400 border border-${b.color}-100 hover:bg-${b.color}-50`}`}>
                    {b.text}
                  </button>
                ))}
              </div>

              {tipo === 'despesa' && (
                <>
                  <div className="grid grid-cols-2 gap-2.5 mt-2">
                    <button type="button" onClick={() => setMetodoPagamento('debito')} className={`py-3.5 rounded-xl font-bold text-[10px] border transition-all ${metodoPagamento === 'debito' ? 'bg-pink-300 text-white shadow-sm' : 'bg-white text-pink-300 border-pink-100 hover:bg-pink-50'}`}>DÉBITO / PIX</button>
                    <button type="button" onClick={() => setMetodoPagamento('credito')} className={`py-3.5 rounded-xl font-bold text-[10px] border transition-all ${metodoPagamento === 'credito' ? 'bg-pink-300 text-white shadow-sm' : 'bg-white text-pink-300 border-pink-100 hover:bg-pink-50'}`}>CARTÃO CRÉDITO</button>
                  </div>
                  {!editandoId && metodoPagamento === 'credito' && (
                    <div className="flex items-center justify-between bg-pink-50/30 p-4 rounded-xl border border-pink-100 mt-2 transition-all">
                      <span className="text-[10px] font-extrabold text-pink-600 uppercase">Parcelar em:</span>
                      <div className="flex items-center gap-2.5">
                        <input type="number" min="1" max="48" value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-14 p-1.5 rounded-xl border border-pink-200 text-center font-bold text-gray-700 text-xs focus:border-pink-400" />
                        <span className="text-xs font-bold text-pink-400">x</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <button type="submit" disabled={carregando} className="w-full bg-pink-400 text-white py-4.5 rounded-2xl font-black shadow-lg uppercase tracking-widest hover:bg-pink-500 transition-all mt-4 text-xs">
                {carregando ? 'Processando... ✨' : editandoId ? 'Salvar Alterações 💖' : 'Confirmar Lançamento 💖'}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-pink-100 h-fit max-h-[650px] overflow-y-auto style-feminine-history custom-scrollbar relative">
             <div className="flex justify-between items-center mb-7 border-b border-pink-50 pb-5 relative">
                <h3 className="font-extrabold text-pink-400 uppercase text-xs tracking-wider style-feminine-expressive style-feminine-history-title">Histórico 🎀 {formatarMesBR(mesFiltro)}</h3>
                <span className="text-[10px] bg-pink-50 text-pink-400 px-3 py-1.5 rounded-full font-extrabold">{transacoesDoMes.length}</span>
             </div>
             <div className="space-y-3.5">
               {transacoesDoMes.length === 0 ? (
                 <p className="text-center text-pink-200 text-xs italic py-12 uppercase tracking-widest font-bold relative">Nenhum registo este mês 💕</p>
               ) : (
                 transacoesDoMes.map(item => (
                   <div key={item.id} className="flex justify-between items-center p-4 bg-pink-50/20 rounded-2xl group transition-all hover:bg-white hover:shadow-md border border-transparent hover:border-pink-100 relative">
                      
                      <div className="flex gap-3.5 items-center overflow-hidden">
                         <div className="flex flex-col sm:flex-row gap-1.5">
                           <button onClick={() => deletarTransacao(item.id)} className="p-1 text-pink-100 hover:text-rose-400 transition-colors"><IconTrash/></button>
                           <button onClick={() => prepararEdicao(item)} className="p-1 text-pink-100 hover:text-amber-400 transition-colors"><IconPencil/></button>
                         </div>
                         <div className="flex flex-col min-w-0 ml-1 relative">
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 relative">
                              <p className="text-xs font-extrabold text-gray-700 leading-none truncate max-w-[120px]">{item.descricao}</p>
                              {item.tipo === 'despesa' && item.metodo_pagamento === 'credito' && (
                                <span className="text-[8px] bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full uppercase font-black tracking-wider border border-pink-200">
                                  {item.total_parcelas > 1 ? `${item.parcela_atual}/${item.total_parcelas} Crédito` : 'Crédito'}
                                </span>
                              )}
                              {item.tipo === 'despesa' && item.metodo_pagamento === 'debito' && (
                                <span className="text-[8px] bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full uppercase font-black tracking-wider border border-gray-100">
                                  Débito/Pix
                               </span>
                              )}
                            </div>
                            <p className="text-[9px] text-pink-300 font-bold uppercase mt-2.5">{formatarDataBR(item.data_transacao)}</p>
                         </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-3">
                        <p className={`text-xs font-black ${item.tipo === 'receita' ? 'text-emerald-500' : item.tipo === 'resgate' ? 'text-amber-500' : item.tipo === 'poupanca' ? 'text-purple-500' : 'text-rose-500'} relative`}>
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
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in duration-500">
          <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-sm border border-pink-100 flex flex-col items-center min-h-[450px]">
            <h3 className="font-extrabold text-pink-400 uppercase text-xs tracking-[0.4em] mb-12 text-center style-feminine-expressive style-feminine-analise-title">Distribuição de Gastos 💕</h3>
            {dataGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie data={dataGrafico} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                    {dataGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={3} />
                    ))}
                    <circle cx="50%" cy="50%" r="65" fill="#FFE082" fillOpacity={0.4} stroke="#FFE082" strokeWidth={1} strokeDasharray="3 3" />
                    <circle cx="50%" cy="50%" r="55" fill="#fff" />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-extrabold text-gray-700">⚜️</text>
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(v)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12 relative">
                 <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mb-6 border-2 border-pink-100 relative"><IconLily/></div>
                 <p className="text-pink-300 text-xs font-bold uppercase tracking-widest leading-relaxed relative">Lance despesas para <br/> gerar o gráfico fofinho</p>
              </div>
            )}
          </div>

          <div className="bg-white p-8 md:p-10 rounded-[2rem] shadow-sm border border-pink-100 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-pink-400 uppercase text-xs mb-8 tracking-[0.2em] style-feminine-expressive style-feminine-meta-title">Meta de Poupança Permanente 🐷💖</h3>
              <div className="flex justify-between items-end mb-5 border-b border-pink-50 pb-5">
                 <p className="text-5xl font-extrabold text-pink-400 tracking-tighter relative">{porcentagemMeta}%</p>
                 <div className="text-right">
                    <p className="text-[9px] text-pink-300 font-black uppercase">Objetivo da Luh:</p>
                    <input type="text" value={metaInput} 
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "");
                        setMetaInput(v === "" ? "" : (Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
                      }} 
                      onBlur={(e) => atualizarMetaNoBanco(e.target.value)}
                      className="text-sm font-extrabold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border-none outline-none text-right w-28 focus:ring-1 focus:ring-pink-300" 
                    />
                 </div>
              </div>
              <div className="w-full h-4 bg-pink-50 rounded-full overflow-hidden shadow-inner relative"><div className="h-full bg-gradient-to-r from-pink-300 via-rose-300 to-pink-400 transition-all duration-1000" style={{ width: `${porcentagemMeta}%` }}></div></div>
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-4 relative">
               <div className="bg-purple-50 p-5 rounded-3xl border border-purple-100 shadow-sm relative">
                  <p className="text-[8px] text-purple-600 font-black uppercase tracking-widest mb-1 relative">Guardado 🐷</p>
                  <p className="text-sm font-black text-purple-700 relative">{formatarMoeda(poupadoMes)}</p>
               </div>
               <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 shadow-sm relative">
                  <p className="text-[8px] text-amber-600 font-black uppercase tracking-widest mb-1 relative">Resgatado 🔓</p>
                  <p className="text-sm font-black text-amber-700 relative">{formatarMoeda(resgatadoMes)}</p>
               </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => supabase.auth.signOut()} className="mt-12 text-[9px] font-black text-pink-300 hover:text-pink-500 uppercase tracking-[0.5em] transition-all py-4 px-8 border border-transparent hover:border-pink-200 rounded-full">Sair da Conta ⚜️</button>
    </div>
  )
}

export default App