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
  return { dados, resumo: { patrimonioAcumuladoNominal: fimAcc?.patrimonioNominal ?? 0, patrimonioAcumuladoReal: fimAcc?.patrimonioReal ?? 0, rendaMensalRealInicial: inicioUsu?.rendaMensalReal ?? ((fimAcc?.patrimonioReal ?? 0) * taxaRetiradaAnual / 12), anoEsgotamento, totalInvestido: fimAcc?.totalInvestido ?? 0, rendimento: fimAcc?.rendimento ?? 0 } };
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
  retornoNominalUsufruto: "10", inflacao: "6", prazoAcumulacao: "20",
  prazoUsufruto: "60", taxaRetiradaAnual: "4", modoUsufruto: "fixa",
  rendaMensalDesejada: "15.000,00",
};

const TOOLTIPS = {
  patrimonioInicial: "Valor que você já possui investido hoje.",
  aporteMensal: "Quanto você investe por mês durante a fase de acumulação.",
  crescimentoAporteAnual: "Percentual de aumento do aporte a cada ano.",
  retornoNominalAcumulacao: "Retorno bruto anual esperado na acumulação.",
  retornoNominalUsufruto: "Retorno bruto anual esperado no usufruto.",
  inflacao: "Inflação anual esperada para corrigir o poder de compra.",
  prazoAcumulacao: "Anos de acumulação antes de começar a retirar.",
  prazoUsufruto: "Anos vivendo do patrimônio acumulado.",
  taxaRetiradaAnual: "% do patrimônio retirado por ano. Regra dos 4% = sustentabilidade por 30+ anos.",
  modoUsufruto: "Fixa: mantém poder de compra. Variável: retira % do patrimônio atual.",
  rendaMensalDesejada: "Renda mensal desejada na aposentadoria, em valores de hoje.",
};

const C = {
  bg:       "#0f172a",
  surface:  "#1e293b",
  surface2: "#273344",
  border:   "rgba(255,255,255,0.08)",
  border2:  "rgba(255,255,255,0.14)",
  indigo:   "#6366f1",
  emerald:  "#10b981",
  amber:    "#f59e0b",
  rose:     "#f43f5e",
  slate:    "#94a3b8",
  slate2:   "#64748b",
  white:    "#f8fafc",
  white2:   "#e2e8f0",
  mono:     "'JetBrains Mono', 'Roboto Mono', monospace",
  sans:     "'Inter', 'Manrope', system-ui, sans-serif",
};

