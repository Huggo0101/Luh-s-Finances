import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './Login'
// Importação dos componentes do Gráfico
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function App() {
  const [session, setSession] = useState(null)
  const [transacoes, setTransacoes] = useState([])
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
  
  const despesasCredito = transacoesDoMes.filter(t => t.tipo === 'despesa' && t.metodo_pagamento === 'credito').reduce((acc, t) => acc + t.valor, 0)
  const despesasDebito = transacoesDoMes.filter(t => t.tipo === 'despesa' && (t.metodo_pagamento === 'debito' || !t.metodo_pagamento)).reduce((acc, t) => acc + t.valor, 0)

  const receitasAcumuladas = transacoesAteMes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0)
  const despesasAcumuladas = transacoesAteMes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0)
  const poupadoAcumulado = transacoesAteMes.filter(t => t.tipo === 'poupanca').reduce((acc, t) => acc + t.valor, 0)
  const resgatadoAcumulado = transacoesAteMes.filter(t => t.tipo === 'resgate').reduce((acc, t) => acc + t.valor, 0)

  const totalPoupanca = poupadoAcumulado - resgatadoAcumulado;
  const saldoConta = receitasAcumuladas - despesasAcumuladas - poupadoAcumulado + resgatadoAcumulado;

  // --- CONFIGURAÇÃO DO GRÁFICO ---
  const dadosGrafico = [
    { name: 'Débito/Pix', value: despesasDebito, color: '#6366f1' }, // Indigo
    { name: 'Crédito', value: despesasCredito, color: '#f97316' },  // Orange
    { name: 'Guardado', value: poupadoMes, color: '#0ea5e9' }      // Sky
  ].filter(item => item.value > 0); // Só mostra no gráfico o que tiver valor

  const metaCalculo = parseFloat(metaExibicao.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
  const porcentagemMeta = metaCalculo > 0 ? Math.min((totalPoupanca / metaCalculo) * 100, 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCarregando(true)
    const valorTotalNumerico = parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    const metodoFinal = tipo === 'despesa' ? metodoPagamento : null;
    const [anoStr, mesStr, diaStr] = dataLancamento.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10) - 1; 
    const dia = parseInt(diaStr, 10);
    
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
        let ultimoDiaDoMes = new Date(y, m + 1, 0).getDate();
        d.setDate(Math.min(dia, ultimoDiaDoMes)); 
        insercoes.push({
          descricao: descricao, valor: valorPorParcela, tipo: tipo, metodo_pagamento: metodoFinal, parcela_atual: i + 1, total_parcelas: numParcelas, data_transacao: d.toISOString(), user_id: session.user.id
        });
      }
      const { error } = await supabase.from('transacoes').insert(insercoes)
      if (!error) { setDescricao(''); setValor(''); buscarTransacoes(); }
    }
    setCarregando(false)
  }

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-3 md:p-10 font-sans pb-20 overflow-x-hidden">
      
      {/* SELETOR DE MÊS */}
      <div className="max-w-6xl w-full flex justify-center md:justify-end items-center mb-6">
        <div className="bg-white px-4 py-3 md:py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wider">Mês:</span>
          <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm md:text-base font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer w-full md:w-auto text-center" />
        </div>
      </div>

      {/* 1. CARDS DE RESUMO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl w-full mb-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-indigo-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Saldo em Conta</p>
          <p className={`text-base md:text-xl font-bold truncate ${saldoConta >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>{formatarMoeda(saldoConta)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-emerald-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Entradas (Mês)</p>
          <p className="text-base md:text-xl font-bold text-emerald-600 truncate">{formatarMoeda(entradasMes)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-rose-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Saídas (Mês)</p>
          <p className="text-base md:text-xl font-bold text-rose-600 truncate">{formatarMoeda(despesasMes)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-sky-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Poupança Acumulada</p>
          <p className="text-base md:text-xl font-bold text-sky-600 truncate">{formatarMoeda(totalPoupanca)}</p>
        </div>
      </div>

      {/* 2. SEÇÃO DE META E GRÁFICO */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Meta de Poupança */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter">Meta de Poupança</h2>
               <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <input type="text" value={metaExibicao} onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, "");
                    setMetaExibicao(v === "" ? "" : (Number(v)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}));
                  }} className="w-28 bg-transparent border-none outline-none font-bold text-indigo-600 text-xs text-center" />
               </div>
            </div>
            <p className="text-[10px] text-gray-400 font-medium mb-2 italic">Progresso: {porcentagemMeta}%</p>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-700 shadow-inner" style={{ width: `${porcentagemMeta}%` }}></div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
             <p className="text-xs text-indigo-700 font-medium text-center italic">"O sucesso financeiro é a soma de pequenos esforços repetidos dia após dia."</p>
          </div>
        </div>

        {/* Gráfico de Distribuição */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-h-[300px]">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Distribuição de Gastos</h2>
          {dadosGrafico.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={dadosGrafico} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {dadosGrafico.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatarMoeda(value)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-300 text-xs italic text-center py-10">Sem dados para exibir este mês</p>
          )}
        </div>
      </div>

      {/* 3. LAYOUT PRINCIPAL (FORM E HISTÓRICO) */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulário (Mesmo código anterior, apenas adaptado ao novo layout) */}
        <div className={`bg-white p-5 md:p-8 rounded-3xl shadow-xl border h-fit transition-all duration-300 ${editandoId ? 'border-amber-400 ring-4 ring-amber-50' : 'border-gray-100'}`}>
          <h1 className="text-xl md:text-2xl font-black text-gray-800 mb-6 text-center italic">{editandoId ? 'A Editar Registro' : 'Financeiro da Luh'}</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} className="w-1/3 p-3 md:p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs md:text-sm text-gray-500 font-bold cursor-pointer" />
              <input required type="text" placeholder={placeholders[tipo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-2/3 p-3 md:p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm md:text-base" />
            </div>
            <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
              let val = e.target.value.replace(/\D/g, ""); setValor((Number(val)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
            }} className="w-full p-3 md:p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg md:text-xl text-center" />
            
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipo('receita')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'receita' ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>RECEITA</button>
              <button type="button" onClick={() => setTipo('despesa')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'despesa' ? 'bg-rose-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>DESPESA</button>
              <button type="button" onClick={() => setTipo('poupanca')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'poupanca' ? 'bg-sky-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>GUARDAR</button>
              <button type="button" onClick={() => setTipo('resgate')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'resgate' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>RESGATAR</button>
            </div>

            {tipo === 'despesa' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className={`flex items-center justify-center gap-1 md:gap-2 py-3 rounded-xl cursor-pointer font-bold text-[10px] md:text-xs transition-all ${metodoPagamento === 'debito' ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400' : 'bg-gray-50 text-gray-400 border-2 border-transparent'}`}>
                  <input type="radio" className="hidden" name="pagamento" checked={metodoPagamento === 'debito'} onChange={() => setMetodoPagamento('debito')} /> DÉBITO / PIX
                </label>
                <label className={`flex items-center justify-center gap-1 md:gap-2 py-3 rounded-xl cursor-pointer font-bold text-[10px] md:text-xs transition-all ${metodoPagamento === 'credito' ? 'bg-orange-100 text-orange-600 border-2 border-orange-400' : 'bg-gray-50 text-gray-400 border-2 border-transparent'}`}>
                  <input type="radio" className="hidden" name="pagamento" checked={metodoPagamento === 'credito'} onChange={() => setMetodoPagamento('credito')} /> CRÉDITO
                </label>
              </div>
            )}

            <button type="submit" disabled={carregando} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base md:text-lg hover:bg-indigo-700 shadow-lg">
              {carregando ? 'A Processar...' : editandoId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
            </button>
          </form>
        </div>

        {/* Histórico (Código de exibição simplificado por brevidade, mantendo sua funcionalidade anterior) */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 overflow-y-auto max-h-[600px]">
           <h2 className="text-base font-black text-gray-700 uppercase mb-4">Lançamentos do Mês</h2>
           <div className="space-y-3">
             {transacoesDoMes.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                   <span className="text-xs font-bold text-gray-600 truncate max-w-[150px]">{item.descricao}</span>
                   <span className={`text-xs font-black ${item.tipo === 'receita' ? 'text-emerald-500' : 'text-rose-500'}`}>{formatarMoeda(item.valor)}</span>
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  )
}

export default App