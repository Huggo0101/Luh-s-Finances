import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import { Login } from './Login'

function App() {
  const [session, setSession] = useState(null)
  const [transacoes, setTransacoes] = useState([])
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState('despesa')
  const [metodoPagamento, setMetodoPagamento] = useState('debito')
  const [parcelas, setParcelas] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [filtroLista, setFiltroLista] = useState('todos') 
  const [metaExibicao, setMetaExibicao] = useState('R$ 2.000,00')

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

  const transacoesDoMes = transacoes.filter(t => {
    const mesTransacao = t.data_transacao.substring(0, 7);
    return mesTransacao === mesFiltro;
  });

  const entradas = transacoesDoMes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0)
  const despesas = transacoesDoMes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0)
  const poupado = transacoesDoMes.filter(t => t.tipo === 'poupanca').reduce((acc, t) => acc + t.valor, 0)
  const resgatado = transacoesDoMes.filter(t => t.tipo === 'resgate').reduce((acc, t) => acc + t.valor, 0)
  
  const despesasCredito = transacoesDoMes.filter(t => t.tipo === 'despesa' && t.metodo_pagamento === 'credito').reduce((acc, t) => acc + t.valor, 0)
  const despesasDebito = transacoesDoMes.filter(t => t.tipo === 'despesa' && (t.metodo_pagamento === 'debito' || !t.metodo_pagamento)).reduce((acc, t) => acc + t.valor, 0)

  const totalPoupanca = poupado - resgatado
  const saldoDisponivel = entradas - despesas - poupado + resgatado

  const metaCalculo = parseFloat(metaExibicao.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
  const porcentagemMeta = metaCalculo > 0 ? Math.min((totalPoupanca / metaCalculo) * 100, 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCarregando(true)
    
    const valorTotalNumerico = parseFloat(valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim())
    const metodoFinal = tipo === 'despesa' ? metodoPagamento : null;
    
    const numParcelas = (tipo === 'despesa' && metodoPagamento === 'credito') ? Number(parcelas) : 1;
    const valorPorParcela = numParcelas > 1 ? (valorTotalNumerico / numParcelas) : valorTotalNumerico;

    const insercoes = [];

    for (let i = 0; i < numParcelas; i++) {
      const dataParcela = new Date();
      dataParcela.setMonth(dataParcela.getMonth() + i);

      insercoes.push({
        descricao: descricao,
        valor: valorPorParcela,
        tipo: tipo,
        metodo_pagamento: metodoFinal,
        parcela_atual: i + 1,
        total_parcelas: numParcelas,
        data_transacao: dataParcela.toISOString(),
        user_id: session.user.id
      });
    }

    const { error } = await supabase.from('transacoes').insert(insercoes)

    if (!error) { 
      setDescricao(''); 
      setValor(''); 
      setMetodoPagamento('debito'); 
      setParcelas(1); 
      buscarTransacoes() 
    } else {
      console.error(error);
      alert("Erro ao salvar a transação.");
    }
    setCarregando(false)
  }

  const deletarTransacao = async (id) => {
    if (confirm("Deseja apagar este registro? (Se for parcelado, apagará apenas esta parcela)")) {
      const { error } = await supabase.from('transacoes').delete().eq('id', id)
      if (!error) buscarTransacoes()
    }
  }

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const transacoesExibidas = transacoesDoMes.filter(t => {
    if (filtroLista === 'todos') return true;
    if (filtroLista === 'credito') return t.tipo === 'despesa' && t.metodo_pagamento === 'credito';
    if (filtroLista === 'debito') return t.tipo === 'despesa' && (t.metodo_pagamento === 'debito' || !t.metodo_pagamento);
    return true;
  });

  if (!session) return <Login />

  return (
    // Adicionado pb-20 (padding-bottom) para rolagem confortável no celular
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-3 md:p-10 font-sans pb-20 overflow-x-hidden">
      
      {/* SELETOR DE MÊS - Centralizado no celular, à direita no desktop */}
      <div className="max-w-6xl w-full flex justify-center md:justify-end items-center mb-6">
        <div className="bg-white px-4 py-3 md:py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wider">Mês:</span>
          <input 
            type="month" 
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm md:text-base font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer w-full md:w-auto text-center"
          />
        </div>
      </div>

      {/* 1. CARDS DE RESUMO - 2 colunas no celular (grid-cols-2) e 4 no PC (lg:grid-cols-4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl w-full mb-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-indigo-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Saldo Mensal</p>
          <p className={`text-base md:text-xl font-bold truncate ${saldoDisponivel >= 0 ? 'text-gray-800' : 'text-rose-600'}`}>{formatarMoeda(saldoDisponivel)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-emerald-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Entradas</p>
          <p className="text-base md:text-xl font-bold text-emerald-600 truncate">{formatarMoeda(entradas)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-rose-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Saídas</p>
          <p className="text-base md:text-xl font-bold text-rose-600 truncate">{formatarMoeda(despesas)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border-l-4 border-sky-500 flex flex-col justify-center">
          <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">Guardado</p>
          <p className="text-base md:text-xl font-bold text-sky-600 truncate">{formatarMoeda(totalPoupanca)}</p>
        </div>
      </div>

      {/* 2. SEÇÃO DE META FINANCEIRA */}
      <div className="max-w-6xl w-full mb-8 bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base md:text-lg font-black text-gray-800 uppercase tracking-tighter">Meta de Poupança</h2>
            <p className="text-[10px] md:text-xs text-gray-400 font-medium italic">Progresso atual: {porcentagemMeta}%</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 w-full md:w-auto">
            <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase">Objetivo:</span>
            <input 
              type="text" 
              placeholder="R$ 0,00"
              value={metaExibicao} 
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                if (v === "") { setMetaExibicao(""); } 
                else { setMetaExibicao((Number(v) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })); }
              }}
              className="w-full md:w-32 bg-transparent border-none outline-none font-bold text-indigo-600 text-sm"
            />
          </div>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-700 shadow-inner" style={{ width: `${porcentagemMeta}%` }}></div>
        </div>
      </div>

      {/* LAYOUT PRINCIPAL - Colunas no PC, Empilhado no Celular */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        
        {/* 3. FORMULÁRIO */}
        <div className="bg-white p-5 md:p-8 rounded-3xl shadow-xl border border-gray-100 h-fit">
          <h1 className="text-xl md:text-2xl font-black text-gray-800 mb-6 text-center italic">Financeiro da Luh</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              required 
              type="text" 
              placeholder={placeholders[tipo]} 
              value={descricao} 
              onChange={(e) => setDescricao(e.target.value)} 
              className="w-full p-3 md:p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm md:text-base" 
            />
            <input required type="text" placeholder="R$ 0,00" value={valor} onChange={(e) => {
              let val = e.target.value.replace(/\D/g, "")
              setValor((Number(val)/100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}))
            }} className="w-full p-3 md:p-4 rounded-2xl border border-gray-100 bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg md:text-xl text-center" />
            
            {/* Botões ajustados para toque */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipo('receita')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'receita' ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>RECEITA</button>
              <button type="button" onClick={() => setTipo('despesa')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'despesa' ? 'bg-rose-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>DESPESA</button>
              <button type="button" onClick={() => setTipo('poupanca')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'poupanca' ? 'bg-sky-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>GUARDAR</button>
              <button type="button" onClick={() => setTipo('resgate')} className={`py-3 md:py-4 rounded-xl font-bold text-[10px] md:text-xs transition-all ${tipo === 'resgate' ? 'bg-amber-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>RESGATAR</button>
            </div>

            {tipo === 'despesa' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className={`flex items-center justify-center gap-1 md:gap-2 py-3 rounded-xl cursor-pointer font-bold text-[10px] md:text-xs transition-all ${metodoPagamento === 'debito' ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400' : 'bg-gray-50 text-gray-400 border-2 border-transparent hover:bg-gray-100'}`}>
                  <input type="radio" className="hidden" name="pagamento" value="debito" checked={metodoPagamento === 'debito'} onChange={() => setMetodoPagamento('debito')} />
                  DÉBITO / PIX
                </label>
                <label className={`flex items-center justify-center gap-1 md:gap-2 py-3 rounded-xl cursor-pointer font-bold text-[10px] md:text-xs transition-all ${metodoPagamento === 'credito' ? 'bg-orange-100 text-orange-600 border-2 border-orange-400' : 'bg-gray-50 text-gray-400 border-2 border-transparent hover:bg-gray-100'}`}>
                  <input type="radio" className="hidden" name="pagamento" value="credito" checked={metodoPagamento === 'credito'} onChange={() => setMetodoPagamento('credito')} />
                  CRÉDITO
                </label>
              </div>
            )}

            {tipo === 'despesa' && metodoPagamento === 'credito' && (
              <div className="flex flex-col md:flex-row items-center justify-between bg-orange-50 p-3 md:p-4 rounded-xl border border-orange-100 mt-2 gap-3">
                <span className="text-[10px] md:text-xs font-bold text-orange-800 uppercase">Parcelar em:</span>
                <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                  <input 
                    type="number" 
                    min="1" 
                    max="48" 
                    value={parcelas} 
                    onChange={(e) => setParcelas(e.target.value)} 
                    className="w-16 p-2 rounded-lg border border-orange-200 text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-orange-400 text-sm" 
                  />
                  <span className="text-xs font-bold text-orange-600">x</span>
                </div>
              </div>
            )}

            <button type="submit" disabled={carregando} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base md:text-lg hover:bg-indigo-700 transition-all shadow-lg mt-2">
              {carregando ? 'Processando...' : 'Confirmar Lançamento'}
            </button>
          </form>
          <button onClick={() => supabase.auth.signOut()} className="w-full mt-6 text-[10px] text-gray-400 hover:text-rose-500 font-bold tracking-widest uppercase text-center">Sair da Conta</button>
        </div>

        {/* 4. HISTÓRICO AVANÇADO */}
        <div className="w-full flex flex-col h-full">
          
          <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-gray-100 mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-base md:text-lg font-black text-gray-700 uppercase tracking-tighter">
                Lançamentos do Mês
              </h2>
              {/* Botões do filtro permitindo scroll no celular caso a tela seja muito pequena */}
              <div className="flex bg-gray-50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                <button onClick={() => setFiltroLista('todos')} className={`flex-1 sm:flex-none px-3 py-2 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${filtroLista === 'todos' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400'}`}>Todos</button>
                <button onClick={() => setFiltroLista('debito')} className={`flex-1 sm:flex-none px-3 py-2 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${filtroLista === 'debito' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-400'}`}>Débito/Pix</button>
                <button onClick={() => setFiltroLista('credito')} className={`flex-1 sm:flex-none px-3 py-2 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${filtroLista === 'credito' ? 'bg-orange-100 text-orange-600 shadow-sm' : 'text-gray-400'}`}>Crédito</button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 md:gap-4 border-t border-gray-50 pt-3 mt-1">
              <div className="bg-indigo-50/50 p-2 md:p-3 rounded-lg">
                <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">No Débito/Pix</p>
                <p className="text-xs md:text-sm font-bold text-indigo-600 truncate">{formatarMoeda(despesasDebito)}</p>
              </div>
              <div className="bg-orange-50/50 p-2 md:p-3 rounded-lg">
                <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase truncate">No Cartão</p>
                <p className="text-xs md:text-sm font-bold text-orange-600 truncate">{formatarMoeda(despesasCredito)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 md:pr-2">
            {transacoesExibidas.length === 0 ? (
              <p className="text-center text-gray-400 text-xs md:text-sm py-8 italic">Nenhum lançamento neste filtro.</p>
            ) : (
              transacoesExibidas.map((item) => (
                <div key={item.id} className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:border-indigo-100">
                  <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                    <button onClick={() => deletarTransacao(item.id)} className="p-1 md:p-2 text-gray-200 hover:text-rose-500 transition-colors flex-shrink-0" title="Excluir">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                    <div className="flex flex-col min-w-0">
                      {/* flex-wrap garante que os selos desçam de linha se a tela for muito fina */}
                      <div className="flex flex-wrap items-center gap-1 md:gap-2">
                        <p className="font-bold text-gray-700 text-xs md:text-sm leading-tight truncate max-w-[120px] sm:max-w-[200px]">{item.descricao}</p>
                        
                        {item.tipo === 'despesa' && item.metodo_pagamento === 'credito' && (
                          <span className="text-[8px] md:text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider border border-orange-200 whitespace-nowrap">Crédito</span>
                        )}
                        {item.tipo === 'despesa' && item.metodo_pagamento === 'debito' && (
                          <span className="text-[8px] md:text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider border border-indigo-100 whitespace-nowrap">Débito</span>
                        )}
                        {item.total_parcelas > 1 && (
                          <span className="text-[8px] md:text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider border border-gray-200 whitespace-nowrap">
                            {item.parcela_atual}/{item.total_parcelas}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-400 font-medium mt-1">{new Date(item.data_transacao).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className={`font-black text-xs md:text-sm flex-shrink-0 ml-2 ${item.tipo === 'receita' ? 'text-emerald-500' : item.tipo === 'resgate' ? 'text-amber-500' : item.tipo === 'poupanca' ? 'text-sky-500' : 'text-rose-600'}`}>
                    {item.tipo === 'receita' ? '+' : item.tipo === 'resgate' ? '🔓' : item.tipo === 'poupanca' ? '🔒' : '-'} {formatarMoeda(item.valor)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App