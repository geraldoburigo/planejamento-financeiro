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
  // renda mensal nominal inicial = primeiro resgate nominal mensal
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

const TOOLTIPS = {
  patrimonioInicial: "Valor que você já possui investido hoje.",
  aporteMensal: "Quanto você investe por mês durante a fase de acumulação.",
  crescimentoAporteAnual: "Percentual de aumento do aporte a cada ano.",
  retornoNominalAcumulacao: "Retorno bruto anual esperado na acumulação.",
  retornoNominalUsufruto: "Retorno bruto anual esperado no usufruto.",
  inflacao: "Inflação anual esperada para corrigir o poder de compra.",
  idadeAtual: "Sua idade atual.",
  idadeAposentadoria: "Idade em que pretende se aposentar e começar a retirar.",
  prazoUsufruto: "Por quantos anos pretende viver do patrimônio acumulado.",
  taxaRetiradaAnual: "% do patrimônio retirado por ano. Regra dos 4% = sustentabilidade por 30+ anos.",
  modoUsufruto: "Fixa: mantém poder de compra. Variável: retira % do patrimônio atual.",
  rendaMensalDesejada: "Renda mensal desejada na aposentadoria, em valores de hoje.",
};

const C = {
  bg: "#0f172a", surface: "#1e293b", surface2: "#273344",
  border: "rgba(255,255,255,0.08)", border2: "rgba(255,255,255,0.14)",
  indigo: "#6366f1", emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e",
  slate: "#94a3b8", slate2: "#64748b", white: "#f8fafc", white2: "#e2e8f0",
  mono: "'JetBrains Mono', 'Roboto Mono', monospace",
  sans: "'Inter', 'Manrope', system-ui, sans-serif",
};

