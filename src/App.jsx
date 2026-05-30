import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot } from "recharts";

function calcularSimulacao(parametros) {
  const { patrimonioInicial, aporteMensal, crescimentoAporteAnual, retornoNominalAcumulacao, retornoNominalUsufruto, inflacao, prazoAcumulacao, prazoUsufruto, taxaRetiradaAnual, modoUsufruto } = parametros;
  const dados = [];
  let patrimonioNominal = patrimonioInicial, fatorInflacao = 1, patrimonioReal = patrimonioInicial;
  const txAccMes = Math.pow(1 + retornoNominalAcumulacao, 1/12) - 1;
  const txUsuMes = Math.pow(1 + retornoNominalUsufruto, 1/12) - 1;
  const txInflMes = Math.pow(1 + inflacao, 1/12) - 1;
  const txCrescAporteMes = Math.pow(1 + crescimentoAporteAnual, 1/12) - 1;
  const totalMeses = (prazoAcumulacao + prazoUsufruto) * 12;
  let rendaMensalReal = 0, anoEsgotamento = null, resgateAcum = 0, resgateAcumNom = 0;
  let aporteAtual = aporteMensal, totalInvestido = patrimonioInicial;
  let aporteAcumAnual = 0;
  dados.push({ ano: 0, fase: "Acumulação", patrimonioNominal, patrimonioReal, aporteAnualNominal: 0, aporteMensalNominal: 0, aporteAnualReal: 0, aporteMensalReal: 0, resgateAnualNominal: 0, resgateNominalMensal: 0, resgateAnualReal: 0, rendaMensalReal: 0, totalInvestido, rendimento: 0 });
  for (let mes = 1; mes <= totalMeses; mes++) {
    const ano = Math.floor(mes / 12);
    const emUsufruto = mes > prazoAcumulacao * 12;
    if (!emUsufruto) {
      if (mes > 1 && crescimentoAporteAnual > 0) aporteAtual *= (1 + txCrescAporteMes);
      patrimonioNominal = patrimonioNominal * (1 + txAccMes) + aporteAtual;
      totalInvestido += aporteAtual;
      aporteAcumAnual += aporteAtual;
      fatorInflacao *= 1 + txInflMes;
      patrimonioReal = patrimonioNominal / fatorInflacao;
      if (mes % 12 === 0) {
        const aporteAnualNominal = aporteAcumAnual;
        const aporteAnualReal = aporteAcumAnual / fatorInflacao;
        dados.push({ ano, fase: "Acumulação", patrimonioNominal, patrimonioReal, aporteAnualNominal, aporteMensalNominal: aporteAnualNominal / 12, aporteAnualReal, aporteMensalReal: aporteAnualReal / 12, resgateAnualNominal: 0, resgateNominalMensal: 0, resgateAnualReal: 0, rendaMensalReal: 0, totalInvestido, rendimento: Math.max(0, patrimonioNominal - totalInvestido) });
        aporteAcumAnual = 0;
      }
    } else {
      if (mes === prazoAcumulacao * 12 + 1) { rendaMensalReal = (patrimonioReal * taxaRetiradaAnual) / 12; resgateAcum = 0; resgateAcumNom = 0; }
      if (patrimonioNominal <= 0) { fatorInflacao *= 1 + txInflMes; if (mes % 12 === 0) dados.push({ ano, fase: "Usufruto", patrimonioNominal: 0, patrimonioReal: 0, aporteAnualNominal: 0, aporteMensalNominal: 0, aporteAnualReal: 0, aporteMensalReal: 0, resgateAnualNominal: 0, resgateNominalMensal: 0, resgateAnualReal: 0, rendaMensalReal: 0, totalInvestido, rendimento: 0 }); continue; }
      const retMes = patrimonioNominal * txUsuMes;
      let retNom, retRealMes;
      if (modoUsufruto === "fixa") { retNom = rendaMensalReal * fatorInflacao; retRealMes = rendaMensalReal; }
      else { retNom = patrimonioNominal * (taxaRetiradaAnual / 12); retRealMes = retNom / fatorInflacao; }
      patrimonioNominal = patrimonioNominal + retMes - retNom;
      fatorInflacao *= 1 + txInflMes;
      patrimonioReal = patrimonioNominal / fatorInflacao;
      resgateAcum += retRealMes;
      resgateAcumNom += retNom;
      if (patrimonioNominal <= 0 && !anoEsgotamento) { anoEsgotamento = ano; patrimonioNominal = 0; patrimonioReal = 0; }
      if (mes % 12 === 0) {
        const resgateAnualReal = modoUsufruto === "fixa" ? rendaMensalReal * 12 : resgateAcum;
        const resgateAnualNominal = resgateAcumNom;
        dados.push({ ano, fase: "Usufruto", patrimonioNominal: Math.max(0, patrimonioNominal), patrimonioReal: Math.max(0, patrimonioReal), aporteAnualNominal: 0, aporteMensalNominal: 0, aporteAnualReal: 0, aporteMensalReal: 0, resgateAnualNominal, resgateNominalMensal: resgateAnualNominal / 12, resgateAnualReal, rendaMensalReal: modoUsufruto === "fixa" ? rendaMensalReal : resgateAcum / 12, totalInvestido, rendimento: Math.max(0, patrimonioNominal - totalInvestido) });
        resgateAcum = 0; resgateAcumNom = 0;
      }
    }
  }
  const fimAcc = dados.find(d => d.ano === prazoAcumulacao && d.fase === "Acumulação");
  const inicioUsu = dados.find(d => d.fase === "Usufruto");
  const rendaMensalNominalInicial = inicioUsu?.resgateNominalMensal ?? 0;
  return { dados, resumo: { patrimonioAcumuladoNominal: fimAcc?.patrimonioNominal ?? 0, patrimonioAcumuladoReal: fimAcc?.patrimonioReal ?? 0, rendaMensalRealInicial: inicioUsu?.rendaMensalReal ?? ((fimAcc?.patrimonioReal ?? 0) * taxaRetiradaAnual / 12), rendaMensalNominalInicial, anoEsgotamento, totalInvestido: fimAcc?.totalInvestido ?? 0, rendimento: fimAcc?.rendimento ?? 0 } };
}

function calcularTempoParaMeta({ patrimonioInicial, aporteMensal, crescimentoAporteAnual = 0, retornoNominalAcumulacao, inflacao, taxaRetiradaAnual, rendaMensalDesejada, maxAnos = 80 }) {
  if (taxaRetiradaAnual <= 0 || rendaMensalDesejada <= 0) return null;
  const alvo = (rendaMensalDesejada * 12) / taxaRetiradaAnual;
  const txNomMes = Math.pow(1 + retornoNominalAcumulacao, 1/12) - 1;
  const txInflMes = Math.pow(1 + inflacao, 1/12) - 1;
  const txRealMes = (1 + txNomMes) / (1 + txInflMes) - 1;
  const txCrescMes = Math.pow(1 + crescimentoAporteAnual, 1/12) - 1;
  let pat = patrimonioInicial, fat = 1, aporteAtual = aporteMensal;
  for (let mes = 1; mes <= maxAnos * 12; mes++) {
    if (mes > 1 && crescimentoAporteAnual > 0) aporteAtual *= (1 + txCrescMes);
    fat *= 1 + txInflMes;
    pat = pat * (1 + txRealMes) + aporteAtual / fat;
    if (pat >= alvo) return mes / 12;
  }
  return null;
}

const DEFAULTS = {
  patrimonioInicial: "1.000.000,00", aporteMensal: "55.000,00",
  crescimentoAporteAnual: "0", retornoNominalAcumulacao: "12",
  retornoNominalUsufruto: "10", inflacao: "6",
  idadeAtual: "35", idadeAposentadoria: "55",
  prazoUsufruto: "30", taxaRetiradaAnual: "4", modoUsufruto: "fixa",
  rendaMensalDesejada: "15.000,00",
};

// ─── TEMA UNIFICADO ───────────────────────────────────────────────────────────
const C = {
  bg:       "#0d0d0d",
  surface:  "#141414",
  surface2: "#1c1c1c",
  border:   "#2e2e2e",
  border2:  "#3a3a3a",
  text:     "#f5f3ee",
  muted:    "#c8c4bc",
  muted2:   "#9a9690",
  accent:   "#a3e635",
  accentBg: "rgba(163,230,53,0.07)",
  accentHl: "rgba(163,230,53,0.13)",
  // cores funcionais
  indigo:   "#818cf8",
  emerald:  "#4ade80",
  amber:    "#fbbf24",
  rose:     "#f87171",
  slate:    "#c8c4bc",
  slate2:   "#9a9690",
  white:    "#f5f3ee",
  white2:   "#e8e5de",
  mono:     "'JetBrains Mono', monospace",
  sans:     "'JetBrains Mono', monospace",
};

