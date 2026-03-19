import { useMemo, useState } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceDot, Legend } from "recharts";

function calcularSimulacao(parametros) {
  const { patrimonioInicial, aporteMensal, retornoNominalAcumulacao, retornoNominalUsufruto, inflacao, prazoAcumulacao, prazoUsufruto, taxaRetiradaAnual, modoUsufruto } = parametros;
  const dados = [];
  let patrimonioNominal = patrimonioInicial, fatorInflacao = 1, patrimonioReal = patrimonioInicial;
  const txAccMes = Math.pow(1 + retornoNominalAcumulacao, 1/12) - 1;
  const txUsuMes = Math.pow(1 + retornoNominalUsufruto,   1/12) - 1;
  const txInflMes= Math.pow(1 + inflacao,                 1/12) - 1;
  const totalMeses = (prazoAcumulacao + prazoUsufruto) * 12;
  let rendaMensalReal = 0, anoEsgotamento = null, resgateAcum = 0;
  dados.push({ ano: 0, fase: "Acumulação", patrimonioNominal, patrimonioReal, resgateAnualReal: 0, rendaMensalReal: 0 });
  for (let mes = 1; mes <= totalMeses; mes++) {
    const ano = Math.floor(mes / 12);
    const emUsufruto = mes > prazoAcumulacao * 12;
    if (!emUsufruto) {
      patrimonioNominal = patrimonioNominal * (1 + txAccMes) + aporteMensal;
      fatorInflacao *= 1 + txInflMes;
      patrimonioReal = patrimonioNominal / fatorInflacao;
      if (mes % 12 === 0) dados.push({ ano, fase: "Acumulação", patrimonioNominal, patrimonioReal, resgateAnualReal: 0, rendaMensalReal: 0 });
    } else {
      if (mes === prazoAcumulacao * 12 + 1) { rendaMensalReal = (patrimonioReal * taxaRetiradaAnual) / 12; resgateAcum = 0; }
      if (patrimonioNominal <= 0) {
        fatorInflacao *= 1 + txInflMes;
        if (mes % 12 === 0) dados.push({ ano, fase: "Usufruto", patrimonioNominal: 0, patrimonioReal: 0, resgateAnualReal: 0, rendaMensalReal: 0 });
        continue;
      }
      const retMes = patrimonioNominal * txUsuMes;
      let retNom, retRealMes;
      if (modoUsufruto === "fixa") { retNom = rendaMensalReal * fatorInflacao; retRealMes = rendaMensalReal; }
      else { retNom = patrimonioNominal * (taxaRetiradaAnual / 12); retRealMes = retNom / fatorInflacao; }
      patrimonioNominal = patrimonioNominal + retMes - retNom;
      fatorInflacao *= 1 + txInflMes;
      patrimonioReal = patrimonioNominal / fatorInflacao;
      resgateAcum += retRealMes;
      if (patrimonioNominal <= 0 && !anoEsgotamento) { anoEsgotamento = ano; patrimonioNominal = 0; patrimonioReal = 0; }
      if (mes % 12 === 0) {
        const resgateAnualReal = modoUsufruto === "fixa" ? rendaMensalReal * 12 : resgateAcum;
        dados.push({ ano, fase: "Usufruto", patrimonioNominal: Math.max(0, patrimonioNominal), patrimonioReal: Math.max(0, patrimonioReal), resgateAnualReal, rendaMensalReal: modoUsufruto === "fixa" ? rendaMensalReal : resgateAcum / 12 });
        resgateAcum = 0;
      }
    }
  }
  const fimAcc = dados.find(d => d.ano === prazoAcumulacao && d.fase === "Acumulação");
  return { dados, resumo: { patrimonioAcumuladoNominal: fimAcc?.patrimonioNominal ?? 0, patrimonioAcumuladoReal: fimAcc?.patrimonioReal ?? 0, rendaMensalRealInicial: ((fimAcc?.patrimonioReal ?? 0) * taxaRetiradaAnual) / 12, anoEsgotamento } };
}