export default function App() {
  const [parametros, setParametros] = useState(() => {
    try { const s = localStorage.getItem("pf-v3"); return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS; } catch { return DEFAULTS; }
  });
  const [accOpen, setAccOpen] = useState(true);
  const [usuOpen, setUsuOpen] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("graficos");
  const [modoApp, setModoApp] = useState("acumulacao"); // "acumulacao" | "usufruto"
  const [tooltipAtivo, setTooltipAtivo] = useState(null);
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
  const relatorioRef = useRef(null);

  // Parâmetros do modo usufruto puro
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
  // Patrimônio necessário nominal = ajustado pela inflação acumulada no prazo de acumulação
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
    return {
      prazo, patReal, patNominal, heranca, atingeMeta, fmtC, fmtB,
      rendaMensalReal: resumo.rendaMensalRealInicial,
      rendaMensalNominal: resumo.rendaMensalNominalInicial,
      rendaMeta: p.rendaMensalDesejada,
      patNecessarioReal: patrimonioNecessarioReal,
      patNecessarioNominal: patrimonioNecessarioNominal,
      anoEsgot: resumo.anoEsgotamento,
      prazoAcc: p.prazoAcumulacao,
      prazoUsu: p.prazoUsufruto,
      idadeAtual: p.idadeAtual,
      idadeAposentadoria: p.idadeAposentadoria,
      supereRenda: resumo.rendaMensalRealInicial >= p.rendaMensalDesejada,
    };
  }, [p, resumo, anosCasoAtual, dados, patrimonioNecessarioReal, patrimonioNecessarioNominal]);

  // ── MODO USUFRUTO PURO ─────────────────────────────────────────────────
  const cenariosUsufruto = useMemo(() => {
    const pat0      = limparMoeda(pu.patrimonio);
    const retNom    = (parseFloat(pu.retornoNominal) || 0) / 100;
    const infl      = (parseFloat(pu.inflacao) || 0) / 100;
    const prazo     = Math.min(parseInt(pu.prazo) || 30, 60); // limita a 60 anos
    const taxaAnual = (parseFloat(pu.taxaRetirada) || 4) / 100;
    const modo      = pu.modoUsufruto || "fixa";
    const txMesNom  = Math.pow(1 + retNom, 1/12) - 1;
    const txInflMes = Math.pow(1 + infl, 1/12) - 1;
    const meses     = prazo * 12;

    const rendaMensalReal = pat0 * taxaAnual / 12;

    const simular = () => {
      const pts = [{ ano: 0, patNominal: pat0, patReal: pat0, retirNominal: 0, retirReal: 0, retirNomMensal: 0, retirRealMensal: 0 }];
      let patNominal = pat0, fatorInfl = 1, rendaReal = rendaMensalReal;
      let retirAcumNom = 0, retirAcumReal = 0;
      let anoEsgotamento = null;

      for (let mes = 1; mes <= meses; mes++) {
        // Se já zerou, apenas empurra zeros sem calcular
        if (patNominal <= 0) {
          fatorInfl *= 1 + txInflMes;
          if (mes % 12 === 0) pts.push({ ano: mes/12, patNominal: 0, patReal: 0, retirNominal: 0, retirReal: 0, retirNomMensal: 0, retirRealMensal: 0 });
          continue;
        }

        const rendimento = patNominal * txMesNom;
        let retiradaNom;
        if (modo === "fixa") {
          retiradaNom = rendaReal * fatorInfl;
        } else {
          retiradaNom = patNominal * taxaAnual / 12;
          rendaReal = retiradaNom / fatorInfl;
        }
        patNominal = patNominal + rendimento - retiradaNom;

        if (patNominal <= 0) {
          patNominal = 0;
          if (!anoEsgotamento) anoEsgotamento = Math.ceil(mes / 12);
        }

        fatorInfl *= 1 + txInflMes;
        const patReal = patNominal / fatorInfl;
        retirAcumNom  += retiradaNom;
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

  const glass = { background: "rgba(30,41,59,0.7)", border: `1px solid ${C.border2}`, borderRadius: 16, backdropFilter: "blur(12px)" };

  const GlassCard = ({ children, style = {} }) => (
    <div style={{ ...glass, padding: "18px 20px", transition: "border-color 0.2s", ...style }}>{children}</div>
  );

  const MetricCard = ({ label, value, sub, accent = C.indigo, icon, subColor }) => (
    <GlassCard style={{ minHeight: 120, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px 18px" }}>
      {/* Label + ícone — sempre em uma linha, label trunca se necessário */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: C.slate, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: C.sans, lineHeight: 1.5, flex: 1 }}>{label}</span>
        {icon && <span style={{ fontSize: 13, opacity: 0.6, flexShrink: 0 }}>{icon}</span>}
      </div>
      {/* Valor — fonte adaptativa via fitText trick com tamanho fixo grande */}
      <div style={{ fontSize: 20, fontWeight: 600, color: accent, fontFamily: C.mono, letterSpacing: "-0.02em", lineHeight: 1.2, wordBreak: "break-all" }}>{value}</div>
      {/* Sub — sempre na base */}
      <div style={{ fontSize: 10, color: subColor || C.slate2, marginTop: 8, fontFamily: C.sans }}>{sub || "\u00A0"}</div>
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

  const tabStyle = (aba) => ({
    padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: C.sans, fontWeight: 500, transition: "all 0.2s",
    background: abaAtiva === aba ? C.indigo : "transparent",
    color: abaAtiva === aba ? "#fff" : C.slate,
  });

  // Helper para inputs de idade/inteiro inline
  const inputStyle = (campo) => ({
    width: "100%", padding: "8px 40px 8px 10px", background: C.surface2,
    border: `1px solid ${inputFoco[campo] ? C.indigo : C.border2}`, borderRadius: 8,
    color: C.white, fontSize: 13, fontFamily: C.mono, outline: "none",
    boxSizing: "border-box", WebkitAppearance: "none", MozAppearance: "textfield",
    transition: "border-color 0.2s",
  });

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: C.bg, fontFamily: C.sans, color: C.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        input[type=range]::-webkit-slider-thumb { background: ${C.indigo}; }
        input[type=range]::-webkit-slider-runnable-track { background: ${C.surface2}; border-radius: 4px; height: 4px; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${C.border2}; border-radius: 4px; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", height: "100vh", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${C.indigo}, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📊</div>
              <span style={{ fontSize: 17, fontWeight: 700, color: C.white, letterSpacing: "-0.01em", lineHeight: 1.2 }}>Planejamento Financeiro</span>
            </div>
            {/* Toggle modo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: C.bg, borderRadius: 10, padding: 3 }}>
              {[["acumulacao", "📈", "Acumulação"], ["usufruto", "🌅", "Só Usufruto"]].map(([modo, icon, label]) => (
                <button key={modo} onClick={() => { setModoApp(modo); setTimeout(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, 50); }}
                  style={{ padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontFamily: C.sans, fontWeight: 600, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    background: modoApp === modo ? (modo === "acumulacao" ? C.indigo : C.emerald) : "transparent",
                    color: modoApp === modo ? "#fff" : C.slate }}>
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          <div ref={sidebarRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>

          {/* ── SIDEBAR USUFRUTO PURO ── */}
          {modoApp === "usufruto" && (
            <div>
              <div style={{ marginBottom: 8, border: `1px solid ${C.emerald}40`, borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: `${C.emerald}12`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🌅</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.white2 }}>Fase de Usufruto</span>
                </div>
                <div style={{ padding: "14px 14px 8px", background: "rgba(15,23,42,0.3)" }}>

                  {/* Patrimônio Atual */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Patrimônio Atual</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
                      <input type="text"
                        value={inputFoco["u_patrimonio"] ? (inputTemp["u_patrimonio"] || "") : pu.patrimonio}
                        onFocus={() => { setInputFoco(f => ({...f, u_patrimonio: true})); setInputTemp(t => ({...t, u_patrimonio: String(limparMoeda(pu.patrimonio) || "")})); }}
                        onBlur={() => { setInputFoco(f => ({...f, u_patrimonio: false})); const n = parseFloat((inputTemp["u_patrimonio"]||"0").replace(",","."))||0; setPu(prev => ({...prev, patrimonio: n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})})); }}
                        onChange={e => setInputTemp(t => ({...t, u_patrimonio: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, background:C.surface2, border:`1px solid ${inputFoco["u_patrimonio"]?C.emerald:C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box" }} />
                    </div>
                  </div>

                  {/* Idade Atual */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Idade Atual</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={pu.idadeAtual} min={20} max={100}
                        onChange={e => setPu(prev => ({...prev, idadeAtual: e.target.value}))}
                        style={{ width:"100%", padding:"8px 40px 8px 10px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box" }} />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.slate, pointerEvents:"none" }}>anos</span>
                    </div>
                  </div>

                  {/* Prazo */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Prazo de Usufruto</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={pu.prazo} min={1} max={60}
                        onChange={e => setPu(prev => ({...prev, prazo: e.target.value}))}
                        style={{ width:"100%", padding:"8px 40px 8px 10px", background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box" }} />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.slate, pointerEvents:"none" }}>anos</span>
                    </div>
                  </div>

                  {/* Sliders: Retorno Nominal e Inflação */}
                  {[
                    { label: "Retorno Nominal", key: "retornoNominal", min: 0, max: 30 },
                    { label: "Inflação", key: "inflacao", min: 0, max: 20 },
                  ].map(({ label, key, min, max }) => {
                    const raw = parseFloat(pu[key] || "0") || 0;
                    return (
                      <div key={key} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                          <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans, flex: 1 }}>{label}</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco[`u_${key}`] ? (inputTemp[`u_${key}`] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(f => ({...f, [`u_${key}`]: true})); setInputTemp(t => ({...t, [`u_${key}`]: String(raw)})); }}
                              onBlur={() => { setInputFoco(f => ({...f, [`u_${key}`]: false})); const n = parseFloat((inputTemp[`u_${key}`]||"0").replace(",",".")); if (!isNaN(n)) setPu(prev => ({...prev, [key]: String(Math.min(max, Math.max(min, n)))})); }}
                              onChange={e => setInputTemp(t => ({...t, [`u_${key}`]: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 72, textAlign: "right", fontSize: 12, color: C.white, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[`u_${key}`] ? C.emerald : C.border}`, borderRadius: 6, padding: "3px 22px 3px 8px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw}
                          onChange={e => setPu(prev => ({...prev, [key]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.emerald, cursor: "pointer", height: 4, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.slate2, marginTop: 4 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Retorno real automático */}
                  {(() => {
                    const retNom = parseFloat(pu.retornoNominal || "0") || 0;
                    const infl   = parseFloat(pu.inflacao || "0") || 0;
                    const retReal = ((1 + retNom/100) / (1 + infl/100) - 1) * 100;
                    const cor = retReal >= 0 ? C.emerald : C.rose;
                    return (
                      <div style={{ marginBottom: 14, padding: "8px 12px", background: `${cor}18`, borderRadius: 8, border: `1px solid ${cor}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: C.slate }}>Retorno real</span>
                        <span style={{ fontSize: 14, color: cor, fontFamily: C.mono, fontWeight: 600 }}>{retReal >= 0 ? "+" : ""}{retReal.toFixed(2).replace(".",",")}%</span>
                      </div>
                    );
                  })()}

                  {/* Taxa de Retirada */}
                  {(() => {
                    const raw = parseFloat(pu.taxaRetirada || "4") || 4;
                    return (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                          <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans, flex: 1 }}>Taxa de Retirada Anual</span>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            <input type="text"
                              value={inputFoco["u_taxaRetirada"] ? (inputTemp["u_taxaRetirada"] || "") : raw.toFixed(1)}
                              onFocus={() => { setInputFoco(f => ({...f, u_taxaRetirada: true})); setInputTemp(t => ({...t, u_taxaRetirada: String(raw)})); }}
                              onBlur={() => { setInputFoco(f => ({...f, u_taxaRetirada: false})); const n = parseFloat((inputTemp["u_taxaRetirada"]||"0").replace(",",".")); if (!isNaN(n)) setPu(prev => ({...prev, taxaRetirada: String(Math.min(20, Math.max(0.5, n)))})); }}
                              onChange={e => setInputTemp(t => ({...t, u_taxaRetirada: e.target.value.replace(/[^0-9.,]/g,"")}))}
                              style={{ width: 72, textAlign: "right", fontSize: 12, color: C.white, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco["u_taxaRetirada"] ? C.emerald : C.border}`, borderRadius: 6, padding: "3px 22px 3px 8px", outline: "none" }}
                            />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={0.5} max={20} step={0.1} value={raw}
                          onChange={e => setPu(prev => ({...prev, taxaRetirada: e.target.value}))}
                          style={{ width: "100%", accentColor: C.emerald, cursor: "pointer", height: 4, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.slate2, marginTop: 4 }}>
                          <span>0.5%</span><span>20%</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Modo de Usufruto */}
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Modo de Usufruto</span>
                    <select value={pu.modoUsufruto || "fixa"} onChange={e => setPu(prev => ({...prev, modoUsufruto: e.target.value}))}
                      style={{ width: "100%", padding: "8px 10px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.white, fontSize: 12, fontFamily: C.sans, outline: "none" }}>
                      <option value="fixa">Renda fixa real</option>
                      <option value="variavel">Retirada percentual</option>
                    </select>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ── SIDEBAR ACUMULAÇÃO (original) ── */}
          {modoApp === "acumulacao" && (
            <div>
            <div style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setAccOpen(!accOpen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: accOpen ? C.surface2 : "transparent", border: "none", cursor: "pointer", color: C.white2, fontFamily: C.sans, fontSize: 13, fontWeight: 500 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span>📈</span>Fase de Acumulação</span>
                <span style={{ color: C.slate, fontSize: 10, transform: accOpen ? "rotate(180deg)" : "none" }}>▼</span>
              </button>
              {accOpen && (
                <div style={{ padding: "14px 14px 8px", background: "rgba(15,23,42,0.3)" }}>

                  {/* Idades lado a lado */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Idade atual</label>
                      <div style={{ position: "relative" }}>
                        <input type="number" value={parametros.idadeAtual} min={10} max={100}
                          onChange={e => setP("idadeAtual", e.target.value)}
                          onFocus={() => setInputFoco(p => ({...p, idadeAtual: true}))}
                          onBlur={() => setInputFoco(p => ({...p, idadeAtual: false}))}
                          style={inputStyle("idadeAtual")} />
                        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>anos</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Aposentadoria</label>
                      <div style={{ position: "relative" }}>
                        <input type="number" value={parametros.idadeAposentadoria} min={11} max={100}
                          onChange={e => setP("idadeAposentadoria", e.target.value)}
                          onFocus={() => setInputFoco(p => ({...p, idadeAposentadoria: true}))}
                          onBlur={() => setInputFoco(p => ({...p, idadeAposentadoria: false}))}
                          style={inputStyle("idadeAposentadoria")} />
                        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>anos</span>
                      </div>
                    </div>
                  </div>

                  {/* Prazo calculado — só leitura */}
                  <div style={{ marginBottom: 14, padding: "8px 12px", background: `${C.indigo}18`, borderRadius: 8, border: `1px solid ${C.indigo}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans }}>Prazo de acumulação</span>
                    <span style={{ fontSize: 14, color: C.indigo, fontFamily: C.mono, fontWeight: 600 }}>{p.prazoAcumulacao} anos</span>
                  </div>

                  {/* Patrimônio Inicial */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Patrimônio Inicial</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
                      <input type="text" value={inputFoco["patrimonioInicial"] ? (inputTemp["patrimonioInicial"] || "") : (parametros.patrimonioInicial || "")}
                        onFocus={() => { setInputFoco(p => ({...p, patrimonioInicial: true})); setInputTemp(p => ({...p, patrimonioInicial: String(limparMoeda(parametros.patrimonioInicial) || "")})); }}
                        onBlur={() => sairCampoMoeda("patrimonioInicial")}
                        onChange={e => setInputTemp(p => ({...p, patrimonioInicial: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, background:C.surface2, border:`1px solid ${inputFoco["patrimonioInicial"]?C.indigo:C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" }} />
                    </div>
                  </div>

                  {/* Aporte Mensal */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Aporte Mensal</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
                      <input type="text" value={inputFoco["aporteMensal"] ? (inputTemp["aporteMensal"] || "") : (parametros.aporteMensal || "")}
                        onFocus={() => { setInputFoco(p => ({...p, aporteMensal: true})); setInputTemp(p => ({...p, aporteMensal: String(limparMoeda(parametros.aporteMensal) || "")})); }}
                        onBlur={() => sairCampoMoeda("aporteMensal")}
                        onChange={e => setInputTemp(p => ({...p, aporteMensal: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, background:C.surface2, border:`1px solid ${inputFoco["aporteMensal"]?C.indigo:C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" }} />
                    </div>
                  </div>

                  {/* Renda Mensal Desejada */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Renda Mensal Desejada (meta)</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: C.slate, pointerEvents: "none" }}>R$</span>
                      <input type="text" value={inputFoco["rendaMensalDesejada"] ? (inputTemp["rendaMensalDesejada"] || "") : (parametros.rendaMensalDesejada || "")}
                        onFocus={() => { setInputFoco(p => ({...p, rendaMensalDesejada: true})); setInputTemp(p => ({...p, rendaMensalDesejada: String(limparMoeda(parametros.rendaMensalDesejada) || "")})); }}
                        onBlur={() => sairCampoMoeda("rendaMensalDesejada")}
                        onChange={e => setInputTemp(p => ({...p, rendaMensalDesejada: e.target.value.replace(/[^0-9.,]/g,"")}))}
                        style={{ width:"100%", paddingLeft:30, paddingRight:10, paddingTop:8, paddingBottom:8, background:C.surface2, border:`1px solid ${inputFoco["rendaMensalDesejada"]?C.indigo:C.border2}`, borderRadius:8, color:C.white, fontSize:13, fontFamily:C.mono, outline:"none", boxSizing:"border-box", transition:"border-color 0.2s" }} />
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
                              style={{ width: 72, textAlign: "right", fontSize: 12, color: C.white, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[campo] ? C.indigo : C.border}`, borderRadius: 6, padding: "3px 22px 3px 8px", outline: "none", transition: "border-color 0.2s" }}
                            />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw} onChange={e => setParametros(p => ({...p, [campo]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.indigo, cursor: "pointer", height: 4, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.slate2, marginTop: 4 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Retorno real acumulação — calculado automaticamente (Fisher) */}
                  {(() => {
                    const retNom = parseFloat((parametros.retornoNominalAcumulacao || "0").replace(",", ".")) || 0;
                    const infl   = parseFloat((parametros.inflacao || "0").replace(",", ".")) || 0;
                    const retReal = ((1 + retNom/100) / (1 + infl/100) - 1) * 100;
                    const cor = retReal >= 0 ? C.emerald : C.rose;
                    return (
                      <div style={{ marginBottom: 14, padding: "8px 12px", background: `${cor}18`, borderRadius: 8, border: `1px solid ${cor}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans }}>Retorno real (acumulação)</span>
                        <span style={{ fontSize: 14, color: cor, fontFamily: C.mono, fontWeight: 600 }}>
                          {retReal >= 0 ? "+" : ""}{retReal.toFixed(2).replace(".", ",")}%
                        </span>
                      </div>
                    );
                  })()}
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
                <div style={{ padding: "14px 14px 8px", background: "rgba(15,23,42,0.3)" }}>
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
                              style={{ width: 72, textAlign: "right", fontSize: 12, color: C.white, fontFamily: C.mono, background: C.surface2, border: `1px solid ${inputFoco[campo] ? C.indigo : C.border}`, borderRadius: 6, padding: "3px 22px 3px 8px", outline: "none", transition: "border-color 0.2s" }}
                            />
                            <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>%</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={0.1} value={raw} onChange={e => setParametros(p => ({...p, [campo]: e.target.value}))}
                          style={{ width: "100%", accentColor: C.indigo, cursor: "pointer", height: 4, display: "block" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.slate2, marginTop: 4 }}>
                          <span>{min}%</span><span>{max}%</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Retorno real usufruto — calculado automaticamente (Fisher) */}
                  {(() => {
                    const retNom = parseFloat((parametros.retornoNominalUsufruto || "0").replace(",", ".")) || 0;
                    const infl   = parseFloat((parametros.inflacao || "0").replace(",", ".")) || 0;
                    const retReal = ((1 + retNom/100) / (1 + infl/100) - 1) * 100;
                    const cor = retReal >= 0 ? C.emerald : C.rose;
                    return (
                      <div style={{ marginBottom: 14, padding: "8px 12px", background: `${cor}18`, borderRadius: 8, border: `1px solid ${cor}30`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: C.slate, fontFamily: C.sans }}>Retorno real (usufruto)</span>
                        <span style={{ fontSize: 14, color: cor, fontFamily: C.mono, fontWeight: 600 }}>
                          {retReal >= 0 ? "+" : ""}{retReal.toFixed(2).replace(".", ",")}%
                        </span>
                      </div>
                    );
                  })()}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Prazo de Usufruto</label>
                    <div style={{ position: "relative" }}>
                      <input type="number" value={parametros.prazoUsufruto} onChange={e => setP("prazoUsufruto", e.target.value)} min={1} max={60}
                        onFocus={() => setInputFoco(p => ({...p, prazoUsufruto: true}))}
                        onBlur={() => setInputFoco(p => ({...p, prazoUsufruto: false}))}
                        style={inputStyle("prazoUsufruto")} />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.slate, pointerEvents: "none" }}>anos</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Modo de Usufruto</span>
                    <select value={parametros.modoUsufruto} onChange={e => setP("modoUsufruto", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.white, fontSize: 12, fontFamily: C.sans, outline: "none" }}>
                      <option value="fixa">Renda fixa real</option>
                      <option value="variavel">Retirada percentual</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            </div>
          )}{/* fim modoApp === acumulacao na sidebar */}
          </div>

          <div style={{ padding: "14px", borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => setModalPdf(true)}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.emerald}, #0d9488)`, color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: C.sans, fontWeight: 600, marginBottom: 8 }}>
              📄 Gerar Relatório PDF
            </button>
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
        <main ref={mainRef} style={{ padding: "24px", overflowY: "auto", height: "100vh" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>

            {/* Nome + consultoria */}
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.white, letterSpacing: "-0.01em" }}>Geraldo Búrigo</div>
              <div style={{ fontSize: 13, color: C.slate, marginTop: 3 }}>Consultoria Financeira</div>
            </div>

            {/* Abas — só no modo acumulação */}
            {modoApp === "acumulacao" && (
              <div style={{ display: "flex", gap: 6, background: C.surface2, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
                {["graficos", "sensibilidade", "tabela"].map(aba => (
                  <button key={aba} style={tabStyle(aba)} onClick={() => setAbaAtiva(aba)}>
                    {aba === "graficos" ? "Visão Geral" : aba === "sensibilidade" ? "Sensibilidade" : "Tabela"}
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
            const herancaReal    = ultimo?.patReal    ?? 0;
            const rendaMensalNominal = pontos.length > 1 ? (pontos[1]?.retirNomMensal ?? 0) : 0;

            return (
              <div>
                {/* Banner de modo */}
                <GlassCard style={{ marginBottom: 20, borderLeft: `3px solid ${anoEsgotamento ? C.rose : C.emerald}`, borderRadius: "0 16px 16px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, color: anoEsgotamento ? C.rose : C.emerald, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
                        {anoEsgotamento ? "⚠️ Patrimônio se esgota" : "🌅 Simulador de Renda Sustentável"}
                      </div>
                      <div style={{ fontSize: 13, color: C.slate }}>
                        Patrimônio de <span style={{ color: C.white, fontFamily: C.mono, fontWeight: 600 }}>{fmtCpct(pat0)}</span>
                        {" · "}Prazo de <span style={{ color: C.white, fontFamily: C.mono, fontWeight: 600 }}>{prazo} anos</span>
                        {" · "}Taxa de <span style={{ color: C.white, fontFamily: C.mono, fontWeight: 600 }}>{pu.taxaRetirada || "4"}% a.a.</span>
                        {anoEsgotamento && <span style={{ color: C.rose, fontWeight: 600 }}> · Esgota no ano {anoEsgotamento} (aos {parseInt(pu.idadeAtual||60) + anoEsgotamento} anos)</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: C.slate, marginBottom: 2 }}>Retorno real</div>
                      {(() => {
                        const rn = parseFloat(pu.retornoNominal||0); const inf = parseFloat(pu.inflacao||0);
                        const rr = ((1+rn/100)/(1+inf/100)-1)*100;
                        return <div style={{ fontSize: 18, color: rr>=0?C.emerald:C.rose, fontFamily: C.mono, fontWeight: 700 }}>{rr>=0?"+":""}{rr.toFixed(2).replace(".",",")}%</div>;
                      })()}
                    </div>
                  </div>
                </GlassCard>

                {/* Cards resultados */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 20 }}>
                  <MetricCard label="Herança · Patrimônio Nominal" value={fmtCpct(herancaNominal)} sub={`Fim do usufruto (${idadeAtual + prazo} anos)`} accent={C.amber} icon="🏦" />
                  <MetricCard label="Herança · Patrimônio Real" value={fmtCpct(herancaReal)} sub="Poder de compra hoje" accent={C.indigo} icon="📈" />
                  <MetricCard label="Renda Mensal Nominal" value={fmtCpct(rendaMensalNominal)} sub="Primeiro ano de retirada" accent={C.amber} icon="💵" />
                  <MetricCard label="Renda Mensal Real" value={fmtCpct(rendaMensalReal)} sub="Poder de compra hoje" accent={C.emerald} icon="💰" />
                </div>

                {/* Toggle Nominal / Real */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 0, background: C.surface2, borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
                    {["nominal", "real"].map(modo => (
                      <button key={modo} onClick={() => setModoGraficosUsu(modo)}
                        style={{ padding: "6px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: C.sans, fontWeight: 500, transition: "all 0.2s",
                          background: modoGraficosUsu === modo ? (modo === "nominal" ? C.amber : C.indigo) : "transparent",
                          color: modoGraficosUsu === modo ? "#fff" : C.slate }}>
                        {modo === "nominal" ? "Nominal" : "Ajustado pela inflação"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gráfico patrimônio */}
                <GlassCard style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <SectionTitle>Evolução do Patrimônio ao Longo do Usufruto</SectionTitle>
                    <span style={{ fontSize: 11, color: modoGraficosUsu === "nominal" ? C.amber : C.indigo, padding: "3px 10px", borderRadius: 999, border: `1px solid ${modoGraficosUsu === "nominal" ? C.amber : C.indigo}`, opacity: 0.8 }}>
                      {modoGraficosUsu === "nominal" ? "valores nominais" : "poder de compra de hoje"}
                    </span>
                  </div>
                  <div style={{ height: 300 }}>
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
                            <div style={{ ...chartProps.tooltip.contentStyle, padding: "12px 16px" }}>
                              <div style={{ fontSize: 11, color: C.slate, marginBottom: 8 }}>Ano {label} · {idadeAtual + label} anos</div>
                              <div style={{ color: modoGraficosUsu === "nominal" ? C.amber : C.indigo, fontFamily: C.mono, fontWeight: 600 }}>Patrimônio: {fmtBRL(val)}</div>
                            </div>
                          );
                        }} />
                        <Area type="monotone" dataKey={modoGraficosUsu === "nominal" ? "patNominal" : "patReal"}
                          stroke={modoGraficosUsu === "nominal" ? C.amber : C.indigo} strokeWidth={2}
                          fill="url(#gradUsu)" dot={false}
                          activeDot={{ r: 4, fill: modoGraficosUsu === "nominal" ? C.amber : C.indigo }} />
                        {anoEsgotamento && (
                          <ReferenceLine x={anoEsgotamento} stroke={C.rose} strokeDasharray="4 4"
                            label={{ value: "Esgotamento", position: "insideTopRight", fill: C.rose, fontSize: 10 }} />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Gráfico retiradas */}
                <GlassCard style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <SectionTitle>Retirada Anual ao Longo do Usufruto</SectionTitle>
                    <span style={{ fontSize: 11, color: modoGraficosUsu === "nominal" ? C.amber : C.emerald, padding: "3px 10px", borderRadius: 999, border: `1px solid ${modoGraficosUsu === "nominal" ? C.amber : C.emerald}`, opacity: 0.8 }}>
                      {modoGraficosUsu === "nominal" ? "valores nominais" : "poder de compra de hoje"}
                    </span>
                  </div>
                  <div style={{ height: 260 }}>
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
                          const anual  = modoGraficosUsu === "nominal" ? d?.retirNominal    : d?.retirReal;
                          const mensal = modoGraficosUsu === "nominal" ? d?.retirNomMensal  : d?.retirRealMensal;
                          return (
                            <div style={{ ...chartProps.tooltip.contentStyle, padding: "12px 16px" }}>
                              <div style={{ fontSize: 11, color: C.slate, marginBottom: 8 }}>Ano {label} · {idadeAtual + label} anos</div>
                              <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:4 }}>
                                <span style={{ fontSize:11, color: cor }}>Retirada anual</span>
                                <span style={{ fontSize:12, color: cor, fontFamily: C.mono, fontWeight:600 }}>{fmtBRL(anual)}</span>
                              </div>
                              <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
                                <span style={{ fontSize:11, color: cor }}>Retirada mensal</span>
                                <span style={{ fontSize:12, color: cor, fontFamily: C.mono, fontWeight:600 }}>{fmtBRL(mensal)}</span>
                              </div>
                            </div>
                          );
                        }} />
                        <Area type="monotone"
                          dataKey={modoGraficosUsu === "nominal" ? "retirNominal" : "retirReal"}
                          stroke={modoGraficosUsu === "nominal" ? C.amber : C.emerald} strokeWidth={2}
                          fill="url(#gradRetir)" dot={false}
                          activeDot={{ r: 4, fill: modoGraficosUsu === "nominal" ? C.amber : C.emerald }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Tabela evolução */}
                <GlassCard>
                  <SectionTitle>Evolução Anual — Patrimônio e Retiradas</SectionTitle>
                  <div style={{ overflowX: "auto", maxHeight: 460 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                      <thead>
                        <tr>
                          {[
                            ["Ano","left",C.slate], ["Idade","left",C.slate],
                            ["Pat. Nominal","right",C.amber], ["Pat. Real","right",C.indigo],
                            ["Retirada Anual Nom.","right",C.amber], ["Retirada Anual Real","right",C.emerald],
                            ["Retirada Mensal Nom.","right",C.amber], ["Retirada Mensal Real","right",C.emerald],
                          ].map(([h, align, cor]) => (
                            <th key={h} style={{ padding:"10px 14px", textAlign: align, borderBottom:`1px solid ${C.border}`, fontSize:10, color: cor, fontWeight:500, fontFamily:C.sans, textTransform:"uppercase", letterSpacing:"0.06em", position:"sticky", top:0, background:C.surface, whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pontos.map((d, i) => {
                          const bg = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)";
                          return (
                            <tr key={d.ano} style={{ background: bg }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                              onMouseLeave={e => e.currentTarget.style.background = bg}>
                              <td style={{ padding:"8px 14px", fontSize:12, color:C.slate, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)` }}>{d.ano}</td>
                              <td style={{ padding:"8px 14px", fontSize:12, color:C.white2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)` }}>{idadeAtual + d.ano}</td>
                              <td style={{ padding:"8px 14px", fontSize:12, color: d.patNominal>0?C.amber:C.slate2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)`, textAlign:"right" }}>{d.patNominal>0?fmtBRL(d.patNominal):"—"}</td>
                              <td style={{ padding:"8px 14px", fontSize:12, color: d.patReal>0?C.indigo:C.slate2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)`, textAlign:"right" }}>{d.patReal>0?fmtBRL(d.patReal):"—"}</td>
                              <td style={{ padding:"8px 14px", fontSize:12, color: d.retirNominal>0?C.amber:C.slate2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)`, textAlign:"right" }}>{d.retirNominal>0?fmtBRL(d.retirNominal):"—"}</td>
                              <td style={{ padding:"8px 14px", fontSize:12, color: d.retirReal>0?C.emerald:C.slate2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)`, textAlign:"right" }}>{d.retirReal>0?fmtBRL(d.retirReal):"—"}</td>
                              <td style={{ padding:"8px 14px", fontSize:12, color: d.retirNomMensal>0?C.amber:C.slate2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)`, textAlign:"right" }}>{d.retirNomMensal>0?fmtBRL(d.retirNomMensal):"—"}</td>
                              <td style={{ padding:"8px 14px", fontSize:12, color: d.retirRealMensal>0?C.emerald:C.slate2, fontFamily:C.mono, borderBottom:`1px solid rgba(255,255,255,0.04)`, textAlign:"right" }}>{d.retirRealMensal>0?fmtBRL(d.retirRealMensal):"—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            );
          })()}

          {/* ── MODO ACUMULAÇÃO + USUFRUTO ── */}
          {modoApp === "acumulacao" && <>

          {/* Resumo Executivo */}
          {(() => {
            const { prazo, patReal, heranca, atingeMeta, fmtC, fmtB, rendaMensalReal, rendaMeta, patNecessarioReal, anoEsgot, prazoAcc, prazoUsu, idadeAtual, idadeAposentadoria, supereRenda } = resumoDados;
            const D = ({ children, cor }) => (
              <span style={{ color: cor, fontWeight: 700, fontSize: 15, fontFamily: C.mono, letterSpacing: "-0.01em" }}>{children}</span>
            );
            return (
              <GlassCard style={{ marginBottom: 20, borderLeft: `3px solid ${C.indigo}`, borderRadius: "0 16px 16px 0" }}>
                <div style={{ fontSize: 14, color: C.indigo, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14, fontWeight: 700 }}>Resumo Executivo</div>
                <div style={{ fontSize: 15, color: C.slate, lineHeight: 2, fontFamily: C.sans }}>
                  {prazo
                    ? <>Aos <D cor={C.white}>{Math.round(idadeAtual + prazo)} anos</D> você atingirá a independência financeira — em aproximadamente <D cor={C.white}>{prazo.toFixed(1).replace(".", ",")} anos</D>. </>
                    : <>A meta <D cor={C.rose}>não é atingida</D> dentro de 80 anos — considere aumentar o aporte ou reduzir a renda desejada. </>
                  }
                  Ao se aposentar aos <D cor={C.white}>{idadeAposentadoria} anos</D>, após <D cor={C.white}>{prazoAcc} anos</D> de acumulação, seu patrimônio real será de{" "}
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
                    ? <><D cor={C.rose}>⚠ Atenção:</D> o patrimônio se esgota no ano <D cor={C.rose}>{anoEsgot}</D>. Considere reduzir a taxa de retirada.</>
                    : <>O patrimônio sustenta os <D cor={C.white}>{prazoUsu} anos</D> de usufruto{heranca > 0 ? <>, com herança projetada de <D cor={C.amber}>{fmtC(heranca)}</D>.</> : <>.</>}</>
                  }
                </div>
              </GlassCard>
            );
          })()}

          {/* Cards linha 1 — 4 cards: patrimônio nominal/real + renda nominal/real */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
            <MetricCard label="Patrimônio Nominal" value={fmtCpct(resumo.patrimonioAcumuladoNominal)} sub="Valor futuro nominal" accent={C.amber} icon="🏦" />
            <MetricCard label="Patrimônio Real" value={fmtCpct(resumo.patrimonioAcumuladoReal)} sub="Poder de compra hoje" accent={C.indigo} icon="📈" />
            <MetricCard label="Renda Mensal Nominal" value={fmtCpct(resumo.rendaMensalNominalInicial)} sub="Valor futuro nominal" accent={C.amber} icon="💵" />
            <MetricCard label="Renda Mensal Real" value={fmtCpct(resumo.rendaMensalRealInicial)} sub="Poder de compra hoje" accent={C.emerald} icon="💰" />
          </div>

          {/* Cards linha 2 — 4 cards: aporte necessário, tempo para meta, patrimônio necessário nominal/real */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 20 }}>
            <MetricCard
              label="Aporte Necessário"
              value={aporteNecessario ? fmtCpct(aporteNecessario) : "—"}
              sub={`Mensal · meta em ${p.prazoAcumulacao} anos`}
              accent={C.slate} icon="🎯"
            />
            <MetricCard
              label="Tempo para Meta"
              value={anosCasoAtual ? `${anosCasoAtual.toFixed(1).replace(".",",")} anos` : "Não atinge"}
              sub={anosCasoAtual ? `Aos ${Math.round(p.idadeAtual + anosCasoAtual)} anos de idade` : "Ajuste os parâmetros"}
              accent={C.white2} icon="⏱"
            />
            <MetricCard
              label="Patrimônio Necessário Nominal"
              value={fmtCpct(patrimonioNecessarioNominal)}
              sub={metaAtingida ? "✓ Meta atingida" : "✗ Meta não atingida"}
              accent={metaAtingida ? C.emerald : C.rose}
              subColor={metaAtingida ? C.emerald : C.rose}
              icon={metaAtingida ? "✅" : "⚠️"}
            />
            <MetricCard
              label="Patrimônio Necessário Real"
              value={fmtCpct(patrimonioNecessarioReal)}
              sub={metaAtingida ? "✓ Meta atingida" : "✗ Meta não atingida"}
              accent={metaAtingida ? C.emerald : C.rose}
              subColor={metaAtingida ? C.emerald : C.rose}
              icon={metaAtingida ? "✅" : "⚠️"}
            />
          </div>

          {/* ABA: VISÃO GERAL */}
          {abaAtiva === "graficos" && (
            <div style={{ display: "grid", gap: 16 }}>
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
                  <SectionTitle>{modoGraficos === "nominal" ? "Patrimônio Nominal ao Longo do Tempo" : "Patrimônio Real ao Longo do Tempo"}</SectionTitle>
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
                        const idadeNoAno = p.idadeAtual + d.ano;
                        return (
                          <div style={{ ...chartProps.tooltip.contentStyle, padding: "12px 16px" }}>
                            <div style={{ color: C.slate, marginBottom: 8, fontSize: 11 }}>Ano {d.ano} · {d.fase} · {idadeNoAno} anos</div>
                            <div style={{ color: modoGraficos === "nominal" ? C.amber : C.indigo, fontFamily: C.mono }}>Patrimônio: {fmtBRL(val)}</div>
                            {d.rendaMensalReal > 0 && <div style={{ color: C.emerald, fontFamily: C.mono, marginTop: 4 }}>Renda: {fmtBRL(d.rendaMensalReal)}</div>}
                          </div>
                        );
                      }} />
                      <ReferenceLine x={p.prazoAcumulacao} stroke={C.slate2} strokeDasharray="4 4" label={{ value: `Aposentadoria (${p.idadeAposentadoria}a)`, position: "insideTopRight", fill: C.slate, fontSize: 10 }} />
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
                      {p.rendaMensalDesejada > 0 && <ReferenceLine y={p.rendaMensalDesejada} stroke={C.indigo} strokeDasharray="4 4" label={{ value: "Meta", position: "insideTopRight", fill: C.indigo, fontSize: 10 }} />}
                      <Area type="monotone" dataKey={modoGraficos === "nominal" ? "rendaMensalNominal" : "rendaMensalReal"}
                        stroke={modoGraficos === "nominal" ? C.amber : C.emerald} strokeWidth={2} fill="url(#gradR)" dot={false}
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
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const isAporte = d.fase === "Acumulação";
                        const cor = isAporte ? C.emerald : C.rose;
                        const tipo = isAporte ? "Aporte" : "Retirada";
                        const valorAnual = modoGraficos === "nominal" ? d.fluxoNominal : d.fluxoReal;
                        const valorMensal = valorAnual / 12;
                        return (
                          <div style={{ ...chartProps.tooltip.contentStyle, padding: "12px 16px", minWidth: 200 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <span style={{ fontSize: 11, color: C.slate }}>Ano {d.ano} · {p.idadeAtual + d.ano} anos</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: cor, background: `${cor}22`, padding: "2px 8px", borderRadius: 999 }}>
                                {isAporte ? "▲ Aporte" : "▼ Retirada"}
                              </span>
                            </div>
                            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                <span style={{ fontSize: 11, color: C.slate }}>{tipo} anual</span>
                                <span style={{ fontSize: 13, color: cor, fontFamily: C.mono, fontWeight: 600 }}>{fmtBRL(valorAnual)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                <span style={{ fontSize: 11, color: C.slate }}>{tipo} mensal</span>
                                <span style={{ fontSize: 13, color: cor, fontFamily: C.mono, fontWeight: 600 }}>{fmtBRL(valorMensal)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }} />
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
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                  <thead>
                    <tr>
                      {["Ano", "Idade", "Fase", "Patrimônio", "Aporte Anual", "Aporte Mensal", "Resgate Anual", "Resgate Mensal"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: h === "Ano" || h === "Idade" || h === "Fase" ? "left" : "right", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.slate, fontWeight: 500, fontFamily: C.sans, textTransform: "uppercase", letterSpacing: "0.06em", position: "sticky", top: 0, background: C.surface, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                    <tr>
                      <th colSpan={3} style={{ background: C.surface }} />
                      {[0,1,2,3,4].map(i => (
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
                      const patrimonio  = nom ? d.patrimonioNominal   : d.patrimonioReal;
                      const aporteAnual = nom ? d.aporteAnualNominal  : d.aporteAnualReal;
                      const aporteMes   = nom ? d.aporteMensalNominal : d.aporteMensalReal;
                      const resgateAnu  = nom ? d.resgateAnualNominal : d.resgateAnualReal;
                      const resgatemMes = nom ? d.resgateNominalMensal : d.rendaMensalReal;
                      const idade = p.idadeAtual + d.ano;
                      return (
                        <tr key={i} style={{ background: bgBase }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                          onMouseLeave={e => e.currentTarget.style.background = bgBase}>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: C.slate, fontFamily: C.mono, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{d.ano}</td>
                          <td style={{ padding: "9px 14px", fontSize: 12, color: C.white2, fontFamily: C.mono, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{idade}</td>
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
              <div style={{ marginTop: 14, display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.slate }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: C.indigo, display: "inline-block" }} />
                  Linha em destaque = transição acumulação → usufruto
                </div>
                <button onClick={exportarCSV} style={{ marginLeft: "auto", padding: "6px 16px", borderRadius: 8, border: `1px solid ${C.border2}`, background: "transparent", color: C.slate, fontSize: 12, cursor: "pointer", fontFamily: C.sans }}>
                  ⬇ Exportar CSV
                </button>
              </div>
            </GlassCard>
          )}
          </> /* fim modoApp === acumulacao */}
        </main>
      </div>

      {/* ── MODAL PDF ── */}
      {modalPdf && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: C.white }}>Gerar Relatório PDF</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: C.slate }}>Preencha o nome do cliente para personalizar o relatório.</p>

            <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 6 }}>Nome do cliente</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              value={nomeCliente}
              onChange={e => setNomeCliente(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 10, color: C.white, fontSize: 14, fontFamily: C.sans, outline: "none", boxSizing: "border-box", marginBottom: 24 }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalPdf(false)}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border2}`, background: "transparent", color: C.slate, fontSize: 13, cursor: "pointer", fontFamily: C.sans }}>
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setGerandoPdf(true);
                  await new Promise(r => setTimeout(r, 100));
                  // Gera o HTML do relatório como nova janela para impressão
                  const fmtB = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v || 0);
                  const fmtC = v => v >= 1e6 ? `R$ ${(v/1e6).toFixed(2).replace(".",",")} Mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(1).replace(".",",")} K` : fmtB(v);
                  const metaStr = resumo.patrimonioAcumuladoReal >= patrimonioNecessarioReal ? "✅ META ATINGIDA" : "⚠️ META NÃO ATINGIDA";
                  const metaCor = resumo.patrimonioAcumuladoReal >= patrimonioNecessarioReal ? "#10b981" : "#f43f5e";
                  const retRealAcc = ((1 + p.retornoNominalAcumulacao) / (1 + p.inflacao) - 1) * 100;
                  const retRealUsu = ((1 + p.retornoNominalUsufruto) / (1 + p.inflacao) - 1) * 100;
                  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

                  const tabelaRows = dados.map(d => `
                    <tr style="background:${d.ano === p.prazoAcumulacao ? "rgba(99,102,241,0.12)" : d.ano % 2 === 0 ? "#1a2332" : "#1e293b"}">
                      <td style="color:#94a3b8">${d.ano}</td>
                      <td style="color:#e2e8f0">${p.idadeAtual + d.ano}</td>
                      <td><span style="padding:2px 7px;border-radius:999px;font-size:10px;background:${d.fase==="Acumulação"?"rgba(99,102,241,0.2)":"rgba(16,185,129,0.2)"};color:${d.fase==="Acumulação"?"#6366f1":"#10b981"}">${d.fase}</span></td>
                      <td style="color:#f59e0b">${fmtB(d.patrimonioNominal)}</td>
                      <td style="color:#6366f1">${fmtB(d.patrimonioReal)}</td>
                      <td style="color:${d.aporteAnualNominal>0?"#f59e0b":"#475569"}">${d.aporteAnualNominal > 0 ? fmtB(d.aporteAnualNominal) : "—"}</td>
                      <td style="color:${d.aporteAnualReal>0?"#10b981":"#475569"}">${d.aporteAnualReal > 0 ? fmtB(d.aporteAnualReal) : "—"}</td>
                      <td style="color:${d.resgateAnualNominal>0?"#f59e0b":"#475569"}">${d.resgateAnualNominal > 0 ? fmtB(d.resgateAnualNominal) : "—"}</td>
                      <td style="color:${d.resgateAnualReal>0?"#10b981":"#475569"}">${d.resgateAnualReal > 0 ? fmtB(d.resgateAnualReal) : "—"}</td>
                      <td style="color:${d.resgateNominalMensal>0?"#f59e0b":"#475569"}">${d.resgateNominalMensal > 0 ? fmtB(d.resgateNominalMensal) : "—"}</td>
                      <td style="color:${d.rendaMensalReal>0?"#10b981":"#475569"}">${d.rendaMensalReal > 0 ? fmtB(d.rendaMensalReal) : "—"}</td>
                    </tr>`).join("");

                  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
                  <title>Relatório - ${nomeCliente || "Cliente"}</title>
                  <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
                    *{box-sizing:border-box;margin:0;padding:0}
                    body{background:#0f172a;color:#f8fafc;font-family:'Inter',sans-serif;padding:40px;font-size:13px}
                    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.1)}
                    .header-left h1{font-size:26px;font-weight:700;letter-spacing:-0.02em;color:#f8fafc}
                    .header-left p{font-size:13px;color:#94a3b8;margin-top:4px}
                    .header-right{text-align:right}
                    .header-right .nome{font-size:18px;font-weight:700;color:#f8fafc}
                    .header-right .consultoria{font-size:12px;color:#94a3b8;margin-top:2px}
                    .header-right .data{font-size:11px;color:#64748b;margin-top:6px}
                    .cliente-box{background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:16px 20px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:center}
                    .cliente-box .label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em}
                    .cliente-box .value{font-size:18px;font-weight:700;color:#f8fafc;margin-top:4px}
                    .meta-badge{padding:8px 20px;border-radius:999px;font-size:14px;font-weight:700;color:${metaCor};background:${metaCor}22;border:1px solid ${metaCor}55}
                    .section-title{font-size:11px;color:#6366f1;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px}
                    .section-title::before{content:"";display:inline-block;width:3px;height:12px;background:#6366f1;border-radius:2px}
                    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}
                    .card{background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px}
                    .card .lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px}
                    .card .val{font-size:18px;font-weight:600;font-family:'JetBrains Mono',monospace;letter-spacing:-0.02em}
                    .card .sub{font-size:10px;color:#64748b;margin-top:6px}
                    .params-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:32px}
                    .param{background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center}
                    .param .plbl{font-size:11px;color:#94a3b8}
                    .param .pval{font-size:13px;font-weight:600;font-family:'JetBrains Mono',monospace;color:#f8fafc}
                    .resumo-box{background:rgba(99,102,241,0.08);border-left:3px solid #6366f1;border-radius:0 12px 12px 0;padding:20px 24px;margin-bottom:32px;font-size:14px;color:#cbd5e1;line-height:1.9}
                    .resumo-box b{color:#f8fafc;font-family:'JetBrains Mono',monospace}
                    .resumo-box .ok{color:#10b981;font-weight:700;font-family:'JetBrains Mono',monospace}
                    .resumo-box .warn{color:#f43f5e;font-weight:700;font-family:'JetBrains Mono',monospace}
                    .resumo-box .amber{color:#f59e0b;font-weight:700;font-family:'JetBrains Mono',monospace}
                    table{width:100%;border-collapse:collapse;font-size:10px}
                    th{padding:7px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1);font-size:9px;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;background:#1e293b;white-space:nowrap}
                    td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-family:'JetBrains Mono',monospace;white-space:nowrap}
                    td:nth-child(n+4){text-align:right}
                    th:nth-child(n+4){text-align:right}
                    .table-wrap{border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;margin-bottom:32px}
                    .footer{text-align:center;font-size:11px;color:#475569;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);margin-top:16px}
                    @media print{body{padding:20px}}
                  </style></head><body>

                  <div class="header">
                    <div class="header-left">
                      <h1>Planejamento Financeiro</h1>
                      <p>Simulação Patrimonial Personalizada</p>
                    </div>
                    <div class="header-right">
                      <div class="nome">Geraldo Búrigo</div>
                      <div class="consultoria">Consultoria Financeira</div>
                      <div class="data">${hoje}</div>
                    </div>
                  </div>

                  <div class="cliente-box">
                    <div>
                      <div class="label">Relatório preparado para</div>
                      <div class="value">${nomeCliente || "—"}</div>
                    </div>
                    <div class="meta-badge">${metaStr}</div>
                  </div>

                  <div class="section-title">Resumo Executivo</div>
                  <div class="resumo-box">
                    ${anosCasoAtual
                      ? `Aos <b>${Math.round(p.idadeAtual + anosCasoAtual)} anos</b> você atingirá a independência financeira — em aproximadamente <b>${anosCasoAtual.toFixed(1).replace(".",",")} anos</b>.`
                      : `A meta <span class="warn">não é atingida</span> dentro de 80 anos — considere aumentar o aporte.`}
                    Ao se aposentar aos <b>${p.idadeAposentadoria} anos</b>, após <b>${p.prazoAcumulacao} anos</b> de acumulação,
                    seu patrimônio real será de <b>${fmtC(resumo.patrimonioAcumuladoReal)}</b>,
                    ${resumo.patrimonioAcumuladoReal >= patrimonioNecessarioReal
                      ? `<span class="ok">superando</span> o necessário de <span class="ok">${fmtC(patrimonioNecessarioReal)}</span>.`
                      : `<span class="warn">abaixo</span> do necessário de <span class="warn">${fmtC(patrimonioNecessarioReal)}</span>.`}
                    A renda mensal projetada é de <span class="ok">${fmtB(resumo.rendaMensalRealInicial)}</span> em poder de compra de hoje
                    ${resumo.rendaMensalRealInicial >= p.rendaMensalDesejada
                      ? `, <span class="ok">superando</span> a meta de <span class="ok">${fmtB(p.rendaMensalDesejada)}</span>.`
                      : `, <span class="warn">abaixo</span> da meta de <span class="warn">${fmtB(p.rendaMensalDesejada)}</span>.`}
                    ${resumo.anoEsgotamento
                      ? `<span class="warn">⚠ Atenção: o patrimônio se esgota no ano ${resumo.anoEsgotamento}.</span>`
                      : `O patrimônio sustenta os <b>${p.prazoUsufruto} anos</b> de usufruto planejados.`}
                  </div>

                  <div class="section-title">Resultados Projetados</div>
                  <div class="cards">
                    <div class="card"><div class="lbl">Patrimônio Nominal</div><div class="val" style="color:#f59e0b">${fmtC(resumo.patrimonioAcumuladoNominal)}</div><div class="sub">Valor futuro nominal</div></div>
                    <div class="card"><div class="lbl">Patrimônio Real</div><div class="val" style="color:#6366f1">${fmtC(resumo.patrimonioAcumuladoReal)}</div><div class="sub">Poder de compra hoje</div></div>
                    <div class="card"><div class="lbl">Renda Mensal Nominal</div><div class="val" style="color:#f59e0b">${fmtC(resumo.rendaMensalNominalInicial)}</div><div class="sub">Valor futuro nominal</div></div>
                    <div class="card"><div class="lbl">Renda Mensal Real</div><div class="val" style="color:#10b981">${fmtC(resumo.rendaMensalRealInicial)}</div><div class="sub">Poder de compra hoje</div></div>
                    <div class="card"><div class="lbl">Patrimônio Necessário Real</div><div class="val" style="color:${metaCor}">${fmtC(patrimonioNecessarioReal)}</div><div class="sub">${resumo.patrimonioAcumuladoReal >= patrimonioNecessarioReal ? "✓ Meta atingida" : "✗ Meta não atingida"}</div></div>
                    <div class="card"><div class="lbl">Aporte Necessário</div><div class="val" style="color:#94a3b8">${aporteNecessario ? fmtC(aporteNecessario) : "—"}</div><div class="sub">Mensal para atingir a meta</div></div>
                    <div class="card"><div class="lbl">Tempo para Meta</div><div class="val" style="color:#e2e8f0">${anosCasoAtual ? anosCasoAtual.toFixed(1).replace(".",",") + " anos" : "Não atinge"}</div><div class="sub">${anosCasoAtual ? "Aos " + Math.round(p.idadeAtual + anosCasoAtual) + " anos de idade" : ""}</div></div>
                    <div class="card"><div class="lbl">Total Investido</div><div class="val" style="color:#10b981">${fmtC(resumo.totalInvestido)}</div><div class="sub">Capital aportado nominal</div></div>
                  </div>

                  <div class="section-title">Parâmetros da Simulação</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:32px">

                    <!-- Coluna 1: Prazos e idades -->
                    <div>
                      <div style="font-size:10px;color:#6366f1;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(99,102,241,0.3)">Perfil</div>
                      ${[
                        ["Idade Atual", `${p.idadeAtual} anos`],
                        ["Idade Aposentadoria", `${p.idadeAposentadoria} anos`],
                        ["Prazo de Acumulação", `${p.prazoAcumulacao} anos`],
                        ["Prazo de Usufruto", `${p.prazoUsufruto} anos`],
                      ].map(([l,v]) => `<div class="param" style="margin-bottom:6px"><span class="plbl">${l}</span><span class="pval">${v}</span></div>`).join("")}
                    </div>

                    <!-- Coluna 2: Aportes e renda -->
                    <div>
                      <div style="font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(16,185,129,0.3)">Aportes & Renda</div>
                      ${[
                        ["Aporte Mensal", fmtC(p.aporteMensal)],
                        ["Crescimento do Aporte", `${(p.crescimentoAporteAnual*100).toFixed(1).replace(".",",")}% a.a.`],
                        ["Renda Mensal Desejada", fmtC(p.rendaMensalDesejada)],
                        ["Inflação Projetada", `${(p.inflacao*100).toFixed(1).replace(".",",")}% a.a.`],
                      ].map(([l,v]) => `<div class="param" style="margin-bottom:6px"><span class="plbl">${l}</span><span class="pval">${v}</span></div>`).join("")}
                    </div>

                    <!-- Coluna 3: Retornos -->
                    <div>
                      <div style="font-size:10px;color:#f59e0b;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(245,158,11,0.3)">Retornos Projetados</div>
                      ${[
                        ["Retorno Nominal (Acumulação)", `${(p.retornoNominalAcumulacao*100).toFixed(1).replace(".",",")}%`],
                        ["Retorno Real (Acumulação)", `${retRealAcc>=0?"+":""}${retRealAcc.toFixed(2).replace(".",",")}%`, "#10b981"],
                        ["Retorno Nominal (Usufruto)", `${(p.retornoNominalUsufruto*100).toFixed(1).replace(".",",")}%`],
                        ["Retorno Real (Usufruto)", `${retRealUsu>=0?"+":""}${retRealUsu.toFixed(2).replace(".",",")}%`, "#10b981"],
                      ].map(([l,v,c]) => `<div class="param" style="margin-bottom:6px"><span class="plbl">${l}</span><span class="pval" style="color:${c||"#f8fafc"}">${v}</span></div>`).join("")}
                    </div>
                  </div>

                  <!-- GRÁFICOS -->
                  <div class="section-title">Análise Gráfica</div>

                  <!-- Gráfico 1: Patrimônio Real ao longo do tempo -->
                  <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:16px">
                    <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Patrimônio Real ao Longo do Tempo</div>
                    <div style="font-size:10px;color:#64748b;margin-bottom:16px">Poder de compra de hoje · R$ Mi</div>
                    <div style="position:relative;width:100%;height:400px"><canvas id="chart1"></canvas></div>
                  </div>

                  <!-- Grid 2 colunas para os outros 2 gráficos -->
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                    <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px">
                      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Renda Mensal no Usufruto</div>
                      <div style="font-size:10px;color:#64748b;margin-bottom:16px">Real · poder de compra hoje</div>
                      <div style="position:relative;width:100%;height:400px"><canvas id="chart2"></canvas></div>
                    </div>
                    <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px">
                      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Fluxos Anuais</div>
                      <div style="font-size:10px;color:#64748b;margin-bottom:16px">Aportes e resgates reais</div>
                      <div style="position:relative;width:100%;height:400px"><canvas id="chart3"></canvas></div>
                    </div>
                  </div>
                  <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:32px">
                    <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Total Investido vs Rendimento</div>
                    <div style="font-size:10px;color:#64748b;margin-bottom:16px">Fase de acumulação · R$ Mi</div>
                    <div style="position:relative;width:100%;height:400px"><canvas id="chart4"></canvas></div>
                  </div>

                  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
                  <script>
                    Chart.defaults.color = '#64748b';
                    Chart.defaults.borderColor = 'rgba(148,163,184,0.08)';
                    const dadosPdf = ${JSON.stringify(dados.map(d => ({
                      ano: d.ano, fase: d.fase,
                      patReal: d.patrimonioReal,
                      renda: d.rendaMensalReal,
                      fluxoReal: d.fase==="Acumulação" ? d.aporteAnualReal : d.resgateAnualReal,
                      totalInv: d.totalInvestido/1e6,
                      rend: d.rendimento/1e6
                    })))};
                    const acc = dadosPdf.filter(d=>d.fase==="Acumulação");
                    const usu = dadosPdf.filter(d=>d.fase==="Usufruto");
                    const opts = { responsive:true, maintainAspectRatio:false, animation:false };

                    new Chart(document.getElementById('chart1'), {
                      type:'line',
                      data:{
                        labels: dadosPdf.map(d=>d.ano),
                        datasets:[{ data: dadosPdf.map(d=>+(d.patReal/1e6).toFixed(2)), fill:true,
                          borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,0.15)',
                          borderWidth:2, pointRadius:0, tension:0.4 }]
                      },
                      options:{ ...opts, plugins:{legend:{display:false}},
                        scales:{ x:{grid:{color:'rgba(148,163,184,0.06)'},ticks:{maxTicksLimit:12,font:{size:10}}},
                                 y:{grid:{color:'rgba(148,163,184,0.06)'},ticks:{font:{size:10},callback:v=>v+'Mi'}} }}
                    });

                    new Chart(document.getElementById('chart2'), {
                      type:'line',
                      data:{
                        labels: usu.map(d=>d.ano),
                        datasets:[{ data: usu.map(d=>+(d.renda/1000).toFixed(1)), fill:true,
                          borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.15)',
                          borderWidth:2, pointRadius:0, tension:0.4 }]
                      },
                      options:{ ...opts, plugins:{legend:{display:false}},
                        scales:{ x:{grid:{color:'rgba(148,163,184,0.06)'},ticks:{maxTicksLimit:10,font:{size:10}}},
                                 y:{grid:{color:'rgba(148,163,184,0.06)'},ticks:{font:{size:10},callback:v=>v+'k'}} }}
                    });

                    const fluxos = dadosPdf.filter(d=>d.ano>0);
                    new Chart(document.getElementById('chart3'), {
                      type:'bar',
                      data:{
                        labels: fluxos.map(d=>d.ano),
                        datasets:[{ data: fluxos.map(d=>+(d.fluxoReal/1000).toFixed(1)),
                          backgroundColor: fluxos.map(d=>d.fase==="Acumulação"?"rgba(16,185,129,0.75)":"rgba(244,63,94,0.75)"),
                          borderRadius:3 }]
                      },
                      options:{ ...opts, plugins:{legend:{display:false}},
                        scales:{ x:{grid:{display:false},ticks:{maxTicksLimit:10,font:{size:10}}},
                                 y:{grid:{color:'rgba(148,163,184,0.06)'},ticks:{font:{size:10},callback:v=>v+'k'}} }}
                    });

                    new Chart(document.getElementById('chart4'), {
                      type:'bar',
                      data:{
                        labels: acc.map(d=>d.ano),
                        datasets:[
                          { label:'Total Investido', data: acc.map(d=>+d.totalInv.toFixed(2)), backgroundColor:'rgba(16,185,129,0.75)', stack:'a', borderRadius:0 },
                          { label:'Rendimento',      data: acc.map(d=>+d.rend.toFixed(2)),     backgroundColor:'rgba(99,102,241,0.85)', stack:'a', borderRadius:3 }
                        ]
                      },
                      options:{ ...opts,
                        plugins:{ legend:{ display:true, position:'top', labels:{color:'#94a3b8',font:{size:10},boxWidth:10,boxHeight:10} } },
                        scales:{ x:{grid:{display:false},ticks:{maxTicksLimit:12,font:{size:10}}},
                                 y:{grid:{color:'rgba(148,163,184,0.06)'},ticks:{font:{size:10},callback:v=>v+'Mi'}} }}
                    });
                  </script>

                  <div class="section-title">Evolução Patrimonial — Fluxo Anual</div>
                  <div class="table-wrap">
                    <table style="font-size:10px">
                      <thead>
                        <!-- Linha de grupos -->
                        <tr>
                          <th colspan="3" style="background:#1e293b;border-bottom:none"></th>
                          <th colspan="2" style="text-align:center;background:rgba(99,102,241,0.15);color:#6366f1;border-bottom:1px solid rgba(99,102,241,0.3);letter-spacing:0.1em">PATRIMÔNIO</th>
                          <th colspan="2" style="text-align:center;background:rgba(245,158,11,0.1);color:#f59e0b;border-bottom:1px solid rgba(245,158,11,0.3);letter-spacing:0.1em">APORTE ANUAL</th>
                          <th colspan="2" style="text-align:center;background:rgba(244,63,94,0.1);color:#f43f5e;border-bottom:1px solid rgba(244,63,94,0.3);letter-spacing:0.1em">RESGATE ANUAL</th>
                          <th colspan="2" style="text-align:center;background:rgba(16,185,129,0.1);color:#10b981;border-bottom:1px solid rgba(16,185,129,0.3);letter-spacing:0.1em">RESGATE MENSAL</th>
                        </tr>
                        <!-- Linha de sub-colunas -->
                        <tr>
                          <th style="width:36px">Ano</th>
                          <th style="width:44px">Idade</th>
                          <th>Fase</th>
                          <th style="background:rgba(245,158,11,0.06);color:#f59e0b">Nominal</th>
                          <th style="background:rgba(99,102,241,0.06);color:#6366f1">Real</th>
                          <th style="background:rgba(245,158,11,0.06);color:#f59e0b">Nominal</th>
                          <th style="background:rgba(16,185,129,0.06);color:#10b981">Real</th>
                          <th style="background:rgba(245,158,11,0.06);color:#f59e0b">Nominal</th>
                          <th style="background:rgba(16,185,129,0.06);color:#10b981">Real</th>
                          <th style="background:rgba(245,158,11,0.06);color:#f59e0b">Nominal</th>
                          <th style="background:rgba(16,185,129,0.06);color:#10b981">Real</th>
                        </tr>
                      </thead>
                      <tbody>${tabelaRows}</tbody>
                    </table>
                  </div>

                  <div class="footer">
                    Relatório gerado por Geraldo Búrigo · Consultoria Financeira · ${hoje}<br>
                    Este documento é de caráter informativo e não constitui recomendação de investimento.
                  </div>
                  </body></html>`;

                  const win = window.open("", "_blank");
                  win.document.write(html);
                  win.document.close();
                  setTimeout(() => win.print(), 800);
                  setGerandoPdf(false);
                  setModalPdf(false);
                }}
                disabled={gerandoPdf}
                style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: gerandoPdf ? C.slate2 : `linear-gradient(135deg, ${C.emerald}, #0d9488)`, color: "#fff", fontSize: 13, cursor: gerandoPdf ? "not-allowed" : "pointer", fontFamily: C.sans, fontWeight: 600 }}>
                {gerandoPdf ? "Gerando..." : "📄 Gerar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