export default function App() {
  const [parametros, setParametros] = useState(() => {
    try { const s = localStorage.getItem("pf-v3"); return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS; } catch { return DEFAULTS; }
  });
  const [accOpen, setAccOpen] = useState(true);
  const [usuOpen, setUsuOpen] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("graficos");
  const [modoApp, setModoApp] = useState("acumulacao");
  const [modoTabela, setModoTabela] = useState("nominal");
  const [modoGraficos, setModoGraficos] = useState("nominal");
  const [modoGraficosUsu, setModoGraficosUsu] = useState("nominal");
  const [inputFoco, setInputFoco] = useState({});
  const [inputTemp, setInputTemp] = useState({});
  const [modalPdf, setModalPdf] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);

  const [pu, setPu] = useState({
    patrimonio: "3.000.000,00",
    retornoNominal: "10",
    inflacao: "6",
    prazo: "30",
    idadeAtual: "60",
    taxaRetirada: "4",
    modoUsufruto: "fixa",
  });

  useEffect(() => {
    try { localStorage.setItem("pf-v3", JSON.stringify(parametros)); } catch {}
  }, [parametros]);

  const focarCampo = useCallback((campo, valorAtual) => {
    const scrollTop = sidebarRef.current?.scrollTop ?? 0;
    setInputFoco(prev => ({ ...prev, [campo]: true }));
    setInputTemp(prev => ({ ...prev, [campo]: String(valorAtual) }));
    requestAnimationFrame(() => { if (sidebarRef.current) sidebarRef.current.scrollTop = scrollTop; });
  }, []);

  const sairCampoMoeda = useCallback((campo) => {
    setInputFoco(prev => ({ ...prev, [campo]: false }));
    setInputTemp(prev => {
      const num = parseFloat((prev[campo] || "0").replace(",", ".")) || 0;
      setParametros(p => ({ ...p, [campo]: num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
      return prev;
    });
  }, []);

  const limparMoeda = v => !v ? 0 : Number(v.replace(/\./g, "").replace(",", ".")) || 0;
  const limparInteiro = v => parseInt(String(v).replace(/\D/g, "")) || 0;
  const limparPercentual = v => (Number(String(v).replace(",", ".")) || 0) / 100;

  const p = useMemo(() => {
    const idadeAtual = limparInteiro(parametros.idadeAtual);
    const idadeAposentadoria = limparInteiro(parametros.idadeAposentadoria);
    const prazoAcumulacao = Math.max(1, idadeAposentadoria - idadeAtual);
    return {
      patrimonioInicial: limparMoeda(parametros.patrimonioInicial),
      aporteMensal: limparMoeda(parametros.aporteMensal),
      crescimentoAporteAnual: limparPercentual(parametros.crescimentoAporteAnual || "0"),
      retornoNominalAcumulacao: limparPercentual(parametros.retornoNominalAcumulacao),
      retornoNominalUsufruto: limparPercentual(parametros.retornoNominalUsufruto),
      inflacao: limparPercentual(parametros.inflacao),
      idadeAtual, idadeAposentadoria, prazoAcumulacao,
      prazoUsufruto: limparInteiro(parametros.prazoUsufruto),
      taxaRetiradaAnual: limparPercentual(parametros.taxaRetiradaAnual),
      modoUsufruto: parametros.modoUsufruto,
      rendaMensalDesejada: limparMoeda(parametros.rendaMensalDesejada),
    };
  }, [parametros]);

  const { dados, resumo } = calcularSimulacao(p);
  const pico = dados.length > 0 ? dados.reduce((a, b) => b.patrimonioReal > a.patrimonioReal ? b : a) : null;
  const patrimonioNecessarioReal = p.taxaRetiradaAnual > 0 ? (p.rendaMensalDesejada * 12) / p.taxaRetiradaAnual : 0;
  const fatorInflacaoAcumulado = Math.pow(1 + p.inflacao, p.prazoAcumulacao);
  const patrimonioNecessarioNominal = patrimonioNecessarioReal * fatorInflacaoAcumulado;
  const metaAtingida = resumo.patrimonioAcumuladoReal >= patrimonioNecessarioReal;

  const aporteNecessario = useMemo(() => {
    if (p.taxaRetiradaAnual <= 0 || p.rendaMensalDesejada <= 0 || p.prazoAcumulacao <= 0) return null;
    const alvo = (p.rendaMensalDesejada * 12) / p.taxaRetiradaAnual;
    const txNomMes = Math.pow(1 + p.retornoNominalAcumulacao, 1/12) - 1;
    const txInflMes = Math.pow(1 + p.inflacao, 1/12) - 1;
    const txRealMes = (1 + txNomMes) / (1 + txInflMes) - 1;
    const txCrescMes = Math.pow(1 + p.crescimentoAporteAnual, 1/12) - 1;
    const n = p.prazoAcumulacao * 12;
    let low = 0, high = alvo / n * 3, resultado = null;
    for (let iter = 0; iter < 80; iter++) {
      const mid = (low + high) / 2;
      let pat = p.patrimonioInicial, fat = 1, ap = mid;
      for (let mes = 1; mes <= n; mes++) {
        if (mes > 1 && p.crescimentoAporteAnual > 0) ap *= (1 + txCrescMes);
        fat *= 1 + txInflMes;
        pat = pat * (1 + txRealMes) + ap / fat;
      }
      if (pat >= alvo) { resultado = mid; high = mid; } else low = mid;
    }
    return resultado;
  }, [p]);

  const dadosFluxos = useMemo(() => dados.filter(i => i.ano > 0).map(i => ({
    ano: i.ano, fase: i.fase,
    fluxoNominal: i.fase === "Acumulação" ? i.aporteAnualNominal : i.resgateAnualNominal,
    fluxoReal: i.fase === "Acumulação" ? i.aporteAnualReal : i.resgateAnualReal,
    cor: i.fase === "Acumulação" ? C.emerald : C.rose,
  })), [dados]);

  const dadosEmpilhado = useMemo(() => dados.filter(d => d.fase === "Acumulação").map(d => ({
    ano: d.ano, totalInvestido: d.totalInvestido / 1e6, rendimento: d.rendimento / 1e6,
  })), [dados]);

  const dadosRendaMensal = useMemo(() => dados.filter(d => d.fase === "Usufruto").map(d => ({
    ano: d.ano, rendaMensalReal: d.rendaMensalReal, rendaMensalNominal: d.resgateNominalMensal,
  })), [dados]);

  const anosCasoAtual = useMemo(() => calcularTempoParaMeta({ patrimonioInicial: p.patrimonioInicial, aporteMensal: p.aporteMensal, crescimentoAporteAnual: p.crescimentoAporteAnual, retornoNominalAcumulacao: p.retornoNominalAcumulacao, inflacao: p.inflacao, taxaRetiradaAnual: p.taxaRetiradaAnual, rendaMensalDesejada: p.rendaMensalDesejada }), [p]);

  const faixaRenda = useMemo(() => { if (modoApp !== "acumulacao") return { inicio: 1, fim: 2 }; const mil = Math.max(1, Math.round(p.rendaMensalDesejada/1000)); const inicio = Math.max(1, mil-10); return { inicio, fim: Math.max(inicio+20, mil+10) }; }, [p.rendaMensalDesejada, modoApp]);
  const sensibilidadeRenda = useMemo(() => { if (modoApp !== "acumulacao") return []; const arr = []; for (let r = faixaRenda.inicio; r <= faixaRenda.fim; r++) { const anos = calcularTempoParaMeta({ ...p, rendaMensalDesejada: r*1000 }); if (anos !== null) arr.push({ rendaMil: r, anos }); } return arr; }, [p, faixaRenda, modoApp]);
  const faixaAporte = useMemo(() => { if (modoApp !== "acumulacao") return { inicio: 0, fim: 1 }; const mil = Math.max(0, Math.round(p.aporteMensal/1000)); const inicio = Math.max(0, mil-15); return { inicio, fim: Math.max(inicio+25, mil+15) }; }, [p.aporteMensal, modoApp]);
  const sensibilidadeAporte = useMemo(() => { if (modoApp !== "acumulacao") return []; const arr = []; for (let a = faixaAporte.inicio; a <= faixaAporte.fim; a++) { const anos = calcularTempoParaMeta({ ...p, aporteMensal: a*1000 }); if (anos !== null) arr.push({ aporteMil: a, anos }); } return arr; }, [p, faixaAporte, modoApp]);
  const faixaPat = useMemo(() => { if (modoApp !== "acumulacao") return { inicio: 100, fim: 200, passo: 100 }; const mil = Math.max(100, Math.round(p.patrimonioInicial/1000)); const passo = 100; const inicio = Math.max(passo, mil-passo*8); return { inicio, fim: Math.max(inicio+passo*16, mil+passo*8), passo }; }, [p.patrimonioInicial, modoApp]);
  const sensibilidadePat = useMemo(() => { if (modoApp !== "acumulacao") return []; const arr = []; for (let pt = faixaPat.inicio; pt <= faixaPat.fim; pt += faixaPat.passo) { const anos = calcularTempoParaMeta({ ...p, patrimonioInicial: pt*1000 }); if (anos !== null) arr.push({ patrimonioMil: pt, anos }); } return arr; }, [p, faixaPat, modoApp]);

  const resumoDados = useMemo(() => {
    const prazo = anosCasoAtual;
    const patReal = resumo.patrimonioAcumuladoReal;
    const patNominal = resumo.patrimonioAcumuladoNominal;
    const heranca = dados.filter(d => d.fase === "Usufruto").slice(-1)[0]?.patrimonioReal ?? 0;
    const atingeMeta = patReal >= patrimonioNecessarioReal;
    const fmtC = v => v >= 1e6 ? `R$ ${(v/1e6).toFixed(2).replace(".",",")} mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(0)} mil` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
    const fmtB = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
    return { prazo, patReal, patNominal, heranca, atingeMeta, fmtC, fmtB, rendaMensalReal: resumo.rendaMensalRealInicial, rendaMensalNominal: resumo.rendaMensalNominalInicial, rendaMeta: p.rendaMensalDesejada, patNecessarioReal: patrimonioNecessarioReal, patNecessarioNominal: patrimonioNecessarioNominal, anoEsgot: resumo.anoEsgotamento, prazoAcc: p.prazoAcumulacao, prazoUsu: p.prazoUsufruto, idadeAtual: p.idadeAtual, idadeAposentadoria: p.idadeAposentadoria, supereRenda: resumo.rendaMensalRealInicial >= p.rendaMensalDesejada };
  }, [p, resumo, anosCasoAtual, dados, patrimonioNecessarioReal, patrimonioNecessarioNominal]);

  const cenariosUsufruto = useMemo(() => {
    const pat0 = limparMoeda(pu.patrimonio);
    const retNom = (parseFloat(pu.retornoNominal) || 0) / 100;
    const infl = (parseFloat(pu.inflacao) || 0) / 100;
    const prazo = Math.min(parseInt(pu.prazo) || 30, 60);
    const taxaAnual = (parseFloat(pu.taxaRetirada) || 4) / 100;
    const modo = pu.modoUsufruto || "fixa";
    const txMesNom = Math.pow(1 + retNom, 1/12) - 1;
    const txInflMes = Math.pow(1 + infl, 1/12) - 1;
    const meses = prazo * 12;
    const rendaMensalReal = pat0 * taxaAnual / 12;
    const simular = () => {
      const pts = [{ ano: 0, patNominal: pat0, patReal: pat0, retirNominal: 0, retirReal: 0, retirNomMensal: 0, retirRealMensal: 0 }];
      let patNominal = pat0, fatorInfl = 1, rendaReal = rendaMensalReal;
      let retirAcumNom = 0, retirAcumReal = 0;
      let anoEsgotamento = null;
      for (let mes = 1; mes <= meses; mes++) {
        if (patNominal <= 0) { fatorInfl *= 1 + txInflMes; if (mes % 12 === 0) pts.push({ ano: mes/12, patNominal: 0, patReal: 0, retirNominal: 0, retirReal: 0, retirNomMensal: 0, retirRealMensal: 0 }); continue; }
        const rendimento = patNominal * txMesNom;
        let retiradaNom;
        if (modo === "fixa") { retiradaNom = rendaReal * fatorInfl; }
        else { retiradaNom = patNominal * taxaAnual / 12; rendaReal = retiradaNom / fatorInfl; }
        patNominal = patNominal + rendimento - retiradaNom;
        if (patNominal <= 0) { patNominal = 0; if (!anoEsgotamento) anoEsgotamento = Math.ceil(mes / 12); }
        fatorInfl *= 1 + txInflMes;
        const patReal = patNominal / fatorInfl;
        retirAcumNom += retiradaNom;
        retirAcumReal += retiradaNom / fatorInfl;
        if (mes % 12 === 0) {
          pts.push({ ano: mes/12, patNominal, patReal, retirNominal: retirAcumNom, retirReal: retirAcumReal, retirNomMensal: retirAcumNom / 12, retirRealMensal: retirAcumReal / 12 });
          retirAcumNom = 0; retirAcumReal = 0;
        }
      }
      return { pts, anoEsgotamento };
    };
    const { pts: pontos, anoEsgotamento } = simular();
    const ultimo = pontos[pontos.length - 1];
    return { pat0, prazo, rendaMensalReal, pontos, ultimo, taxaAnual, anoEsgotamento };
  }, [pu]);

  const setP = (campo, valor) => setParametros(prev => ({ ...prev, [campo]: valor }));
  const fmtBRL = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v || 0);
  const fmtCpct = v => v >= 1e6 ? `R$ ${(v/1e6).toFixed(2).replace(".",",")} Mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(1).replace(".",",")} K` : fmtBRL(v);
  const fmtMi = v => `${(v/1e6).toFixed(1)}Mi`;

  const exportarCSV = () => {
    const header = "Ano,Fase,Patrimônio Nominal,Patrimônio Real,Aporte Anual Nominal,Resgate Anual Nominal,Resgate Mensal Nominal,Resgate Anual Real,Renda Mensal Real\n";
    const rows = dados.map(d => `${d.ano},${d.fase},${d.patrimonioNominal.toFixed(2)},${d.patrimonioReal.toFixed(2)},${d.aporteAnualNominal.toFixed(2)},${d.resgateAnualNominal.toFixed(2)},${d.resgateNominalMensal.toFixed(2)},${d.resgateAnualReal.toFixed(2)},${d.rendaMensalReal.toFixed(2)}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "simulacao.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── COMPONENTES UI ───────────────────────────────────────────────────────
  const DarkCard = ({ children, style = {} }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", ...style }}>{children}</div>
  );

  const MetricCard = ({ label, value, sub, accent = C.indigo, icon, subColor }) => (
    <DarkCard style={{ minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: C.muted2, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: C.mono, lineHeight: 1.5, flex: 1 }}>{label}</span>
        {icon && <span style={{ fontSize: 13, opacity: 0.5, flexShrink: 0 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: accent, fontFamily: C.mono, letterSpacing: "-0.02em", lineHeight: 1.2, wordBreak: "break-all" }}>{value}</div>
      <div style={{ fontSize: 10, color: subColor || C.muted2, marginTop: 6, fontFamily: C.mono }}>{sub || "\u00A0"}</div>
    </DarkCard>
  );

  const SectionTag = ({ children }) => (
    <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.05em", fontFamily: C.mono, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: C.border2 }}>//</span> {children}
    </div>
  );

  const chartProps = {
    cartesianGrid: { strokeDasharray: "0", horizontal: true, vertical: false, stroke: "rgba(200,196,188,0.06)" },
    xAxis: { tick: { fill: C.muted2, fontSize: 11, fontFamily: C.mono }, axisLine: false, tickLine: false },
    yAxis: { tick: { fill: C.muted2, fontSize: 11, fontFamily: C.mono }, axisLine: false, tickLine: false, width: 72 },
    tooltip: { contentStyle: { background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.text, fontSize: 11, fontFamily: C.mono, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" } },
  };

  const SensChart = ({ title, data, xKey, xLabel, lineColor, currentX, currentY, tipPrefix, fmtX }) => (
    <DarkCard>
      <SectionTag>{title}</SectionTag>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
            <CartesianGrid {...chartProps.cartesianGrid} />
            <XAxis dataKey={xKey} {...chartProps.xAxis} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: C.muted2, fontSize: 10 }} />
            <YAxis {...chartProps.yAxis} label={{ value: "Anos", angle: -90, position: "insideLeft", fill: C.muted2, fontSize: 10 }} />
            <Tooltip formatter={v => [`${Number(v).toFixed(1).replace(".",",")} anos`]} labelFormatter={l => `${tipPrefix}: ${fmtX(l)}`} {...chartProps.tooltip} />
            <ReferenceLine x={currentX} stroke={C.border2} strokeDasharray="4 4" />
            {currentY && <ReferenceDot x={currentX} y={currentY} r={5} fill={C.bg} stroke={lineColor} strokeWidth={2} />}
            <Line type="monotone" dataKey="anos" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: lineColor }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DarkCard>
  );

  const iBase = (campo, focusColor = C.accent) => ({
    width: "100%", padding: "8px 38px 8px 10px",
    background: C.surface2, border: `1px solid ${inputFoco[campo] ? focusColor : C.border2}`,
    borderRadius: 7, color: C.text, fontSize: 13, fontFamily: C.mono, outline: "none",
    boxSizing: "border-box", WebkitAppearance: "none", MozAppearance: "textfield",
    transition: "border-color 0.15s",
  });

  const tabStyle = (aba) => ({
    padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
    fontSize: 11, fontFamily: C.mono, fontWeight: 500, transition: "all 0.15s",
    background: abaAtiva === aba ? C.accent : "transparent",
    color: abaAtiva === aba ? "#000" : C.muted,
  });

  const toggleStyle = (active, activeColor = C.accent) => ({
    padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer",
    fontSize: 11, fontFamily: C.mono, fontWeight: 500, transition: "all 0.15s",
    background: active ? activeColor : "transparent",
    color: active ? (activeColor === C.accent ? "#000" : C.text) : C.muted,
  });

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: C.bg, fontFamily: C.mono, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        input[type=range]::-webkit-slider-thumb { background: ${C.accent}; width:14px; height:14px; border-radius:50%; }
        input[type=range]::-webkit-slider-runnable-track { background: ${C.surface2}; border-radius:4px; height:3px; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius:3px; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        select option { background: ${C.surface2}; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "290px minmax(0,1fr)", height: "100vh", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

          {/* Header sidebar */}
          <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted2, letterSpacing: "0.05em", marginBottom: 3 }}>// planejamento financeiro</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Geraldo Búrigo, CNPI</div>
            </div>
            {/* Toggle modo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, background: C.bg, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
              {[["acumulacao", "acumulação"], ["usufruto", "só usufruto"]].map(([modo, label]) => (
                <button key={modo} onClick={() => { setModoApp(modo); setTimeout(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, 50); }}
                  style={{ padding: "7px 4px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontFamily: C.mono, fontWeight: 500, transition: "all 0.15s",
                    background: modoApp === modo ? C.accent : "transparent",
                    color: modoApp === modo ? "#000" : C.muted }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div ref={sidebarRef} style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>

          {/* ── SIDEBAR USUFRUTO PURO ── */}
          {modoApp === "usufruto" && (
            <div>
              <div style={{ marginBottom: 8, border: `1px solid rgba(74,222,128,0.2)`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "9px 12px", background: "rgba(74,222,128,0.07)", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.emerald, letterSpacing: "0.04em" }}>// fase de usufruto</span>
                </div>
                <div style={{ padding: "12px 12px 6px" }}>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5, letterSpacing: "0.04em" }}>Patrimônio Atual</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.muted2, pointerEvents: "none" }}>R$</span>
                      <input type="text"
                        value={inputFoco["u_patrimonio"] ? (inputTemp["u_patrimonio"] || "") : pu.patrimonio}
                        onFocus={() => { setInputFoco(f => ({...f, u_patrimonio: true})); setInputTemp(t => ({...t, u_patrimonio: String(limparMoeda(pu.patrimonio) || "")})); }}
                        onBlur={() => { setInputFoco(f => ({...f, u_patrimonio: false})); const n = parseFloat((inputTemp["u_patrimonio"]||"0").replace(",","."))||0; setPu(prev => ({...prev, patrimonio: n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})})); }}
                        onChange={e => setInputTemp(t => ({...t, u_patrimonio: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ ...iBase("u_patrimonio", C.emerald), paddingLeft: 30 }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>Idade Atual</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={pu.idadeAtual} min={20} max={100}
                        onChange={e => setPu(prev => ({...prev, idadeAtual: e.target.value}))}
                        style={iBase("u_idade", C.emerald)} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>anos</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>Prazo de Usufruto</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={pu.prazo} min={1} max={60}
                        onChange={e => setPu(prev => ({...prev, prazo: e.target.value}))}
                        style={iBase("u_prazo", C.emerald)} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>anos</span>
                    </div>
                  </div>

                  {[
                    { label: "Retorno Nominal", key: "retornoNominal", min: 0, max: 30 },
                    { label: "Inflação", key: "inflacao", min: 0, max: 20 },
                  ].map(({ label, key, min, max }) => {
                    const raw = parseFloat(pu[key] || "0") || 0;
                    return (
                      <div key={key} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                          <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>{label}</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco[`u_${key}`] ? (inputTemp[`u_${key}`] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(f => ({...f, [`u_${key}`]: true})); setInputTemp(t => ({...t, [`u_${key}`]: String(raw)})); }}
                              onBlur={() => { setInputFoco(f => ({...f, [`u_${key}`]: false})); const n = parseFloat((inputTemp[`u_${key}`]||"0").replace(",",".")); if (!isNaN(n)) setPu(prev => ({...prev, [key]: String(Math.min(max, Math.max(min, n)))})); }}
                              onChange={e => setInputTemp(t => ({...t, [`u_${key}`]: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 64, textAlign: "right", fontSize: 11, color: C.text, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[`u_${key}`] ? C.emerald : C.border}`, borderRadius: 5, padding: "3px 20px 3px 6px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw}
                          onChange={e => setPu(prev => ({...prev, [key]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.emerald, cursor: "pointer", height: 3, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted2, marginTop: 3 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const retNom = parseFloat(pu.retornoNominal || "0") || 0;
                    const infl = parseFloat(pu.inflacao || "0") || 0;
                    const retReal = ((1 + retNom/100) / (1 + infl/100) - 1) * 100;
                    const cor = retReal >= 0 ? C.emerald : C.rose;
                    return (
                      <div style={{ marginBottom: 12, padding: "7px 10px", background: `${cor}10`, borderRadius: 7, border: `1px solid ${cor}25`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Retorno real</span>
                        <span style={{ fontSize: 13, color: cor, fontFamily: C.mono, fontWeight: 600 }}>{retReal >= 0 ? "+" : ""}{retReal.toFixed(2).replace(".",",")}%</span>
                      </div>
                    );
                  })()}

                  {(() => {
                    const raw = parseFloat(pu.taxaRetirada || "4") || 4;
                    return (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                          <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>Taxa de Retirada Anual</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco["u_taxaRetirada"] ? (inputTemp["u_taxaRetirada"] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(f => ({...f, u_taxaRetirada: true})); setInputTemp(t => ({...t, u_taxaRetirada: String(raw)})); }}
                              onBlur={() => { setInputFoco(f => ({...f, u_taxaRetirada: false})); const n = parseFloat((inputTemp["u_taxaRetirada"]||"0").replace(",",".")); if (!isNaN(n)) setPu(prev => ({...prev, taxaRetirada: String(Math.min(20, Math.max(0.5, n)))})); }}
                              onChange={e => setInputTemp(t => ({...t, u_taxaRetirada: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 64, textAlign: "right", fontSize: 11, color: C.text, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco["u_taxaRetirada"] ? C.emerald : C.border}`, borderRadius: 5, padding: "3px 20px 3px 6px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={0.5} max={20} step={0.1} value={raw}
                          onChange={e => setPu(prev => ({...prev, taxaRetirada: e.target.value}))}
                          style={{ width: "100%", accentColor: C.emerald, cursor: "pointer", height: 3, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted2, marginTop: 3 }}>
                          <span>0.5%</span><span>20%</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>Modo de Usufruto</span>
                    <select value={pu.modoUsufruto || "fixa"} onChange={e => setPu(prev => ({...prev, modoUsufruto: e.target.value}))}
                      style={{ width: "100%", padding: "8px 10px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 7, color: C.text, fontSize: 11, fontFamily: C.mono, outline: "none" }}>
                      <option value="fixa">Renda fixa real</option>
                      <option value="variavel">Retirada percentual</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SIDEBAR ACUMULAÇÃO ── */}
          {modoApp === "acumulacao" && (
            <div>
            <div style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <button onClick={() => setAccOpen(!accOpen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: accOpen ? C.surface2 : "transparent", border: "none", cursor: "pointer", color: C.text, fontFamily: C.mono, fontSize: 11, fontWeight: 500 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: C.border2 }}>//</span> fase de acumulação</span>
                <span style={{ color: C.muted2, fontSize: 9, transform: accOpen ? "rotate(180deg)" : "none" }}>▼</span>
              </button>
              {accOpen && (
                <div style={{ padding: "12px 12px 6px" }}>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[["idadeAtual", "Idade atual"], ["idadeAposentadoria", "Aposentadoria"]].map(([campo, label]) => (
                      <div key={campo}>
                        <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>{label}</label>
                        <div style={{ position: "relative" }}>
                          <input type="number" value={parametros[campo]} min={10} max={100}
                            onChange={e => setP(campo, e.target.value)}
                            onFocus={() => setInputFoco(p => ({...p, [campo]: true}))}
                            onBlur={() => setInputFoco(p => ({...p, [campo]: false}))}
                            style={iBase(campo)} />
                          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>a</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 12, padding: "7px 10px", background: C.accentBg, borderRadius: 7, border: `1px solid rgba(163,230,53,0.2)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Prazo de acumulação</span>
                    <span style={{ fontSize: 13, color: C.accent, fontFamily: C.mono, fontWeight: 600 }}>{p.prazoAcumulacao} anos</span>
                  </div>

                  {[["patrimonioInicial", "Patrimônio Inicial"], ["aporteMensal", "Aporte Mensal"], ["rendaMensalDesejada", "Renda Mensal Desejada"]].map(([campo, label]) => (
                    <div key={campo} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>{label}</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.muted2, pointerEvents: "none" }}>R$</span>
                        <input type="text" value={inputFoco[campo] ? (inputTemp[campo] || "") : (parametros[campo] || "")}
                          onFocus={() => { setInputFoco(p => ({...p, [campo]: true})); setInputTemp(p => ({...p, [campo]: String(limparMoeda(parametros[campo]) || "")})); }}
                          onBlur={() => sairCampoMoeda(campo)}
                          onChange={e => setInputTemp(p => ({...p, [campo]: e.target.value.replace(/[^0-9.,]/g,"")}))}
                          style={{ ...iBase(campo), paddingLeft: 30 }} />
                      </div>
                    </div>
                  ))}

                  {[
                    { label: "Crescimento do Aporte", campo: "crescimentoAporteAnual", min: 0, max: 20 },
                    { label: "Retorno Nominal (Acumulação)", campo: "retornoNominalAcumulacao", min: 0, max: 30 },
                    { label: "Inflação", campo: "inflacao", min: 0, max: 20 },
                  ].map(({ label, campo, min, max }) => {
                    const raw = parseFloat((parametros[campo] || "0").replace(",", ".")) || 0;
                    return (
                      <div key={campo} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                          <span style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", flex: 1, whiteSpace: "nowrap" }} title={label}>{label}</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco[campo] ? (inputTemp[campo] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(p => ({...p, [campo]: true})); setInputTemp(p => ({...p, [campo]: String(raw)})); }}
                              onBlur={() => { setInputFoco(p => ({...p, [campo]: false})); const n = parseFloat((inputTemp[campo]||"0").replace(",",".")); if (!isNaN(n)) setParametros(p => ({...p, [campo]: String(Math.min(max, Math.max(min, n)))})); }}
                              onChange={e => setInputTemp(p => ({...p, [campo]: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 64, textAlign: "right", fontSize: 11, color: C.text, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[campo] ? C.accent : C.border}`, borderRadius: 5, padding: "3px 20px 3px 6px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw} onChange={e => setParametros(p => ({...p, [campo]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.accent, cursor: "pointer", height: 3, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted2, marginTop: 3 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const retNom = parseFloat((parametros.retornoNominalAcumulacao || "0").replace(",", ".")) || 0;
                    const infl = parseFloat((parametros.inflacao || "0").replace(",", ".")) || 0;
                    const retReal = ((1 + retNom/100) / (1 + infl/100) - 1) * 100;
                    const cor = retReal >= 0 ? C.emerald : C.rose;
                    return (
                      <div style={{ marginBottom: 12, padding: "7px 10px", background: `${cor}10`, borderRadius: 7, border: `1px solid ${cor}25`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Retorno real (acumulação)</span>
                        <span style={{ fontSize: 13, color: cor, fontFamily: C.mono, fontWeight: 600 }}>{retReal >= 0 ? "+" : ""}{retReal.toFixed(2).replace(".", ",")}%</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* USUFRUTO */}
            <div style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <button onClick={() => setUsuOpen(!usuOpen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: usuOpen ? C.surface2 : "transparent", border: "none", cursor: "pointer", color: C.text, fontFamily: C.mono, fontSize: 11, fontWeight: 500 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: C.border2 }}>//</span> fase de usufruto</span>
                <span style={{ color: C.muted2, fontSize: 9, transform: usuOpen ? "rotate(180deg)" : "none" }}>▼</span>
              </button>
              {usuOpen && (
                <div style={{ padding: "12px 12px 6px" }}>
                  {[
                    { label: "Retorno Nominal (Usufruto)", campo: "retornoNominalUsufruto", min: 0, max: 25 },
                    { label: "Taxa de Retirada Anual", campo: "taxaRetiradaAnual", min: 1, max: 10 },
                  ].map(({ label, campo, min, max }) => {
                    const raw = parseFloat((parametros[campo] || "0").replace(",", ".")) || 0;
                    return (
                      <div key={campo} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                          <span style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", flex: 1, whiteSpace: "nowrap" }} title={label}>{label}</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco[campo] ? (inputTemp[campo] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(p => ({...p, [campo]: true})); setInputTemp(p => ({...p, [campo]: String(raw)})); }}
                              onBlur={() => { setInputFoco(p => ({...p, [campo]: false})); const n = parseFloat((inputTemp[campo]||"0").replace(",",".")); if (!isNaN(n)) setParametros(p => ({...p, [campo]: String(Math.min(max, Math.max(min, n)))})); }}
                              onChange={e => setInputTemp(p => ({...p, [campo]: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 64, textAlign: "right", fontSize: 11, color: C.text, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[campo] ? C.accent : C.border}`, borderRadius: 5, padding: "3px 20px 3px 6px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw} onChange={e => setParametros(p => ({...p, [campo]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.accent, cursor: "pointer", height: 3, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted2, marginTop: 3 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const retNom = parseFloat((parametros.retornoNominalUsufruto || "0").replace(",", ".")) || 0;
                    const infl = parseFloat((parametros.inflacao || "0").replace(",", ".")) || 0;
                    const retReal = ((1 + retNom/100) / (1 + infl/100) - 1) * 100;
                    const cor = retReal >= 0 ? C.emerald : C.rose;
                    return (
                      <div style={{ marginBottom: 12, padding: "7px 10px", background: `${cor}10`, borderRadius: 7, border: `1px solid ${cor}25`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Retorno real (usufruto)</span>
                        <span style={{ fontSize: 13, color: cor, fontFamily: C.mono, fontWeight: 600 }}>{retReal >= 0 ? "+" : ""}{retReal.toFixed(2).replace(".", ",")}%</span>
                      </div>
                    );
                  })()}

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>Prazo de Usufruto</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={parametros.prazoUsufruto} onChange={e => setP("prazoUsufruto", e.target.value)} min={1} max={60}
                        onFocus={() => setInputFoco(p => ({...p, prazoUsufruto: true}))}
                        onBlur={() => setInputFoco(p => ({...p, prazoUsufruto: false}))}
                        style={iBase("prazoUsufruto")} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.muted2, pointerEvents: "none" }}>anos</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>Modo de Usufruto</span>
                    <select value={parametros.modoUsufruto} onChange={e => setP("modoUsufruto", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 7, color: C.text, fontSize: 11, fontFamily: C.mono, outline: "none" }}>
                      <option value="fixa">Renda fixa real</option>
                      <option value="variavel">Retirada percentual</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            </div>
          )}
          </div>

          {/* Botões sidebar */}
          <div style={{ padding: "12px", borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => setModalPdf(true)}
              style={{ width: "100%", padding: "9px", borderRadius: 7, border: `1px solid ${C.accent}`, background: C.accentBg, color: C.accent, fontSize: 11, cursor: "pointer", fontFamily: C.mono, fontWeight: 600, marginBottom: 6 }}>
              // gerar relatório pdf
            </button>
            <button onClick={() => setParametros(DEFAULTS)}
              style={{ width: "100%", padding: "9px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: C.mono, marginBottom: 6 }}>
              resetar parâmetros
            </button>
            <button onClick={exportarCSV}
              style={{ width: "100%", padding: "9px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: C.mono }}>
              ↓ exportar csv
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main ref={mainRef} style={{ padding: "20px", overflowY: "auto", height: "100vh", background: C.bg }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted2, letterSpacing: "0.05em", marginBottom: 3 }}>// planejamento financeiro</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Geraldo Búrigo, CNPI</div>
            </div>
            {modoApp === "acumulacao" && (
              <div style={{ display: "flex", gap: 3, background: C.surface, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
                {["graficos", "sensibilidade", "tabela"].map(aba => (
                  <button key={aba} style={tabStyle(aba)} onClick={() => setAbaAtiva(aba)}>
                    {aba === "graficos" ? "visão geral" : aba === "sensibilidade" ? "sensibilidade" : "tabela"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── MODO USUFRUTO PURO ── */}
          {modoApp === "usufruto" && (() => {
            const { pat0, prazo, rendaMensalReal, pontos, ultimo, anoEsgotamento } = cenariosUsufruto;
            const idadeAtual = parseInt(pu.idadeAtual || 60);
            const herancaNominal = ultimo?.patNominal ?? 0;
            const herancaReal = ultimo?.patReal ?? 0;
            const rendaMensalNominal = pontos.length > 1 ? (pontos[1]?.retirNomMensal ?? 0) : 0;
            const corBanner = anoEsgotamento ? C.rose : C.emerald;
            return (
              <div>
                <DarkCard style={{ marginBottom: 16, borderLeft: `3px solid ${corBanner}`, borderRadius: "0 10px 10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 11, color: corBanner, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 4 }}>
                        {anoEsgotamento ? "// patrimônio se esgota" : "// simulador de renda sustentável"}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>
                        patrimônio de <span style={{ color: C.text, fontWeight: 600 }}>{fmtCpct(pat0)}</span>
                        {" · "}prazo de <span style={{ color: C.text, fontWeight: 600 }}>{prazo} anos</span>
                        {" · "}taxa de <span style={{ color: C.text, fontWeight: 600 }}>{pu.taxaRetirada || "4"}% a.a.</span>
                        {anoEsgotamento && <span style={{ color: C.rose, fontWeight: 600 }}> · esgota no ano {anoEsgotamento} (aos {parseInt(pu.idadeAtual||60) + anoEsgotamento} anos)</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: C.muted2, marginBottom: 2 }}>retorno real</div>
                      {(() => {
                        const rn = parseFloat(pu.retornoNominal||0); const inf = parseFloat(pu.inflacao||0);
                        const rr = ((1+rn/100)/(1+inf/100)-1)*100;
                        return <div style={{ fontSize: 16, color: rr>=0?C.emerald:C.rose, fontFamily: C.mono, fontWeight: 700 }}>{rr>=0?"+":""}{rr.toFixed(2).replace(".",",")}%</div>;
                      })()}
                    </div>
                  </div>
                </DarkCard>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                  <MetricCard label="Herança · Patrimônio Nominal" value={fmtCpct(herancaNominal)} sub={`Fim do usufruto (${idadeAtual + prazo} anos)`} accent={C.amber} />
                  <MetricCard label="Herança · Patrimônio Real" value={fmtCpct(herancaReal)} sub="Poder de compra hoje" accent={C.indigo} />
                  <MetricCard label="Renda Mensal Nominal" value={fmtCpct(rendaMensalNominal)} sub="Primeiro ano de retirada" accent={C.amber} />
                  <MetricCard label="Renda Mensal Real" value={fmtCpct(rendaMensalReal)} sub="Poder de compra hoje" accent={C.emerald} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 3, background: C.surface, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
                    {["nominal", "real"].map(modo => (
                      <button key={modo} onClick={() => setModoGraficosUsu(modo)} style={toggleStyle(modoGraficosUsu === modo, modo === "nominal" ? C.amber : C.indigo)}>
                        {modo === "nominal" ? "nominal" : "ajustado inflação"}
                      </button>
                    ))}
                  </div>
                </div>

                <DarkCard style={{ marginBottom: 12 }}>
                  <SectionTag>evolução do patrimônio no usufruto</SectionTag>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer>
                      <AreaChart data={pontos} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradUsu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={modoGraficosUsu === "nominal" ? C.amber : C.indigo} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={modoGraficosUsu === "nominal" ? C.amber : C.indigo} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...chartProps.cartesianGrid} />
                        <XAxis dataKey="ano" {...chartProps.xAxis} />
                        <YAxis tickFormatter={v => `${(v/1e6).toFixed(1)}Mi`} {...chartProps.yAxis} />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const val = modoGraficosUsu === "nominal" ? payload[0]?.payload?.patNominal : payload[0]?.payload?.patReal;
                          return (
                            <div style={{ ...chartProps.tooltip.contentStyle, padding: "10px 14px" }}>
                              <div style={{ fontSize: 10, color: C.muted2, marginBottom: 6 }}>ano {label} · {idadeAtual + label} anos</div>
                              <div style={{ color: modoGraficosUsu === "nominal" ? C.amber : C.indigo, fontFamily: C.mono, fontWeight: 600 }}>{fmtBRL(val)}</div>
                            </div>
                          );
                        }} />
                        <Area type="monotone" dataKey={modoGraficosUsu === "nominal" ? "patNominal" : "patReal"}
                          stroke={modoGraficosUsu === "nominal" ? C.amber : C.indigo} strokeWidth={2}
                          fill="url(#gradUsu)" dot={false} />
                        {anoEsgotamento && <ReferenceLine x={anoEsgotamento} stroke={C.rose} strokeDasharray="4 4" label={{ value: "esgotamento", position: "insideTopRight", fill: C.rose, fontSize: 10 }} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </DarkCard>

                <DarkCard style={{ marginBottom: 12 }}>
                  <SectionTag>retirada anual no usufruto</SectionTag>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer>
                      <AreaChart data={pontos.filter(d => d.ano > 0)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradRetir" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={modoGraficosUsu === "nominal" ? C.amber : C.emerald} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={modoGraficosUsu === "nominal" ? C.amber : C.emerald} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...chartProps.cartesianGrid} />
                        <XAxis dataKey="ano" {...chartProps.xAxis} />
                        <YAxis tickFormatter={v => `${Math.round(v/1000)}k`} {...chartProps.yAxis} />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          const cor = modoGraficosUsu === "nominal" ? C.amber : C.emerald;
                          const anual = modoGraficosUsu === "nominal" ? d?.retirNominal : d?.retirReal;
                          const mensal = modoGraficosUsu === "nominal" ? d?.retirNomMensal : d?.retirRealMensal;
                          return (
                            <div style={{ ...chartProps.tooltip.contentStyle, padding: "10px 14px" }}>
                              <div style={{ fontSize: 10, color: C.muted2, marginBottom: 6 }}>ano {label} · {idadeAtual + label} anos</div>
                              <div style={{ color: cor, marginBottom: 3 }}>anual: <strong>{fmtBRL(anual)}</strong></div>
                              <div style={{ color: cor }}>mensal: <strong>{fmtBRL(mensal)}</strong></div>
                            </div>
                          );
                        }} />
                        <Area type="monotone" dataKey={modoGraficosUsu === "nominal" ? "retirNominal" : "retirReal"}
                          stroke={modoGraficosUsu === "nominal" ? C.amber : C.emerald} strokeWidth={2}
                          fill="url(#gradRetir)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </DarkCard>

                <DarkCard>
                  <SectionTag>evolução anual — patrimônio e retiradas</SectionTag>
                  <div style={{ overflowX: "auto", maxHeight: 400 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                      <thead>
                        <tr>
                          {[["Ano","left",C.muted2],["Idade","left",C.muted2],["Pat. Nominal","right",C.amber],["Pat. Real","right",C.indigo],["Retirada Anual Nom.","right",C.amber],["Retirada Anual Real","right",C.emerald],["Retirada Mensal Nom.","right",C.amber],["Retirada Mensal Real","right",C.emerald]].map(([h, align, cor]) => (
                            <th key={h} style={{ padding:"8px 12px", textAlign: align, borderBottom:`1px solid ${C.border}`, fontSize:10, color: cor, fontWeight:500, fontFamily:C.mono, textTransform:"uppercase", letterSpacing:"0.06em", position:"sticky", top:0, background:C.surface, whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pontos.map((d, i) => {
                          const bg = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)";
                          return (
                            <tr key={d.ano} style={{ background: bg }}>
                              <td style={{ padding:"7px 12px", fontSize:11, color:C.muted2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)` }}>{d.ano}</td>
                              <td style={{ padding:"7px 12px", fontSize:11, color:C.text, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)` }}>{idadeAtual + d.ano}</td>
                              <td style={{ padding:"7px 12px", fontSize:11, color: d.patNominal>0?C.amber:C.muted2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)`, textAlign:"right" }}>{d.patNominal>0?fmtBRL(d.patNominal):"—"}</td>
                              <td style={{ padding:"7px 12px", fontSize:11, color: d.patReal>0?C.indigo:C.muted2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)`, textAlign:"right" }}>{d.patReal>0?fmtBRL(d.patReal):"—"}</td>
                              <td style={{ padding:"7px 12px", fontSize:11, color: d.retirNominal>0?C.amber:C.muted2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)`, textAlign:"right" }}>{d.retirNominal>0?fmtBRL(d.retirNominal):"—"}</td>
                              <td style={{ padding:"7px 12px", fontSize:11, color: d.retirReal>0?C.emerald:C.muted2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)`, textAlign:"right" }}>{d.retirReal>0?fmtBRL(d.retirReal):"—"}</td>
                              <td style={{ padding:"7px 12px", fontSize:11, color: d.retirNomMensal>0?C.amber:C.muted2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)`, textAlign:"right" }}>{d.retirNomMensal>0?fmtBRL(d.retirNomMensal):"—"}</td>
                              <td style={{ padding:"7px 12px", fontSize:11, color: d.retirRealMensal>0?C.emerald:C.muted2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.03)`, textAlign:"right" }}>{d.retirRealMensal>0?fmtBRL(d.retirRealMensal):"—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </DarkCard>
              </div>
            );
          })()}

          {/* ── MODO ACUMULAÇÃO ── */}
          {modoApp === "acumulacao" && <>


          {/* Resumo Executivo */}
          {(() => {
            const { prazo, patReal, heranca, atingeMeta, fmtC, fmtB, rendaMensalReal, rendaMeta, patNecessarioReal, anoEsgot, prazoAcc, prazoUsu, idadeAtual, idadeAposentadoria, supereRenda } = resumoDados;
            const D = ({ children, cor }) => <span style={{ color: cor, fontWeight: 700, fontFamily: C.mono }}>{children}</span>;
            return (
              <DarkCard style={{ marginBottom: 16, borderLeft: `3px solid ${C.accent}`, borderRadius: "0 10px 10px 0" }}>
                <div style={{ fontSize: 10, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>// resumo executivo</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.9 }}>
                  {prazo
                    ? <>Aos <D cor={C.text}>{Math.round(idadeAtual + prazo)} anos</D> você atingirá a independência financeira — em aproximadamente <D cor={C.text}>{prazo.toFixed(1).replace(".", ",")} anos</D>. </>
                    : <>A meta <D cor={C.rose}>não é atingida</D> dentro de 80 anos — considere aumentar o aporte ou reduzir a renda desejada. </>
                  }
                  Ao se aposentar aos <D cor={C.text}>{idadeAposentadoria} anos</D>, após <D cor={C.text}>{prazoAcc} anos</D> de acumulação, seu patrimônio real será de{" "}
                  <D cor={C.indigo}>{fmtC(patReal)}</D>,{" "}
                  {atingeMeta
                    ? <>superando o necessário de <D cor={C.emerald}>{fmtC(patNecessarioReal)}</D>. </>
                    : <>abaixo do necessário de <D cor={C.rose}>{fmtC(patNecessarioReal)}</D>. </>
                  }
                  A renda mensal projetada é de <D cor={C.emerald}>{fmtB(rendaMensalReal)}</D> em poder de compra de hoje
                  {supereRenda
                    ? <>, superando sua meta de <D cor={C.emerald}>{fmtB(rendaMeta)}</D>. </>
                    : <>, abaixo da sua meta de <D cor={C.rose}>{fmtB(rendaMeta)}</D>. </>
                  }
                  {anoEsgot
                    ? <><D cor={C.rose}>Atenção:</D> o patrimônio se esgota no ano <D cor={C.rose}>{anoEsgot}</D>. Considere reduzir a taxa de retirada.</>
                    : <>O patrimônio sustenta os <D cor={C.text}>{prazoUsu} anos</D> de usufruto{heranca > 0 ? <>, com herança projetada de <D cor={C.amber}>{fmtC(heranca)}</D>.</> : <>.</>}</>
                  }
                </div>
              </DarkCard>
            );
          })()}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 10 }}>
            <MetricCard label="Patrimônio Nominal" value={fmtCpct(resumo.patrimonioAcumuladoNominal)} sub="Valor futuro nominal" accent={C.amber} />
            <MetricCard label="Patrimônio Real" value={fmtCpct(resumo.patrimonioAcumuladoReal)} sub="Poder de compra hoje" accent={C.indigo} />
            <MetricCard label="Renda Mensal Nominal" value={fmtCpct(resumo.rendaMensalNominalInicial)} sub="Valor futuro nominal" accent={C.amber} />
            <MetricCard label="Renda Mensal Real" value={fmtCpct(resumo.rendaMensalRealInicial)} sub="Poder de compra hoje" accent={C.emerald} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 20 }}>
            <MetricCard label="Aporte Necessário" value={aporteNecessario ? fmtCpct(aporteNecessario) : "—"} sub={`Mensal · meta em ${p.prazoAcumulacao} anos`} accent={C.muted} />
            <MetricCard label="Tempo para Meta" value={anosCasoAtual ? `${anosCasoAtual.toFixed(1).replace(".",",")} anos` : "Não atinge"} sub={anosCasoAtual ? `Aos ${Math.round(p.idadeAtual + anosCasoAtual)} anos` : "Ajuste os parâmetros"} accent={C.text} />
            <MetricCard label="Patrimônio Necessário Nominal" value={fmtCpct(patrimonioNecessarioNominal)} sub={metaAtingida ? "✓ Meta atingida" : "✗ Meta não atingida"} accent={metaAtingida ? C.emerald : C.rose} subColor={metaAtingida ? C.emerald : C.rose} />
            <MetricCard label="Patrimônio Necessário Real" value={fmtCpct(patrimonioNecessarioReal)} sub={metaAtingida ? "✓ Meta atingida" : "✗ Meta não atingida"} accent={metaAtingida ? C.emerald : C.rose} subColor={metaAtingida ? C.emerald : C.rose} />
          </div>

          {abaAtiva === "graficos" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ display: "flex", gap: 3, background: C.surface, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
                  {["nominal", "real"].map(modo => (
                    <button key={modo} onClick={() => setModoGraficos(modo)} style={toggleStyle(modoGraficos === modo, modo === "nominal" ? C.amber : C.indigo)}>
                      {modo === "nominal" ? "nominal" : "ajustado inflação"}
                    </button>
                  ))}
                </div>
              </div>

              <DarkCard>
                <SectionTag>{modoGraficos === "nominal" ? "patrimônio nominal ao longo do tempo" : "patrimônio real ao longo do tempo"}</SectionTag>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={modoGraficos === "nominal" ? C.amber : C.indigo} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={modoGraficos === "nominal" ? C.amber : C.indigo} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartProps.cartesianGrid} />
                      <XAxis dataKey="ano" {...chartProps.xAxis} />
                      <YAxis tickFormatter={fmtMi} {...chartProps.yAxis} />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const val = modoGraficos === "nominal" ? d.patrimonioNominal : d.patrimonioReal;
                        return (
                          <div style={{ ...chartProps.tooltip.contentStyle, padding: "10px 14px" }}>
                            <div style={{ color: C.muted2, marginBottom: 6, fontSize: 10 }}>ano {d.ano} · {d.fase} · {p.idadeAtual + d.ano} anos</div>
                            <div style={{ color: modoGraficos === "nominal" ? C.amber : C.indigo }}>patrimônio: {fmtBRL(val)}</div>
                            {d.rendaMensalReal > 0 && <div style={{ color: C.emerald, marginTop: 3 }}>renda: {fmtBRL(d.rendaMensalReal)}</div>}
                          </div>
                        );
                      }} />
                      <ReferenceLine x={p.prazoAcumulacao} stroke={C.border2} strokeDasharray="4 4" label={{ value: `aposentadoria (${p.idadeAposentadoria}a)`, position: "insideTopRight", fill: C.muted2, fontSize: 10 }} />
                      {pico && <ReferenceLine x={pico.ano} stroke={C.emerald} strokeDasharray="3 3" label={{ value: "pico", position: "insideTopLeft", fill: C.emerald, fontSize: 10 }} />}
                      {resumo.anoEsgotamento && <ReferenceLine x={Math.floor(resumo.anoEsgotamento)} stroke={C.rose} strokeDasharray="3 3" label={{ value: "esgotamento", position: "insideTopRight", fill: C.rose, fontSize: 10 }} />}
                      <Area type="monotone" dataKey={modoGraficos === "nominal" ? "patrimonioNominal" : "patrimonioReal"}
                        stroke={modoGraficos === "nominal" ? C.amber : C.indigo} strokeWidth={2} fill="url(#gradP)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </DarkCard>

              <DarkCard>
                <SectionTag>renda mensal no usufruto</SectionTag>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer>
                    <AreaChart data={dadosRendaMensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={modoGraficos === "nominal" ? C.amber : C.emerald} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={modoGraficos === "nominal" ? C.amber : C.emerald} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartProps.cartesianGrid} />
                      <XAxis dataKey="ano" {...chartProps.xAxis} />
                      <YAxis tickFormatter={v => `${Math.round(v/1000)}k`} {...chartProps.yAxis} />
                      <Tooltip formatter={v => [fmtBRL(v), modoGraficos === "nominal" ? "Renda nominal" : "Renda real"]} {...chartProps.tooltip} itemStyle={{ color: C.text }} />
                      {p.rendaMensalDesejada > 0 && <ReferenceLine y={p.rendaMensalDesejada} stroke={C.indigo} strokeDasharray="4 4" label={{ value: "meta", position: "insideTopRight", fill: C.indigo, fontSize: 10 }} />}
                      <Area type="monotone" dataKey={modoGraficos === "nominal" ? "rendaMensalNominal" : "rendaMensalReal"}
                        stroke={modoGraficos === "nominal" ? C.amber : C.emerald} strokeWidth={2} fill="url(#gradR)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </DarkCard>

              <DarkCard>
                <SectionTag>fluxos anuais</SectionTag>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={dadosFluxos} barCategoryGap="25%" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid {...chartProps.cartesianGrid} />
                      <XAxis dataKey="ano" {...chartProps.xAxis} />
                      <YAxis tickFormatter={v => `${Math.round(v/1000)}k`} {...chartProps.yAxis} />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const isAporte = d.fase === "Acumulação";
                        const cor = isAporte ? C.emerald : C.rose;
                        const val = modoGraficos === "nominal" ? d.fluxoNominal : d.fluxoReal;
                        return (
                          <div style={{ ...chartProps.tooltip.contentStyle, padding: "10px 14px" }}>
                            <div style={{ fontSize: 10, color: C.muted2, marginBottom: 6 }}>ano {d.ano} · {p.idadeAtual + d.ano} anos</div>
                            <div style={{ color: cor }}>{isAporte ? "aporte" : "retirada"}: <strong>{fmtBRL(val)}</strong></div>
                            <div style={{ color: cor, marginTop: 2 }}>mensal: <strong>{fmtBRL(val/12)}</strong></div>
                          </div>
                        );
                      }} />
                      <ReferenceLine x={p.prazoAcumulacao} stroke={C.border2} strokeDasharray="3 3" />
                      <Bar dataKey={modoGraficos === "nominal" ? "fluxoNominal" : "fluxoReal"} radius={[4,4,0,0]}>
                        {dadosFluxos.map((e, i) => <Cell key={i} fill={e.cor} fillOpacity={0.8} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DarkCard>

              <DarkCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <SectionTag>total investido vs rendimento</SectionTag>
                  <div style={{ display: "flex", gap: 14 }}>
                    {[["total investido", C.emerald, resumo.totalInvestido], ["rendimento", C.indigo, resumo.rendimento]].map(([lbl, cor, val]) => (
                      <div key={lbl} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: C.muted2, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: cor, display: "inline-block" }} />{lbl}
                        </div>
                        <div style={{ fontSize: 14, color: cor, fontFamily: C.mono, fontWeight: 500 }}>{fmtCpct(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={dadosEmpilhado} barCategoryGap="20%" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid {...chartProps.cartesianGrid} />
                      <XAxis dataKey="ano" {...chartProps.xAxis} />
                      <YAxis tickFormatter={v => `${v.toFixed(1)}Mi`} {...chartProps.yAxis} />
                      <Tooltip formatter={(v, name) => [`R$ ${v.toFixed(2).replace(".",",")} mi`, name]} {...chartProps.tooltip} />
                      <Bar dataKey="totalInvestido" name="Total Investido" stackId="a" fill={C.emerald} fillOpacity={0.75} radius={[0,0,0,0]} />
                      <Bar dataKey="rendimento" name="Rendimento" stackId="a" fill={C.indigo} fillOpacity={0.85} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DarkCard>
            </div>
          )}

          {abaAtiva === "sensibilidade" && (
            <div style={{ display: "grid", gap: 12 }}>
              <SensChart title="sensibilidade · renda desejada" data={sensibilidadeRenda} xKey="rendaMil" xLabel="Renda mensal (mil R$)" lineColor={C.indigo} currentX={p.rendaMensalDesejada/1000} currentY={anosCasoAtual} tipPrefix="Renda" fmtX={l => `R$${l}k`} />
              <SensChart title="sensibilidade · aporte mensal" data={sensibilidadeAporte} xKey="aporteMil" xLabel="Aporte mensal (mil R$)" lineColor={C.emerald} currentX={p.aporteMensal/1000} currentY={anosCasoAtual} tipPrefix="Aporte" fmtX={l => `R$${l}k`} />
              <SensChart title="sensibilidade · patrimônio inicial" data={sensibilidadePat} xKey="patrimonioMil" xLabel="Patrimônio inicial (mil R$)" lineColor={C.amber} currentX={p.patrimonioInicial/1000} currentY={anosCasoAtual} tipPrefix="Patrimônio" fmtX={l => `R$${Number(l).toLocaleString("pt-BR")}k`} />
            </div>
          )}

          {abaAtiva === "tabela" && (
            <DarkCard>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <SectionTag>tabela da simulação</SectionTag>
                <div style={{ display: "flex", gap: 3, background: C.bg, borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
                  {["nominal", "real"].map(modo => (
                    <button key={modo} onClick={() => setModoTabela(modo)} style={toggleStyle(modoTabela === modo)}>
                      {modo}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 520 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr>
                      {["Ano", "Idade", "Fase", "Patrimônio", "Aporte Anual", "Aporte Mensal", "Resgate Anual", "Resgate Mensal"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: h === "Ano" || h === "Idade" || h === "Fase" ? "left" : "right", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.muted2, fontWeight: 500, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.06em", position: "sticky", top: 0, background: C.surface, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.map((d, i) => {
                      const isTransicao = d.ano === p.prazoAcumulacao;
                      const bgBase = isTransicao ? C.accentBg : "transparent";
                      const nom = modoTabela === "nominal";
                      const patrimonio = nom ? d.patrimonioNominal : d.patrimonioReal;
                      const aporteAnual = nom ? d.aporteAnualNominal : d.aporteAnualReal;
                      const aporteMes = nom ? d.aporteMensalNominal : d.aporteMensalReal;
                      const resgateAnu = nom ? d.resgateAnualNominal : d.resgateAnualReal;
                      const resgatemMes = nom ? d.resgateNominalMensal : d.rendaMensalReal;
                      const idade = p.idadeAtual + d.ano;
                      return (
                        <tr key={i} style={{ background: bgBase }}>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: C.muted2, fontFamily: C.mono, borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{d.ano}</td>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: C.text, fontFamily: C.mono, borderBottom: `1px solid rgba(255,255,255,0.03)` }}>{idade}</td>
                          <td style={{ padding: "8px 12px", borderBottom: `1px solid rgba(255,255,255,0.03)`, whiteSpace: "nowrap" }}>
                            <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 500, fontFamily: C.mono, background: d.fase === "Acumulação" ? "rgba(163,230,53,0.15)" : "rgba(74,222,128,0.15)", color: d.fase === "Acumulação" ? C.accent : C.emerald }}>{d.fase}</span>
                          </td>
                          {[patrimonio, aporteAnual, aporteMes, resgateAnu, resgatemMes].map((v, j) => (
                            <td key={j} style={{ padding: "8px 12px", fontSize: 11, color: v > 0 ? C.text : C.muted2, fontFamily: C.mono, borderBottom: `1px solid rgba(255,255,255,0.03)`, textAlign: "right", whiteSpace: "nowrap" }}>
                              {v > 0 ? fmtBRL(v) : <span style={{ color: C.border2 }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={exportarCSV} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: C.mono }}>
                  ↓ exportar csv
                </button>
              </div>
            </DarkCard>
          )}
          </>}
        </main>
      </div>

      {modalPdf && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 10, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ fontSize: 11, color: C.muted2, letterSpacing: "0.05em", marginBottom: 6 }}>// gerar relatório pdf</div>
            <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 600, color: C.text, fontFamily: C.mono }}>Relatório Personalizado</h2>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: C.muted }}>Preencha o nome do cliente para personalizar o relatório.</p>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>Nome do cliente</label>
            <input type="text" placeholder="Ex: João Silva" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 7, color: C.text, fontSize: 13, fontFamily: C.mono, outline: "none", boxSizing: "border-box", marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setModalPdf(false)}
                style={{ flex: 1, padding: "9px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: C.mono }}>
                cancelar
              </button>
              <button onClick={() => { setModalPdf(false); }} style={{ flex: 2, padding: "9px", borderRadius: 7, border: "none", background: C.accentBg, borderWidth: 1, borderStyle: "solid", borderColor: C.accent, color: C.accent, fontSize: 12, cursor: "pointer", fontFamily: C.mono, fontWeight: 600 }}>
                // gerar pdf
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
