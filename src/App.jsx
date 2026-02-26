import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './Login'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

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
    receita: "O que entrou?",
    despesa: "O que foi pago?",
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
    if (confirm("Deseja apagar este registo?")) {
      await supabase.from('transacoes').delete().eq('id', id)
      carregarDadosIniciais()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setCarregando(true);
    const valorNum = parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    const [ano, mes, dia] = dataLancamento.split('-');
    
    if (editandoId) {
      await supabase.from('transacoes').update({ descricao, valor: valorNum, tipo, metodo_pagamento: tipo === 'despesa' ? metodoPagamento : null, data_transacao: new Date(ano, mes-1, dia, 12).toISOString() }).eq('id', editandoId)
      cancelarEdicao(); carregarDadosIniciais();
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
    <div className="min-h-screen flex flex-col items-center p-3 md:p-10 font-sans pb-20 text-gray-800 relative z-0 overflow-x-hidden">
      
      {/* BACKGROUND */}
      <div className="fixed top-0 left-0 w-full h-full -z-20 overflow-hidden bg-[#e8e2d7] pointer-events-none">
        <img src="/img/papledefundo.jpg" alt="Fundo" className="absolute top-0 left-0 w-full h-full object-cover opacity-60 mix-blend-multiply" />
        <img src="/img/marcerto.png" alt="Mar" className="absolute top-0 left-0 h-full w-auto max-w-[40vw] object-cover opacity-90" />
        <img src="/img/soldouradao.png" alt="Sol" className="absolute top-[1%] left-[1%] w-20 md:w-48 drop-shadow-xl" />
        <img src="/img/meialuadourada.png" alt="Lua" className="absolute top-[1%] right-[1%] w-16 md:w-36 drop-shadow-xl" />
        <img src="/img/tonycantri.png" alt="Yin Yang" className="absolute top-[12%] left-[10%] md:top-[18%] md:left-[12%] w-14 md:w-28 drop-shadow-lg" />
        <img src="/img/conchaseestrela.png" alt="Conchas" className="absolute w-24 md:w-56 drop-shadow-xl" style={{ bottom: '-5px', right: '-5px' }} />
      </div>

      <div className="max-w-6xl w-full flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-pink-200/50 pb-5">
        <h1 className="text-4xl md:text-6xl text-pink-500 font-hesorder drop-shadow-md transform -rotate-2">Financeiro da Luh</h1>
        
        <div className="flex glass-panel p-1 rounded-full w-full md:w-auto">
          <button onClick={() => setAbaAtiva('lancamentos')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'lancamentos' ? 'bg-pink-400 text-white shadow-md' : 'text-pink-400 hover:text-pink-600'}`}>Lançamentos</button>
          <button onClick={() => setAbaAtiva('analise')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'analise' ? 'bg-pink-400 text-white shadow-md' : 'text-pink-400 hover:text-pink-600'}`}>Visão Geral</button>
        </div>
      </div>

      {/* FILTRO MÊS DE REFERÊNCIA RESTAURADO */}
      <div className="mb-8 glass-panel py-2 px-6 rounded-full flex items-center gap-4">
        <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Mês Referência:</span>
        <div className="relative">
            <input 
                type="month" 
                value={mesFiltro} 
                onChange={(e) => setMesFiltro(e.target.value)} 
                className="bg-transparent text-pink-600 font-bold text-sm outline-none cursor-pointer"
            />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl w-full mb-8">
        {[
          { label: 'Saldo em Conta', value: saldoConta, color: 'pink' },
          { label: 'Entradas (mês)', value: entradasMes, color: 'emerald' },
          { label: 'Saídas (mês)', value: despesasMes, color: 'rose' },
          { label: 'Poupança Acumulada', value: totalPoupanca, color: 'orange' }
        ].map(card => (
          <div key={card.label} className="glass-panel p-4 md:p-6 rounded-3xl transition-all hover:-translate-y-1 hover:shadow-lg">
            <p className={`text-[8px] md:text-[9px] text-${card.color}-600 font-black uppercase mb-1.5 tracking-widest`}>{card.label}</p>
            <p className={`text-xs md:text-xl font-extrabold ${card.value >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>{formatarMoeda(card.value)}</p>
          </div>
        ))}
      </div>

      {abaAtiva === 'lancamentos' ? (
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          <div className={`glass-panel p-6 md:p-8 rounded-[2rem] border-2 h-fit transition-all duration-300 ${editandoId ? 'border-amber-300' : 'border-transparent'}`}>
            <h2 className="text-3xl md:text-4xl text-pink-500 mb-8 text-center font-hesorder drop-shadow-sm">{editandoId ? 'Editando' : 'Novo Lançamento'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2.5">
                <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-1/3 p-3 md:p-4 rounded-2xl bg-white/60 border border-pink-200 text-[10px] md:text-xs font-bold text-pink-600 outline-none" />
                <input required type="text" placeholder={placeholders[tipo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-2/3 p-3 md:p-4 rounded-2xl bg-white/60 border border-pink-200 font-medium text-xs md:text-sm text-gray-800 outline-none" />
              </div>
              <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
                let v = e.target.value.replace(/\D/g, ""); setValor((Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
              }} className="w-full p-4 md:p-5 rounded-2xl bg-white/60 border border-pink-200 font-extrabold text-2xl md:text-3xl text-center text-pink-600 outline-none" />
              
              <div className="grid grid-cols-2 gap-2 pt-2">
                {['receita', 'despesa', 'poupanca', 'resgate'].map(id => (
                  <button key={id} type="button" onClick={() => setTipo(id)} className={`py-3 md:py-4 rounded-xl font-extrabold text-[9px] md:text-[10px] uppercase tracking-widest transition-all ${tipo === id ? `bg-pink-400 text-white shadow-lg` : `bg-white/50 text-pink-600 border border-pink-200 hover:bg-white`}`}>{id}</button>
                ))}
              </div>

              <div className={`mt-4 ${editandoId ? 'flex gap-2' : ''}`}>
                <button type="submit" disabled={carregando} className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black shadow-xl uppercase tracking-widest text-xs flex-1">
                  {carregando ? '...' : editandoId ? 'Salvar' : 'Confirmar'}
                </button>
                {editandoId && (
                  <button type="button" onClick={cancelarEdicao} className="flex-1 bg-gray-400 text-white py-4 rounded-2xl font-black shadow-xl uppercase tracking-widest text-xs">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="glass-panel p-5 md:p-6 rounded-[2rem] h-fit max-h-[500px] md:max-h-[650px] overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-center mb-6 border-b border-pink-200/50 pb-4">
                <h3 className="text-2xl md:text-3xl text-pink-500 font-hesorder">Histórico {formatarMesBR(mesFiltro)}</h3>
                <span className="text-[10px] bg-pink-100 text-pink-600 px-3 py-1.5 rounded-full font-extrabold">{transacoesDoMes.length}</span>
             </div>
             <div className="space-y-3">
               {transacoesDoMes.map(item => (
                 <div key={item.id} className="flex justify-between items-center p-3 md:p-4 bg-white/60 rounded-2xl border border-white/50">
                    <div className="flex gap-2 items-center">
                       <button onClick={() => deletarTransacao(item.id)} className="p-1 text-pink-400 hover:text-rose-600"><IconTrash/></button>
                       <button onClick={() => prepararEdicao(item)} className="p-1 text-pink-400 hover:text-amber-500"><IconPencil/></button>
                       <div className="flex flex-col ml-1">
                          <p className="text-[10px] md:text-xs font-extrabold text-gray-800">{item.descricao}</p>
                          <p className="text-[8px] md:text-[9px] text-pink-500 font-bold uppercase">{formatarDataBR(item.data_transacao)}</p>
                       </div>
                    </div>
                    <p className={`text-[10px] md:text-xs font-black ${item.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatarMoeda(item.valor)}</p>
                 </div>
               ))}
             </div>
          </div>
        </div>
      ) : (
        /* ABA DE ANÁLISE RESTAURADA COMPLETA */
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in">
           <div className="glass-panel p-8 md:p-10 rounded-[2rem] flex flex-col items-center min-h-[450px]">
            <h3 className="text-3xl text-pink-500 font-hesorder mb-12 text-center">Distribuição</h3>
            {dataGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={dataGrafico} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {dataGrafico.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(v)} />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-pink-400 text-xs font-bold uppercase mt-20">Lance despesas para ver o gráfico</p>}
          </div>

          <div className="glass-panel p-8 md:p-10 rounded-[2rem] flex flex-col justify-between min-h-[450px]">
            <div>
                <h3 className="text-3xl text-pink-500 font-hesorder mb-8">Meta de Poupança</h3>
                <div className="flex justify-between items-end mb-5">
                    <p className="text-5xl font-extrabold text-pink-500 tracking-tighter">{porcentagemMeta}%</p>
                    <div className="text-right">
                        <p className="text-[10px] text-pink-600 font-black uppercase tracking-widest mb-1">Seu Objetivo:</p>
                        <input type="text" value={metaInput} onChange={(e) => setMetaInput(e.target.value)} onBlur={(e) => atualizarMetaNoBanco(e.target.value)} className="text-sm font-bold bg-white/50 px-3 py-1.5 rounded-lg w-32 text-right outline-none border border-pink-100 focus:ring-2 focus:ring-pink-300" />
                    </div>
                </div>
                <div className="w-full h-4 bg-white/50 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-pink-400 transition-all duration-1000" style={{ width: `${porcentagemMeta}%` }}></div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-10">
                <div className="bg-white/40 p-4 rounded-2xl border border-white/60">
                    <p className="text-[9px] text-pink-600 font-black uppercase mb-1">Guardado (mês)</p>
                    <p className="text-lg font-bold">{formatarMoeda(poupadoMes)}</p>
                </div>
                <div className="bg-white/40 p-4 rounded-2xl border border-white/60">
                    <p className="text-[9px] text-amber-600 font-black uppercase mb-1">Resgatado (mês)</p>
                    <p className="text-lg font-bold">{formatarMoeda(resgatadoMes)}</p>
                </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => supabase.auth.signOut()} className="mt-12 text-[9px] font-black text-pink-600 hover:text-pink-800 uppercase tracking-widest py-4 px-8 bg-white/40 hover:bg-white/80 rounded-full shadow-sm transition-all border border-pink-100">
        Sair da Conta
      </button>

      <div className="fixed top-0 left-0 w-full h-full z-50 pointer-events-none overflow-hidden">
        <img src="/img/lirioamarelo.png" alt="Lírio" className="floating-lily absolute w-16 md:w-32" style={{bottom: '15%', left: '5%'}} />
        <img src="/img/liriolindao.png" alt="Lírio" className="floating-lily absolute w-20 md:w-36" style={{top: '40%', right: '2%'}} />
        <img src="/img/lirioamarelolindo.png" alt="Lírio" className="floating-lily absolute w-24 md:w-40" style={{bottom: '8%', right: '8%'}} />
      </div>

    </div>
  )
}

export default App