export default function App() {
  const [parametros, setParametros] = useState({
    patrimonioInicial: "1.000.000,00", aporteMensal: "55.000,00",
    retornoNominalAcumulacao: "12", retornoNominalUsufruto: "10",
    inflacao: "6", prazoAcumulacao: "20", prazoUsufruto: "60",
    taxaRetiradaAnual: "4", modoUsufruto: "fixa", rendaMensalDesejada: "15.000,00",
  });

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

  const dadosFluxos = useMemo(() => dados.filter(i => i.ano > 0).map(i => ({
    ano: i.ano, fase: i.fase,
    aporteAnual: i.fase === "Acumulação" ? p.aporteMensal * 12 : 0,
    resgateAnual: i.fase === "Usufruto" ? i.resgateAnualReal : 0,
  })), [dados, p]);

  const set = (campo, valor) => setParametros(prev => ({ ...prev, [campo]: valor }));
  const setM = (campo, valor) => setParametros(prev => ({ ...prev, [campo]: formatarMoedaInput(valor) }));

  const fmtBRL  = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v || 0);
  const fmtCpct = v => v >= 1e6 ? `R$ ${(v/1e6).toFixed(2).replace(".",",")} mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(2).replace(".",",")} mil` : fmtBRL(v);
  const fmtMi   = v => `R$ ${(v/1e6).toFixed(1).replace(".",",")} mi`;
  const fmtInt  = v => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v || 0);

  function calcularTempoParaMeta({ patrimonioInicial, aporteMensal, retornoNominalAcumulacao, inflacao, taxaRetiradaAnual, rendaMensalDesejada, maxAnos = 60 }) {
    if (taxaRetiradaAnual <= 0 || rendaMensalDesejada <= 0) return null;
    const alvo = (rendaMensalDesejada * 12) / taxaRetiradaAnual;
    const txNomMes  = Math.pow(1 + retornoNominalAcumulacao, 1/12) - 1;
    const txInflMes = Math.pow(1 + inflacao, 1/12) - 1;
    const txRealMes = (1 + txNomMes) / (1 + txInflMes) - 1;
    let pat = patrimonioInicial, fat = 1;
    for (let mes = 1; mes <= maxAnos * 12; mes++) {
      fat *= 1 + txInflMes;
      pat = pat * (1 + txRealMes) + aporteMensal / fat;
      if (pat >= alvo) return mes / 12;
    }
    return null;
  }

  const anosCasoAtual = useMemo(() => calcularTempoParaMeta({ patrimonioInicial: p.patrimonioInicial, aporteMensal: p.aporteMensal, retornoNominalAcumulacao: p.retornoNominalAcumulacao, inflacao: p.inflacao, taxaRetiradaAnual: p.taxaRetiradaAnual, rendaMensalDesejada: p.rendaMensalDesejada }), [p]);

  const faixaRenda = useMemo(() => { const mil = Math.max(1, Math.round(p.rendaMensalDesejada/1000)); const inicio = Math.max(1, mil-10); return { inicio, fim: Math.max(inicio+20, mil+10) }; }, [p.rendaMensalDesejada]);
  const sensibilidadeRenda = useMemo(() => { const arr = []; for (let r = faixaRenda.inicio; r <= faixaRenda.fim; r++) { const anos = calcularTempoParaMeta({ ...p, rendaMensalDesejada: r*1000 }); if (anos !== null) arr.push({ rendaMil: r, anos }); } return arr; }, [p, faixaRenda]);

  const faixaAporte = useMemo(() => { const mil = Math.max(0, Math.round(p.aporteMensal/1000)); const inicio = Math.max(0, mil-15); return { inicio, fim: Math.max(inicio+25, mil+15) }; }, [p.aporteMensal]);
  const sensibilidadeAporte = useMemo(() => { const arr = []; for (let a = faixaAporte.inicio; a <= faixaAporte.fim; a++) { const anos = calcularTempoParaMeta({ ...p, aporteMensal: a*1000 }); if (anos !== null) arr.push({ aporteMil: a, anos }); } return arr; }, [p, faixaAporte]);

  const faixaPat = useMemo(() => { const mil = Math.max(100, Math.round(p.patrimonioInicial/1000)); const passo = 100; const inicio = Math.max(passo, mil-passo*8); return { inicio, fim: Math.max(inicio+passo*16, mil+passo*8), passo }; }, [p.patrimonioInicial]);
  const sensibilidadePat = useMemo(() => { const arr = []; for (let pt = faixaPat.inicio; pt <= faixaPat.fim; pt += faixaPat.passo) { const anos = calcularTempoParaMeta({ ...p, patrimonioInicial: pt*1000 }); if (anos !== null) arr.push({ patrimonioMil: pt, anos }); } return arr; }, [p, faixaPat]);

  const S = {
    card:    { borderRadius: 20, padding: "24px 22px", minHeight: 135, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", boxShadow: "0 10px 30px rgba(15,23,42,0.10)" },
    input:   { width: "100%", padding: "13px 14px", borderRadius: 12, border: "1px solid #dbe2ea", fontSize: 15, outline: "none", boxSizing: "border-box", background: "#fff", height: 46 },
    label:   { display: "block", fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 6 },
    badge:   { display: "inline-block", padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
    section: { background: "#fff", borderRadius: 32, padding: 28, border: "1px solid #e5e7eb", boxShadow: "0 10px 30px rgba(15,23,42,0.06)" },
    chart:   { background: "#f8fafc", borderRadius: 22, padding: 18 },
    th:      { padding: 10, textAlign: "left", borderBottom: "1px solid #e2e8f0", fontSize: 13, color: "#334155", background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 },
    td:      { padding: 10, borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#0f172a", whiteSpace: "nowrap" },
  };

  const Pref = ({ t }) => <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#475569", fontWeight: 700 }}>{t}</span>;
  const Suf  = ({ t }) => <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#475569", fontWeight: 700 }}>{t}</span>;
  const TipBox = ({ itens }) => (
    <div style={{ background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 8px 20px rgba(15,23,42,0.08)", fontSize: 13 }}>
      {itens.map(([k, v], i) => <div key={i}><strong>{k}:</strong> {v}</div>)}
    </div>
  );

  const SensChart = ({ title, subtitle, data, xKey, xLabel, lineColor, currentX, currentY, tipPrefix, fmtX }) => (
    <section style={S.section}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{title}</div>
        <div style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>{subtitle}</div>
      </div>
      <div style={S.chart}><div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: "#64748b", fontSize: 12 }} stroke="#94a3b8" label={{ value: xLabel, position: "insideBottom", offset: -10, fill: "#64748b", fontSize: 12 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 12 }} stroke="#94a3b8" label={{ value: "Anos", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }} />
            <Tooltip formatter={v => [`${Number(v).toFixed(1).replace(".",",")} anos`, "Tempo"]} labelFormatter={l => `${tipPrefix}: ${fmtX(l)}`} contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#0f172a" }} />
            <ReferenceLine x={currentX} stroke="#94a3b8" strokeDasharray="4 4" />
            {currentY && <ReferenceDot x={currentX} y={currentY} r={6} fill="#fff" stroke={lineColor} strokeWidth={3} />}
            <Line type="monotone" dataKey="anos" stroke={lineColor} strokeWidth={3} dot={{ r: 3, fill: lineColor, stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div></div>
    </section>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fb", padding: 24, fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderRadius: 28, padding: "28px 32px", boxShadow: "0 10px 30px rgba(15,23,42,0.06)", border: "1px solid #e5e7eb", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26 }}>📊</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 32 }}>Planejamento Financeiro</h1>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 15 }}>Simulação patrimonial com fase de acumulação e fase de usufruto</p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0,1fr)", gap: 24, alignItems: "start" }}>

          {/* Sidebar */}
          <aside style={{ background: "#fff", borderRadius: 28, padding: 24, border: "1px solid #e5e7eb", boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <span style={{ fontSize: 20 }}>⚙️</span>
              <h2 style={{ margin: 0, fontSize: 24 }}>Parâmetros</h2>
            </div>

            <span style={{ ...S.badge, background: "#e0e7ff", color: "#4338ca" }}>Acumulação</span>
            <div style={{ display: "grid", gap: 14, marginTop: 14, marginBottom: 20 }}>
              {[["Patrimônio Inicial", "patrimonioInicial"], ["Aporte Mensal", "aporteMensal"]].map(([lbl, campo]) => (
                <div key={campo}>
                  <label style={S.label}>{lbl}</label>
                  <div style={{ position: "relative" }}><Pref t="R$" /><input value={parametros[campo]} onChange={e => setM(campo, e.target.value)} style={{ ...S.input, paddingLeft: 42 }} /></div>
                </div>
              ))}
              {[["Retorno Nominal", "retornoNominalAcumulacao"], ["Inflação", "inflacao"]].map(([lbl, campo]) => (
                <div key={campo}>
                  <label style={S.label}>{lbl}</label>
                  <div style={{ position: "relative" }}><input value={parametros[campo]} onChange={e => set(campo, e.target.value)} style={{ ...S.input, paddingRight: 32 }} /><Suf t="%" /></div>
                </div>
              ))}
              <div>
                <label style={S.label}>Prazo de Acumulação (anos)</label>
                <input value={parametros.prazoAcumulacao} onChange={e => set("prazoAcumulacao", e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Renda Mensal Desejada (meta)</label>
                <div style={{ position: "relative" }}><Pref t="R$" /><input value={parametros.rendaMensalDesejada} onChange={e => setM("rendaMensalDesejada", e.target.value)} style={{ ...S.input, paddingLeft: 42 }} /></div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 18 }}>
              <span style={{ ...S.badge, background: "#d1fae5", color: "#047857" }}>Usufruto</span>
              <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
                {[["Retorno Nominal", "retornoNominalUsufruto"], ["Taxa de Retirada Anual", "taxaRetiradaAnual"]].map(([lbl, campo]) => (
                  <div key={campo}>
                    <label style={S.label}>{lbl}</label>
                    <div style={{ position: "relative" }}><input value={parametros[campo]} onChange={e => set(campo, e.target.value)} style={{ ...S.input, paddingRight: 32 }} /><Suf t="%" /></div>
                  </div>
                ))}
                <div>
                  <label style={S.label}>Prazo de Usufruto (anos)</label>
                  <input value={parametros.prazoUsufruto} onChange={e => set("prazoUsufruto", e.target.value)} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Modo de Usufruto</label>
                  <select value={parametros.modoUsufruto} onChange={e => set("modoUsufruto", e.target.value)} style={S.input}>
                    <option value="fixa">Renda fixa real (mantém poder de compra)</option>
                    <option value="variavel">Retirada percentual (acompanha patrimônio)</option>
                  </select>
                </div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main style={{ display: "grid", gap: 24 }}>

            {/* Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 16 }}>
              {[
                { lbl: "Patrimônio Nominal", val: fmtCpct(resumo.patrimonioAcumuladoNominal), sub: "Fim da acumulação", bg: "linear-gradient(135deg,#4338ca,#7c3aed)" },
                { lbl: "Patrimônio Real",    val: fmtCpct(resumo.patrimonioAcumuladoReal),    sub: "Poder de compra hoje", bg: "linear-gradient(135deg,#059669,#14b8a6)" },
                { lbl: "Renda Mensal",       val: fmtBRL(resumo.rendaMensalRealInicial),       sub: "Poder de compra hoje", bg: "linear-gradient(135deg,#0369a1,#06b6d4)" },
                { lbl: "Tempo para Meta",    val: anosCasoAtual ? `${anosCasoAtual.toFixed(1).replace(".",",")} anos` : "Não atinge", sub: "Renda + taxa de retirada", bg: "linear-gradient(135deg,#111827,#334155)" },
              ].map(({ lbl, val, sub, bg }) => (
                <div key={lbl} style={{ ...S.card, background: bg }}>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{lbl}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{val}</div>
                  <div style={{ fontSize: 11, opacity: 0.82, marginTop: 6, lineHeight: 1.4 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Gráfico patrimônio */}
            <section style={S.section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Patrimônio Real ao Longo do Tempo</h3>
                <div style={{ padding: "6px 12px", borderRadius: 999, background: "#f1f5f9", fontSize: 12, fontWeight: 600, color: "#475569" }}>Acumulação → Usufruto</div>
              </div>
              <div style={S.chart}><div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <AreaChart data={dados}>
                    <defs>
                      <linearGradient id="fillP" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="ano" tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis tickFormatter={fmtMi} tick={{ fill: "#64748b", fontSize: 12 }} width={90} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return <TipBox itens={[["Ano", d.ano], ["Fase", d.fase], ["Patrimônio real", fmtBRL(d.patrimonioReal)], ["Renda mensal", fmtBRL(d.rendaMensalReal)], ["Resgate anual", fmtBRL(d.resgateAnualReal)]]} />;
                    }} />
                    <ReferenceLine x={p.prazoAcumulacao} stroke="#0f172a" strokeDasharray="6 6" label={{ value: "Início do usufruto", position: "insideTopRight", fill: "#0f172a", fontSize: 12 }} />
                    {pico && <ReferenceLine x={pico.ano} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "Pico", position: "insideTopLeft", fill: "#16a34a", fontSize: 12 }} />}
                    {resumo.anoEsgotamento && <ReferenceLine x={Math.floor(resumo.anoEsgotamento)} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Esgotamento", position: "insideTopRight", fill: "#ef4444", fontSize: 12 }} />}
                    <Area type="monotone" dataKey="patrimonioReal" stroke="#6366f1" strokeWidth={4} fill="url(#fillP)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div></div>
            </section>

            {/* Gráfico fluxos */}
            <section style={S.section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Fluxos Anuais da Estratégia</h3>
                <div style={{ padding: "6px 12px", borderRadius: 999, background: "#f1f5f9", fontSize: 12, fontWeight: 600, color: "#475569" }}>Aportes e resgates</div>
              </div>
              <div style={S.chart}><div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={dadosFluxos}>
                    <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="ano" tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis tickFormatter={v => `R$${Math.round(v/1000)}k`} tick={{ fill: "#64748b", fontSize: 12 }} width={70} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return <TipBox itens={[["Ano", d.ano], ["Fase", d.fase], ["Aporte anual", fmtBRL(d.aporteAnual)], ["Resgate anual", fmtBRL(d.resgateAnual)]]} />;
                    }} />
                    <Legend />
                    <ReferenceLine x={p.prazoAcumulacao} stroke="#0f172a" strokeDasharray="6 6" />
                    <Bar dataKey="aporteAnual"  name="Aportes"  fill="#14b8a6" radius={[6,6,0,0]} />
                    <Bar dataKey="resgateAnual" name="Resgates" fill="#6366f1" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div></div>
            </section>

            {/* Sensibilidades */}
            <SensChart title="Variação da Renda Desejada" subtitle="Prazo para atingir a meta com diferentes rendas mensais desejadas." data={sensibilidadeRenda} xKey="rendaMil" xLabel="Renda mensal (mil R$)" lineColor="#6366f1" currentX={p.rendaMensalDesejada/1000} currentY={anosCasoAtual} tipPrefix="Renda" fmtX={l => `R$${l}k`} />
            <SensChart title="Variação do Aporte" subtitle="Prazo para atingir a meta com diferentes aportes mensais." data={sensibilidadeAporte} xKey="aporteMil" xLabel="Aporte mensal (mil R$)" lineColor="#14b8a6" currentX={p.aporteMensal/1000} currentY={anosCasoAtual} tipPrefix="Aporte" fmtX={l => `R$${l}k`} />
            <SensChart title="Variação do Patrimônio Inicial" subtitle="Prazo para atingir a meta com diferentes patrimônios iniciais." data={sensibilidadePat} xKey="patrimonioMil" xLabel="Patrimônio inicial (mil R$)" lineColor="#8b5cf6" currentX={p.patrimonioInicial/1000} currentY={anosCasoAtual} tipPrefix="Patrimônio" fmtX={l => `R$${fmtInt(l)}k`} />

            {/* Tabela */}
            <section style={S.section}>
              <h3 style={{ fontSize: 22, margin: "0 0 18px", fontWeight: 800 }}>Tabela da Simulação</h3>
              <div style={{ overflowX: "auto", maxHeight: 420, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                  <thead><tr>{["Ano","Fase","Patrimônio Nominal","Patrimônio Real","Resgate Anual Real","Renda Mensal Real"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {dados.map((d, i) => (
                      <tr key={i}>
                        <td style={S.td}>{d.ano}</td>
                        <td style={S.td}>{d.fase}</td>
                        <td style={S.td}>{fmtBRL(d.patrimonioNominal)}</td>
                        <td style={S.td}>{fmtBRL(d.patrimonioReal)}</td>
                        <td style={S.td}>{fmtBRL(d.resgateAnualReal)}</td>
                        <td style={S.td}>{fmtBRL(d.rendaMensalReal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}