export default function App() {
  const [parametros, setParametros] = useState(() => {
    try { const s = localStorage.getItem("pf-v2"); return s ? JSON.parse(s) : DEFAULTS; } catch { return DEFAULTS; }
  });
  const [accOpen, setAccOpen] = useState(true);
  const [usuOpen, setUsuOpen] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("graficos");
  const [tooltipAtivo, setTooltipAtivo] = useState(null);
  const [modoTabela, setModoTabela] = useState("nominal");
  const [modoGraficos, setModoGraficos] = useState("nominal");
  const sidebarRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("pf-v2", JSON.stringify(parametros)); } catch {}
  }, [parametros]);

  // Preserva posição do scroll da sidebar ao fazer re-render
  const focarCampo = useCallback((campo, valorAtual) => {
    const scrollTop = sidebarRef.current?.scrollTop ?? 0;
    setInputFoco(prev => ({ ...prev, [campo]: true }));
    setInputTemp(prev => ({ ...prev, [campo]: String(valorAtual) }));
    requestAnimationFrame(() => {
      if (sidebarRef.current) sidebarRef.current.scrollTop = scrollTop;
    });
  }, []);

  const sairCampoMoeda = useCallback((campo) => {
    setInputFoco(prev => ({ ...prev, [campo]: false }));
    setInputTemp(prev => {
      const num = parseFloat((prev[campo] || "0").replace(",", ".")) || 0;
      setParametros(p => ({ ...p, [campo]: num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
      return prev;
    });
  }, []);

  const sairCampoSlider = useCallback((campo, min, max) => {
    setInputFoco(prev => ({ ...prev, [campo]: false }));
    setInputTemp(prev => {
      const num = parseFloat((prev[campo] || "0").replace(",", "."));
      if (!isNaN(num)) setParametros(p => ({ ...p, [campo]: String(Math.min(max, Math.max(min, num))) }));
      return prev;
    });
  }, []);

  const limparMoeda      = v => !v ? 0 : Number(v.replace(/\./g, "").replace(",", ".")) || 0;
  const limparInteiro    = v => Number(v.replace(/\D/g, "")) || 0;
  const limparPercentual = v => (Number(v.replace(",", ".")) || 0) / 100;
  const formatarMoedaInput = valor => {
    const d = valor.replace(/\D/g, "");
    if (!d) return "";
    return (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const p = useMemo(() => ({
    patrimonioInicial: limparMoeda(parametros.patrimonioInicial),
    aporteMensal: limparMoeda(parametros.aporteMensal),
    crescimentoAporteAnual: limparPercentual(parametros.crescimentoAporteAnual || "0"),
    retornoNominalAcumulacao: limparPercentual(parametros.retornoNominalAcumulacao),
    retornoNominalUsufruto: limparPercentual(parametros.retornoNominalUsufruto),
    inflacao: limparPercentual(parametros.inflacao),
    prazoAcumulacao: limparInteiro(parametros.prazoAcumulacao),
    prazoUsufruto: limparInteiro(parametros.prazoUsufruto),
    taxaRetiradaAnual: limparPercentual(parametros.taxaRetiradaAnual),
    modoUsufruto: parametros.modoUsufruto,
    rendaMensalDesejada: limparMoeda(parametros.rendaMensalDesejada),
  }), [parametros]);

  const { dados, resumo } = calcularSimulacao(p);
  const pico = dados.length > 0 ? dados.reduce((a, b) => b.patrimonioReal > a.patrimonioReal ? b : a) : null;
  const patrimonioNecessario = p.taxaRetiradaAnual > 0 ? (p.rendaMensalDesejada * 12) / p.taxaRetiradaAnual : 0;
  const metaAtingida = resumo.patrimonioAcumuladoReal >= patrimonioNecessario;

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
    fluxoReal:    i.fase === "Acumulação" ? i.aporteAnualReal    : i.resgateAnualReal,
    cor: i.fase === "Acumulação" ? C.emerald : C.indigo,
  })), [dados, p]);

  const dadosEmpilhado = useMemo(() => dados.filter(d => d.fase === "Acumulação").map(d => ({
    ano: d.ano, totalInvestido: d.totalInvestido / 1e6, rendimento: d.rendimento / 1e6,
  })), [dados]);

  const dadosRendaMensal = useMemo(() => dados.filter(d => d.fase === "Usufruto").map(d => ({
    ano: d.ano,
    rendaMensalReal:    d.rendaMensalReal,
    rendaMensalNominal: d.resgateNominalMensal,
  })), [dados]);

  const anosCasoAtual = useMemo(() => calcularTempoParaMeta({ patrimonioInicial: p.patrimonioInicial, aporteMensal: p.aporteMensal, crescimentoAporteAnual: p.crescimentoAporteAnual, retornoNominalAcumulacao: p.retornoNominalAcumulacao, inflacao: p.inflacao, taxaRetiradaAnual: p.taxaRetiradaAnual, rendaMensalDesejada: p.rendaMensalDesejada }), [p]);

  const faixaRenda = useMemo(() => { const mil = Math.max(1, Math.round(p.rendaMensalDesejada/1000)); const inicio = Math.max(1, mil-10); return { inicio, fim: Math.max(inicio+20, mil+10) }; }, [p.rendaMensalDesejada]);
  const sensibilidadeRenda = useMemo(() => { const arr = []; for (let r = faixaRenda.inicio; r <= faixaRenda.fim; r++) { const anos = calcularTempoParaMeta({ ...p, rendaMensalDesejada: r*1000 }); if (anos !== null) arr.push({ rendaMil: r, anos }); } return arr; }, [p, faixaRenda]);

  const faixaAporte = useMemo(() => { const mil = Math.max(0, Math.round(p.aporteMensal/1000)); const inicio = Math.max(0, mil-15); return { inicio, fim: Math.max(inicio+25, mil+15) }; }, [p.aporteMensal]);
  const sensibilidadeAporte = useMemo(() => { const arr = []; for (let a = faixaAporte.inicio; a <= faixaAporte.fim; a++) { const anos = calcularTempoParaMeta({ ...p, aporteMensal: a*1000 }); if (anos !== null) arr.push({ aporteMil: a, anos }); } return arr; }, [p, faixaAporte]);

  const faixaPat = useMemo(() => { const mil = Math.max(100, Math.round(p.patrimonioInicial/1000)); const passo = 100; const inicio = Math.max(passo, mil-passo*8); return { inicio, fim: Math.max(inicio+passo*16, mil+passo*8), passo }; }, [p.patrimonioInicial]);
  const sensibilidadePat = useMemo(() => { const arr = []; for (let pt = faixaPat.inicio; pt <= faixaPat.fim; pt += faixaPat.passo) { const anos = calcularTempoParaMeta({ ...p, patrimonioInicial: pt*1000 }); if (anos !== null) arr.push({ patrimonioMil: pt, anos }); } return arr; }, [p, faixaPat]);

  const resumoDados = useMemo(() => {
    const prazo = anosCasoAtual;
    const patReal = resumo.patrimonioAcumuladoReal;
    const heranca = dados.filter(d => d.fase === "Usufruto").slice(-1)[0]?.patrimonioReal ?? 0;
    const atingeMeta = patReal >= patrimonioNecessario;
    const fmtC = v => v >= 1e6 ? `R$ ${(v/1e6).toFixed(2).replace(".",",")} mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(0)} mil` : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
    const fmtB = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
    return {
      prazo, patReal, heranca, atingeMeta, fmtC, fmtB,
      rendaMensal: resumo.rendaMensalRealInicial,
      rendaMeta: p.rendaMensalDesejada,
      patNecessario: patrimonioNecessario,
      anoEsgot: resumo.anoEsgotamento,
      prazoAcc: p.prazoAcumulacao,
      prazoUsu: p.prazoUsufruto,
      crescAporte: p.crescimentoAporteAnual,
      supereRenda: resumo.rendaMensalRealInicial >= p.rendaMensalDesejada,
    };
  }, [p, resumo, anosCasoAtual, dados, patrimonioNecessario]);

  const setP = (campo, valor) => setParametros(prev => ({ ...prev, [campo]: valor }));
  const setM = (campo, valor) => setParametros(prev => ({ ...prev, [campo]: formatarMoedaInput(valor) }));

  const fmtBRL  = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v || 0);
  const fmtCpct = v => v >= 1e6 ? `R$ ${(v/1e6).toFixed(2).replace(".",",")} Mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(1).replace(".",",")} K` : fmtBRL(v);
  const fmtMi   = v => `${(v/1e6).toFixed(1)}Mi`;

  const exportarCSV = () => {
    const header = "Ano,Fase,Patrimônio Nominal,Patrimônio Real,Resgate Anual Real,Renda Mensal Real\n";
    const rows = dados.map(d => `${d.ano},${d.fase},${d.patrimonioNominal.toFixed(2)},${d.patrimonioReal.toFixed(2)},${d.resgateAnualReal.toFixed(2)},${d.rendaMensalReal.toFixed(2)}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "simulacao.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Componentes de UI ────────────────────────────────────────────────────
  const glass = {
    background: "rgba(30,41,59,0.7)",
    border: `1px solid ${C.border2}`,
    borderRadius: 16,
    backdropFilter: "blur(12px)",
  };

  // Estado elevado para inputs — evita re-renders ao hover
  const [inputFoco, setInputFoco] = useState({});
  const [inputTemp, setInputTemp] = useState({});

  const InfoIcon = ({ campo }) => (
    <span style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}
      onMouseEnter={() => setTooltipAtivo(campo)} onMouseLeave={() => setTooltipAtivo(null)}>
      <span style={{ width: 14, height: 14, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.border2}`, color: C.slate, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: "help", fontFamily: C.sans }}>?</span>
      {tooltipAtivo === campo && (
        <div style={{ position: "absolute", left: 18, top: -4, zIndex: 200, background: "#0f172a", color: C.white2, fontSize: 11, padding: "8px 12px", borderRadius: 10, width: 210, lineHeight: 1.6, border: `1px solid ${C.border2}`, boxShadow: "0 20px 40px rgba(0,0,0,0.5)", fontFamily: C.sans }}>
          {TOOLTIPS[campo]}
        </div>
      )}
    </span>
  );

  // Campo monetário — estado elevado, sem re-render ao hover
  const MoneyField = ({ label, campo }) => {
    const emFoco = inputFoco[campo] || false;
    const valorBruto = limparMoeda(parametros[campo] || "");
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans }}>{label}</span>
          <InfoIcon campo={campo} />
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
          <input type="text"
            value={emFoco ? (inputTemp[campo] || "") : (parametros[campo] || "")}
            onFocus={() => focarCampo(campo, valorBruto > 0 ? valorBruto : "")}
            onBlur={() => sairCampoMoeda(campo)}
            onChange={e => setInputTemp(prev => ({ ...prev, [campo]: e.target.value.replace(/[^0-9.,]/g, "") }))}
            placeholder="0,00"
            style={{ width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8, background: C.surface2, border: `1px solid ${emFoco ? C.indigo : C.border2}`, borderRadius: 8, color: C.white, fontSize: 13, fontFamily: C.mono, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
          />
        </div>
      </div>
    );
  };

  // Campo percentual — slider suave + input digitável, sem re-render ao hover
  const SliderField = ({ label, campo, min, max, suffix = "%" }) => {
    const raw = parseFloat((parametros[campo] || "0").replace(",", ".")) || 0;
    const emFoco = inputFoco[campo] || false;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans }}>{label}<InfoIcon campo={campo} /></span>
          <div style={{ position: "relative" }}>
            <input type="text"
              value={emFoco ? (inputTemp[campo] || "") : raw.toFixed(1)}
              onFocus={() => focarCampo(campo, raw)}
              onBlur={() => sairCampoSlider(campo, min, max)}
              onChange={e => setInputTemp(prev => ({ ...prev, [campo]: e.target.value.replace(/[^0-9.,]/g, "") }))}
              style={{ width: 72, textAlign: "right", fontSize: 12, color: C.white, fontFamily: C.mono, background: C.surface2, border: `1px solid ${emFoco ? C.indigo : C.border}`, borderRadius: 6, padding: "3px 22px 3px 8px", outline: "none", transition: "border-color 0.2s" }}
            />
            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>%</span>
          </div>
        </div>
        <input type="range" min={min} max={max} step={0.1} value={raw}
          onChange={e => setP(campo, e.target.value)}
          style={{ width: "100%", accentColor: C.indigo, cursor: "pointer", height: 4 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.slate2, marginTop: 3, fontFamily: C.sans }}>
          <span>{min}{suffix}</span><span>{max}{suffix}</span>
        </div>
      </div>
    );
  };

  // Campo inteiro
  const IntField = ({ label, campo, suffix = "" }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans }}>{label}</span>
        <InfoIcon campo={campo} />
      </div>
      <div style={{ position: "relative" }}>
        <input type="number" value={parametros[campo]} onChange={e => setP(campo, e.target.value)} min={1} max={60}
          style={{ width: "100%", padding: "8px 40px 8px 10px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.white, fontSize: 13, fontFamily: C.mono, outline: "none", boxSizing: "border-box", WebkitAppearance: "none", MozAppearance: "textfield" }}
        />
        {suffix && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>{suffix}</span>}
      </div>
    </div>
  );

  const GlassCard = ({ children, style = {}, onClick }) => (
    <div onClick={onClick}
      style={{ ...glass, padding: "18px 20px", transition: "border-color 0.2s", cursor: onClick ? "pointer" : "default", ...style }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = C.border2; }}>
      {children}
    </div>
  );

  const MetricCard = ({ label, value, sub, accent = C.indigo, icon }) => (
    <GlassCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 11, color: C.slate, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: C.sans }}>{label}</span>
        {icon && <span style={{ fontSize: 16, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: accent, fontFamily: C.mono, marginTop: 10, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.slate2, marginTop: 6, fontFamily: C.sans }}>{sub}</div>}
    </GlassCard>
  );

  const SectionTitle = ({ children }) => (
    <div style={{ fontSize: 11, color: C.slate, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: C.sans, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 12, background: C.indigo, borderRadius: 2 }} />
      {children}
    </div>
  );

  const chartProps = {
    cartesianGrid: { strokeDasharray: "0", horizontal: true, vertical: false, stroke: "rgba(148,163,184,0.08)" },
    xAxis: { tick: { fill: C.slate2, fontSize: 11, fontFamily: C.sans }, axisLine: false, tickLine: false },
    yAxis: { tick: { fill: C.slate2, fontSize: 11, fontFamily: C.sans }, axisLine: false, tickLine: false, width: 72 },
    tooltip: { contentStyle: { background: "#0f172a", border: `1px solid ${C.border2}`, borderRadius: 10, color: C.white, fontSize: 12, fontFamily: C.sans, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" } },
  };

  const CustomTooltipPatrimonio = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ ...chartProps.tooltip.contentStyle, padding: "12px 16px" }}>
        <div style={{ color: C.slate, marginBottom: 8, fontSize: 11 }}>Ano {d.ano} · {d.fase}</div>
        <div style={{ color: C.indigo, fontFamily: C.mono }}>Patrimônio: {fmtBRL(d.patrimonioReal)}</div>
        {d.rendaMensalReal > 0 && <div style={{ color: C.emerald, fontFamily: C.mono, marginTop: 4 }}>Renda: {fmtBRL(d.rendaMensalReal)}</div>}
      </div>
    );
  };

  const SensChart = ({ title, data, xKey, xLabel, lineColor, currentX, currentY, tipPrefix, fmtX }) => (
    <GlassCard>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
            <CartesianGrid {...chartProps.cartesianGrid} />
            <XAxis dataKey={xKey} {...chartProps.xAxis} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: C.slate2, fontSize: 10 }} />
            <YAxis {...chartProps.yAxis} label={{ value: "Anos", angle: -90, position: "insideLeft", fill: C.slate2, fontSize: 10 }} />
            <Tooltip formatter={v => [`${Number(v).toFixed(1).replace(".",",")} anos`]} labelFormatter={l => `${tipPrefix}: ${fmtX(l)}`} {...chartProps.tooltip} />
            <ReferenceLine x={currentX} stroke={C.slate2} strokeDasharray="4 4" />
            {currentY && <ReferenceDot x={currentX} y={currentY} r={5} fill={C.bg} stroke={lineColor} strokeWidth={2} />}
            <Line type="monotone" dataKey="anos" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: lineColor }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );

  const AccordionSection = ({ title, icon, open, onToggle, children }) => (
    <div style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: open ? C.surface2 : "transparent", border: "none", cursor: "pointer", color: C.white2, fontFamily: C.sans, fontSize: 13, fontWeight: 500 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>{icon}</span>{title}</span>
        <span style={{ color: C.slate, fontSize: 10, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </button>
      {open && <div style={{ padding: "14px 14px 4px", background: "rgba(15,23,42,0.3)" }}>{children}</div>}
    </div>
  );

  const tabStyle = (aba) => ({
    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: C.sans, fontWeight: 500, transition: "all 0.2s",
    background: abaAtiva === aba ? C.indigo : "transparent",
    color: abaAtiva === aba ? "#fff" : C.slate,
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.sans, color: C.white }}>
      {/* Importar fontes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        input[type=range]::-webkit-slider-thumb { background: ${C.indigo}; }
        input[type=range]::-webkit-slider-runnable-track { background: ${C.surface2}; border-radius: 4px; height: 4px; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 4px; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", minHeight: "100vh" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          {/* Header sidebar */}
          <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.indigo}, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📊</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.white }}>Parâmetros</span>
            </div>
            <span style={{ fontSize: 10, color: C.slate2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Control Room</span>
          </div>

          {/* Campos */}
          <div ref={sidebarRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>

            {/* ── ACUMULAÇÃO ── */}
            <div style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setAccOpen(!accOpen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: accOpen ? C.surface2 : "transparent", border: "none", cursor: "pointer", color: C.white2, fontFamily: C.sans, fontSize: 13, fontWeight: 500 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span>📈</span>Fase de Acumulação</span>
                <span style={{ color: C.slate, fontSize: 10, transform: accOpen ? "rotate(180deg)" : "none" }}>▼</span>
              </button>
              {accOpen && (
                <div style={{ padding: "14px 14px 4px", background: "rgba(15,23,42,0.3)" }}>
                  {/* Patrimônio Inicial */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Patrimônio Inicial</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
                      <input type="text" value={inputFoco["patrimonioInicial"] ? (inputTemp["patrimonioInicial"] || "") : (parametros.patrimonioInicial || "")}
                        onFocus={() => { setInputFoco(p => ({...p, patrimonioInicial: true})); setInputTemp(p => ({...p, patrimonioInicial: String(limparMoeda(parametros.patrimonioInicial) || "")})); }}
                        onBlur={() => { setInputFoco(p => ({...p, patrimonioInicial: false})); const n = parseFloat((inputTemp["patrimonioInicial"]||"0").replace(",","."))||0; setParametros(p => ({...p, patrimonioInicial: n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})})); }}
                        onChange={e => setInputTemp(p => ({...p, patrimonioInicial: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, background:C.surface2, border:`1px solid ${inputFoco["patrimonioInicial"]?C.indigo:C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box" }} />
                    </div>
                  </div>
                  {/* Aporte Mensal */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Aporte Mensal</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
                      <input type="text" value={inputFoco["aporteMensal"] ? (inputTemp["aporteMensal"] || "") : (parametros.aporteMensal || "")}
                        onFocus={() => { setInputFoco(p => ({...p, aporteMensal: true})); setInputTemp(p => ({...p, aporteMensal: String(limparMoeda(parametros.aporteMensal) || "")})); }}
                        onBlur={() => { setInputFoco(p => ({...p, aporteMensal: false})); const n = parseFloat((inputTemp["aporteMensal"]||"0").replace(",","."))||0; setParametros(p => ({...p, aporteMensal: n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})})); }}
                        onChange={e => setInputTemp(p => ({...p, aporteMensal: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, background:C.surface2, border:`1px solid ${inputFoco["aporteMensal"]?C.indigo:C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box" }} />
                    </div>
                  </div>
                  {/* Renda Mensal Desejada */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Renda Mensal Desejada (meta)</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
                      <input type="text" value={inputFoco["rendaMensalDesejada"] ? (inputTemp["rendaMensalDesejada"] || "") : (parametros.rendaMensalDesejada || "")}
                        onFocus={() => { setInputFoco(p => ({...p, rendaMensalDesejada: true})); setInputTemp(p => ({...p, rendaMensalDesejada: String(limparMoeda(parametros.rendaMensalDesejada) || "")})); }}
                        onBlur={() => { setInputFoco(p => ({...p, rendaMensalDesejada: false})); const n = parseFloat((inputTemp["rendaMensalDesejada"]||"0").replace(",","."))||0; setParametros(p => ({...p, rendaMensalDesejada: n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})})); }}
                        onChange={e => setInputTemp(p => ({...p, rendaMensalDesejada: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, background:C.surface2, border:`1px solid ${inputFoco["rendaMensalDesejada"]?C.indigo:C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box" }} />
                    </div>
                  </div>
                  {/* Sliders acumulação */}
                  {[
                    { label: "Crescimento do Aporte", campo: "crescimentoAporteAnual", min: 0, max: 20 },
                    { label: "Retorno Nominal (Acumulação)", campo: "retornoNominalAcumulacao", min: 0, max: 30 },
                    { label: "Inflação", campo: "inflacao", min: 0, max: 20 },
                  ].map(({ label, campo, min, max }) => {
                    const raw = parseFloat((parametros[campo] || "0").replace(",", ".")) || 0;
                    return (
                      <div key={campo} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                          <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }} title={label}>{label}</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco[campo] ? (inputTemp[campo] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(p => ({...p, [campo]: true})); setInputTemp(p => ({...p, [campo]: String(raw)})); }}
                              onBlur={() => { setInputFoco(p => ({...p, [campo]: false})); const n = parseFloat((inputTemp[campo]||"0").replace(",",".")); if (!isNaN(n)) setParametros(p => ({...p, [campo]: String(Math.min(max, Math.max(min, n)))})); }}
                              onChange={e => setInputTemp(p => ({...p, [campo]: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 72, textAlign: "right", fontSize: 12, color: C.white, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[campo] ? C.indigo : C.border}`, borderRadius: 6, padding: "3px 22px 3px 8px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw} onChange={e => setParametros(p => ({...p, [campo]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.indigo, cursor: "pointer", height: 4, display: "block", margin: "0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.slate2, marginTop: 4 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Prazo acumulação */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Prazo de Acumulação</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={parametros.prazoAcumulacao} onChange={e => setParametros(p => ({...p, prazoAcumulacao: e.target.value}))} min={1} max={60}
                        style={{ width:"100%", padding:"8px 40px 8px 10px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box", WebkitAppearance:"none", MozAppearance:"textfield" }} />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.slate, pointerEvents:"none" }}>anos</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── USUFRUTO ── */}
            <div style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setUsuOpen(!usuOpen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: usuOpen ? C.surface2 : "transparent", border: "none", cursor: "pointer", color: C.white2, fontFamily: C.sans, fontSize: 13, fontWeight: 500 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span>🌅</span>Fase de Usufruto</span>
                <span style={{ color: C.slate, fontSize: 10, transform: usuOpen ? "rotate(180deg)" : "none" }}>▼</span>
              </button>
              {usuOpen && (
                <div style={{ padding: "14px 14px 4px", background: "rgba(15,23,42,0.3)" }}>
                  {/* Sliders usufruto */}
                  {[
                    { label: "Retorno Nominal (Usufruto)", campo: "retornoNominalUsufruto", min: 0, max: 25 },
                    { label: "Taxa de Retirada Anual", campo: "taxaRetiradaAnual", min: 1, max: 10 },
                  ].map(({ label, campo, min, max }) => {
                    const raw = parseFloat((parametros[campo] || "0").replace(",", ".")) || 0;
                    return (
                      <div key={campo} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                          <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }} title={label}>{label}</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco[campo] ? (inputTemp[campo] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(p => ({...p, [campo]: true})); setInputTemp(p => ({...p, [campo]: String(raw)})); }}
                              onBlur={() => { setInputFoco(p => ({...p, [campo]: false})); const n = parseFloat((inputTemp[campo]||"0").replace(",",".")); if (!isNaN(n)) setParametros(p => ({...p, [campo]: String(Math.min(max, Math.max(min, n)))})); }}
                              onChange={e => setInputTemp(p => ({...p, [campo]: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 72, textAlign: "right", fontSize: 12, color: C.white, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[campo] ? C.indigo : C.border}`, borderRadius: 6, padding: "3px 22px 3px 8px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw} onChange={e => setParametros(p => ({...p, [campo]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.indigo, cursor: "pointer", height: 4, display: "block", margin: "0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.slate2, marginTop: 4 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Prazo usufruto */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Prazo de Usufruto</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={parametros.prazoUsufruto} onChange={e => setParametros(p => ({...p, prazoUsufruto: e.target.value}))} min={1} max={60}
                        style={{ width:"100%", padding:"8px 40px 8px 10px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box", WebkitAppearance:"none", MozAppearance:"textfield" }} />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.slate, pointerEvents:"none" }}>anos</span>
                    </div>
                  </div>
                  {/* Modo usufruto */}
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Modo de Usufruto</span>
                    <select value={parametros.modoUsufruto} onChange={e => setParametros(p => ({...p, modoUsufruto: e.target.value}))}
                      style={{ width: "100%", padding: "8px 10px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.white, fontSize: 12, fontFamily: C.sans, outline: "none" }}>
                      <option value="fixa">Renda fixa real</option>
                      <option value="variavel">Retirada percentual</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer sidebar */}
          <div style={{ padding: "14px", borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => setParametros(DEFAULTS)}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${C.border2}`, background: "transparent", color: C.slate, fontSize: 12, cursor: "pointer", fontFamily: C.sans, marginBottom: 8 }}>
              Resetar parâmetros
            </button>
            <button onClick={exportarCSV}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.indigo}, #8b5cf6)`, color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: C.sans, fontWeight: 500 }}>
              ⬇ Exportar CSV
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ padding: "24px", overflowY: "auto" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.white, letterSpacing: "-0.02em" }}>Planejamento Financeiro</h1>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: C.slate2 }}>Simulação patrimonial · Alto Padrão</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["graficos", "sensibilidade", "tabela"].map(aba => (
                <button key={aba} style={tabStyle(aba)} onClick={() => setAbaAtiva(aba)}>
                  {aba === "graficos" ? "Visão Geral" : aba === "sensibilidade" ? "Sensibilidade" : "Tabela"}
                </button>
              ))}
            </div>
          </div>

          {/* Resumo Executivo */}
          {(() => {
            const { prazo, patReal, heranca, atingeMeta, fmtC, fmtB, rendaMensal, rendaMeta, patNecessario, anoEsgot, prazoAcc, prazoUsu, crescAporte, supereRenda } = resumoDados;
            const D = ({ children, cor }) => (
              <span style={{ color: cor, fontWeight: 700, fontSize: 15, fontFamily: C.mono, letterSpacing: "-0.01em" }}>{children}</span>
            );
            return (
              <GlassCard style={{ marginBottom: 20, borderLeft: `3px solid ${C.indigo}`, borderRadius: "0 16px 16px 0" }}>
                <div style={{ fontSize: 11, color: C.indigo, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14, fontWeight: 700, fontSize: 14 }}>Resumo Executivo</div>
                <div style={{ fontSize: 15, color: C.slate, lineHeight: 2, fontFamily: C.sans }}>
                  {prazo
                    ? <>Com os parâmetros atuais, você atingirá a independência financeira em aproximadamente <D cor={C.white}>{prazo.toFixed(1).replace(".", ",")} anos</D>. </>
                    : <>A meta <D cor={C.rose}>não é atingida</D> dentro de 80 anos — considere aumentar o aporte ou reduzir a renda desejada. </>
                  }
                  Ao final dos <D cor={C.white}>{prazoAcc} anos</D> de acumulação, seu patrimônio real será de{" "}
                  <D cor={C.indigo}>{fmtC(patReal)}</D>,{" "}
                  {atingeMeta
                    ? <>superando o necessário de <D cor={C.emerald}>{fmtC(patNecessario)}</D>. </>
                    : <>abaixo do necessário de <D cor={C.rose}>{fmtC(patNecessario)}</D>. </>
                  }
                  A renda mensal projetada é de <D cor={C.emerald}>{fmtB(rendaMensal)}</D> em poder de compra de hoje
                  {supereRenda
                    ? <>, superando sua meta de <D cor={C.emerald}>{fmtB(rendaMeta)}</D>. </>
                    : <>, abaixo da sua meta de <D cor={C.rose}>{fmtB(rendaMeta)}</D>. </>
                  }
                  {anoEsgot
                    ? <><D cor={C.rose}>⚠ Atenção:</D> o patrimônio se esgota no ano <D cor={C.rose}>{anoEsgot}</D>. Considere reduzir a taxa de retirada.</>
                    : <>O patrimônio sustenta os <D cor={C.white}>{prazoUsu} anos</D> de usufruto{heranca > 0 ? <>, com herança projetada de <D cor={C.amber}>{fmtC(heranca)}</D>.</> : <>.</>}</>
                  }
                </div>
              </GlassCard>
            );
          })()}

          {/* Cards linha 1 — resultados */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 14 }}>
            <MetricCard label="Patrimônio Nominal" value={fmtCpct(resumo.patrimonioAcumuladoNominal)} sub="Fim da acumulação" accent={C.slate} icon="🏦" />
            <MetricCard label="Patrimônio Real" value={fmtCpct(resumo.patrimonioAcumuladoReal)} sub="Poder de compra de hoje" accent={C.indigo} icon="📈" />
            <MetricCard label="Renda Mensal Projetada" value={fmtBRL(resumo.rendaMensalRealInicial)} sub="Poder de compra de hoje" accent={C.emerald} icon="💰" />
          </div>

          {/* Cards linha 2 — metas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 20 }}>
            <MetricCard label="Aporte Necessário" value={aporteNecessario ? fmtBRL(aporteNecessario) : "—"} sub={`Mensal para atingir em ${p.prazoAcumulacao} anos`} accent={C.amber} icon="🎯" />
            <MetricCard label="Tempo para Meta" value={anosCasoAtual ? `${anosCasoAtual.toFixed(1).replace(".",",")} anos` : "Não atinge"} sub="Com os parâmetros atuais" accent={C.white2} icon="⏱" />
            <MetricCard label="Patrimônio Necessário" value={fmtCpct(patrimonioNecessario)} sub={metaAtingida ? "✓ Meta atingida no prazo" : "✗ Meta não atingida"} accent={metaAtingida ? C.emerald : C.rose} icon={metaAtingida ? "✅" : "⚠️"} />
          </div>

          {/* ABA: VISÃO GERAL */}
          {abaAtiva === "graficos" && (
            <div style={{ display: "grid", gap: 16 }}>

              {/* Toggle Nominal / Real — afeta os 3 gráficos */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ display: "flex", gap: 0, background: C.surface2, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
                  {["nominal", "real"].map(modo => (
                    <button key={modo} onClick={() => setModoGraficos(modo)}
                      style={{ padding: "6px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: C.sans, fontWeight: 500, transition: "all 0.2s",
                        background: modoGraficos === modo ? (modo === "nominal" ? C.amber : C.indigo) : "transparent",
                        color: modoGraficos === modo ? "#fff" : C.slate }}>
                      {modo === "nominal" ? "Nominal" : "Ajustado pela inflação"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gráfico patrimônio */}
              <GlassCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <SectionTitle>
                    {modoGraficos === "nominal" ? "Patrimônio Nominal ao Longo do Tempo" : "Patrimônio Real ao Longo do Tempo"}
                  </SectionTitle>
                  <span style={{ fontSize: 11, color: modoGraficos === "nominal" ? C.amber : C.indigo, fontFamily: C.sans, padding: "3px 10px", borderRadius: 999, border: `1px solid ${modoGraficos === "nominal" ? C.amber : C.indigo}`, opacity: 0.8 }}>
                    {modoGraficos === "nominal" ? "valores nominais" : "poder de compra de hoje"}
                  </span>
                </div>
                <div style={{ height: 340 }}>
                  <ResponsiveContainer>
                    <AreaChart data={dados} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={modoGraficos === "nominal" ? C.amber : C.indigo} stopOpacity={0.3} />
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
                          <div style={{ ...chartProps.tooltip.contentStyle, padding: "12px 16px" }}>
                            <div style={{ color: C.slate, marginBottom: 8, fontSize: 11 }}>Ano {d.ano} · {d.fase}</div>
                            <div style={{ color: modoGraficos === "nominal" ? C.amber : C.indigo, fontFamily: C.mono }}>Patrimônio: {fmtBRL(val)}</div>
                            {d.rendaMensalReal > 0 && <div style={{ color: C.emerald, fontFamily: C.mono, marginTop: 4 }}>Renda: {fmtBRL(d.rendaMensalReal)}</div>}
                          </div>
                        );
                      }} />
                      <ReferenceLine x={p.prazoAcumulacao} stroke={C.slate2} strokeDasharray="4 4" label={{ value: "Usufruto", position: "insideTopRight", fill: C.slate, fontSize: 10 }} />
                      {pico && <ReferenceLine x={pico.ano} stroke={C.emerald} strokeDasharray="3 3" label={{ value: "Pico", position: "insideTopLeft", fill: C.emerald, fontSize: 10 }} />}
                      {resumo.anoEsgotamento && <ReferenceLine x={Math.floor(resumo.anoEsgotamento)} stroke={C.rose} strokeDasharray="3 3" label={{ value: "Esgotamento", position: "insideTopRight", fill: C.rose, fontSize: 10 }} />}
                      <Area type="monotone" dataKey={modoGraficos === "nominal" ? "patrimonioNominal" : "patrimonioReal"}
                        stroke={modoGraficos === "nominal" ? C.amber : C.indigo} strokeWidth={2} fill="url(#gradP)"
                        dot={false} activeDot={{ r: 4, fill: modoGraficos === "nominal" ? C.amber : C.indigo, stroke: C.bg, strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Renda mensal no usufruto */}
              <GlassCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <SectionTitle>Renda Mensal no Usufruto</SectionTitle>
                  <span style={{ fontSize: 11, color: modoGraficos === "nominal" ? C.amber : C.emerald, fontFamily: C.sans, padding: "3px 10px", borderRadius: 999, border: `1px solid ${modoGraficos === "nominal" ? C.amber : C.emerald}`, opacity: 0.8 }}>
                    {modoGraficos === "nominal" ? "valores nominais" : "poder de compra de hoje"}
                  </span>
                </div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <AreaChart data={dadosRendaMensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={modoGraficos === "nominal" ? C.amber : C.emerald} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={modoGraficos === "nominal" ? C.amber : C.emerald} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartProps.cartesianGrid} />
                      <XAxis dataKey="ano" {...chartProps.xAxis} />
                      <YAxis tickFormatter={v => `${Math.round(v/1000)}k`} {...chartProps.yAxis} />
                      <Tooltip formatter={v => [fmtBRL(v), modoGraficos === "nominal" ? "Renda nominal" : "Renda real"]} {...chartProps.tooltip} itemStyle={{ color: C.white }} />
                      {p.rendaMensalDesejada > 0 && (
                        <ReferenceLine y={p.rendaMensalDesejada} stroke={C.indigo} strokeDasharray="4 4"
                          label={{ value: "Meta", position: "insideTopRight", fill: C.indigo, fontSize: 10 }} />
                      )}
                      <Area type="monotone"
                        dataKey={modoGraficos === "nominal" ? "rendaMensalNominal" : "rendaMensalReal"}
                        stroke={modoGraficos === "nominal" ? C.amber : C.emerald} strokeWidth={2}
                        fill="url(#gradR)" dot={false}
                        activeDot={{ r: 4, fill: modoGraficos === "nominal" ? C.amber : C.emerald }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Fluxos */}
              <GlassCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <SectionTitle>Fluxos Anuais</SectionTitle>
                  <span style={{ fontSize: 11, color: modoGraficos === "nominal" ? C.amber : C.emerald, fontFamily: C.sans, padding: "3px 10px", borderRadius: 999, border: `1px solid ${modoGraficos === "nominal" ? C.amber : C.emerald}`, opacity: 0.8 }}>
                    {modoGraficos === "nominal" ? "valores nominais" : "poder de compra de hoje"}
                  </span>
                </div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={dadosFluxos} barCategoryGap="25%" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid {...chartProps.cartesianGrid} />
                      <XAxis dataKey="ano" {...chartProps.xAxis} />
                      <YAxis tickFormatter={v => `${Math.round(v/1000)}k`} {...chartProps.yAxis} />
                      <Tooltip formatter={v => [fmtBRL(v)]} labelFormatter={l => `Ano ${l}`} {...chartProps.tooltip} itemStyle={{ color: C.white }} />
                      <ReferenceLine x={p.prazoAcumulacao} stroke={C.slate2} strokeDasharray="3 3" />
                      <Bar dataKey={modoGraficos === "nominal" ? "fluxoNominal" : "fluxoReal"} radius={[4,4,0,0]}>
                        {dadosFluxos.map((e, i) => <Cell key={i} fill={e.cor} fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Total investido vs rendimento */}
              <GlassCard>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div><SectionTitle>Total Investido vs Rendimento</SectionTitle></div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[["Total Investido", C.emerald, resumo.totalInvestido], ["Rendimento", C.indigo, resumo.rendimento]].map(([lbl, cor, val]) => (
                      <div key={lbl} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: C.slate, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: cor, display: "inline-block" }} />{lbl}
                        </div>
                        <div style={{ fontSize: 16, color: cor, fontFamily: C.mono, fontWeight: 500 }}>{fmtCpct(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={dadosEmpilhado} barCategoryGap="20%" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid {...chartProps.cartesianGrid} />
                      <XAxis dataKey="ano" {...chartProps.xAxis} />
                      <YAxis tickFormatter={v => `${v.toFixed(1)}Mi`} {...chartProps.yAxis} />
                      <Tooltip formatter={(v, name) => [`R$ ${v.toFixed(2).replace(".",",")} mi`, name]} {...chartProps.tooltip} />
                      <Bar dataKey="totalInvestido" name="Total Investido" stackId="a" fill={C.emerald} fillOpacity={0.8} radius={[0,0,0,0]} />
                      <Bar dataKey="rendimento" name="Rendimento" stackId="a" fill={C.indigo} fillOpacity={0.85} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>
          )}

          {/* ABA: SENSIBILIDADE */}
          {abaAtiva === "sensibilidade" && (
            <div style={{ display: "grid", gap: 16 }}>
              <SensChart title="Sensibilidade · Renda Desejada" data={sensibilidadeRenda} xKey="rendaMil" xLabel="Renda mensal (mil R$)" lineColor={C.indigo} currentX={p.rendaMensalDesejada/1000} currentY={anosCasoAtual} tipPrefix="Renda" fmtX={l => `R$${l}k`} />
              <SensChart title="Sensibilidade · Aporte Mensal" data={sensibilidadeAporte} xKey="aporteMil" xLabel="Aporte mensal (mil R$)" lineColor={C.emerald} currentX={p.aporteMensal/1000} currentY={anosCasoAtual} tipPrefix="Aporte" fmtX={l => `R$${l}k`} />
              <SensChart title="Sensibilidade · Patrimônio Inicial" data={sensibilidadePat} xKey="patrimonioMil" xLabel="Patrimônio inicial (mil R$)" lineColor={C.amber} currentX={p.patrimonioInicial/1000} currentY={anosCasoAtual} tipPrefix="Patrimônio" fmtX={l => `R$${Number(l).toLocaleString("pt-BR")}k`} />
            </div>
          )}

          {/* ABA: TABELA */}
          {abaAtiva === "tabela" && (
            <GlassCard>
              {/* Header com toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <SectionTitle>Tabela da Simulação</SectionTitle>
                <div style={{ display: "flex", gap: 0, background: C.surface2, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
                  {["nominal", "real"].map(modo => (
                    <button key={modo} onClick={() => setModoTabela(modo)}
                      style={{ padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: C.sans, fontWeight: 500, transition: "all 0.2s",
                        background: modoTabela === modo ? C.indigo : "transparent",
                        color: modoTabela === modo ? "#fff" : C.slate }}>
                      {modo === "nominal" ? "Nominal" : "Real"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ overflowX: "auto", maxHeight: 560 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 750 }}>
                  <thead>
                    <tr>
                      {["Ano", "Fase",
                        "Patrimônio",
                        "Aporte Anual",
                        "Aporte Mensal",
                        "Resgate Anual",
                        "Resgate Mensal",
                      ].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: h === "Ano" || h === "Fase" ? "left" : "right", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.slate, fontWeight: 500, fontFamily: C.sans, textTransform: "uppercase", letterSpacing: "0.06em", position: "sticky", top: 0, background: C.surface, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                    <tr>
                      <th colSpan={2} style={{ background: C.surface }} />
                      {["patrimônio", "aportes", "aportes", "resgates", "resgates"].map((grupo, i) => (
                        <th key={i} style={{ padding: "4px 14px 8px", textAlign: "right", fontSize: 10, color: modoTabela === "nominal" ? C.amber : C.emerald, fontFamily: C.sans, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                          {modoTabela === "nominal" ? "nominal" : "real"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.map((d, i) => {
                      const isTransicao = d.ano === p.prazoAcumulacao;
                      const bgBase = isTransicao ? "rgba(99,102,241,0.08)" : "transparent";
                      const nom = modoTabela === "nominal";
                      const patrimonio  = nom ? d.patrimonioNominal    : d.patrimonioReal;
                      const aporteAnual = nom ? d.aporteAnualNominal   : d.aporteAnualReal;
                      const aporteMes   = nom ? d.aporteMensalNominal  : d.aporteMensalReal;
                      const resgateAnu  = nom ? d.resgateAnualNominal  : d.resgateAnualReal;
                      const resgatemMes = nom ? d.resgateNominalMensal : d.rendaMensalReal;
                      return (
                        <tr key={i} style={{ background: bgBase }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                          onMouseLeave={e => e.currentTarget.style.background = bgBase}>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: C.slate, fontFamily: C.mono, borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>{d.ano}</td>
                          <td style={{ padding: "9px 14px", borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: "nowrap" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 500, fontFamily: C.sans, background: d.fase === "Acumulação" ? "rgba(99,102,241,0.2)" : "rgba(16,185,129,0.2)", color: d.fase === "Acumulação" ? C.indigo : C.emerald }}>{d.fase}</span>
                          </td>
                          {[patrimonio, aporteAnual, aporteMes, resgateAnu, resgatemMes].map((v, j) => (
                            <td key={j} style={{ padding: "9px 14px", fontSize: 12, color: v > 0 ? C.white2 : C.slate2, fontFamily: C.mono, borderBottom: `1px solid rgba(255,255,255,0.04)`, textAlign: "right", whiteSpace: "nowrap" }}>
                              {v > 0 ? fmtBRL(v) : <span style={{ color: C.slate2 }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legenda */}
              <div style={{ marginTop: 14, display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.slate }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: C.indigo, display: "inline-block" }} />
                  Linha em destaque = transição acumulação → usufruto
                </div>
                <button onClick={exportarCSV}
                  style={{ marginLeft: "auto", padding: "6px 16px", borderRadius: 8, border: `1px solid ${C.border2}`, background: "transparent", color: C.slate, fontSize: 12, cursor: "pointer", fontFamily: C.sans }}>
                  ⬇ Exportar CSV
                </button>
              </div>
            </GlassCard>
          )}
        </main>
      </div>
    </div>
  );
}
