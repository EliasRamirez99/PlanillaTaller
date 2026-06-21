/* ============================================================
   Estadísticas — comparativo semanal (lee el historial cacheado)
   Sin librerías externas (gráficos SVG propios → andan offline).
   ============================================================ */
(function () {
  "use strict";

  const TRANSF = ["720", "745", "758", "760", "base7", "base4"];
  let AMBITO = "Almacen";

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const val = (x) => x != null && String(x).trim() !== "";
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function contarNec(f) { let c = 0; for (let i = 1; i <= 33; i++) if (val(f["nec" + i])) c++; return c; }
  function contarRep(f) { let c = 0; for (let i = 1; i <= 33; i++) if (val(f["rep" + i + "_dominio"]) || val(f["rep" + i + "_repuesto"])) c++; return c; }
  function abrev(s) { const m = String(s).match(/(\d+)/); return m ? "S" + m[1] : s; }
  function hist() { try { return JSON.parse(localStorage.getItem("ops_historial") || "[]") || []; } catch (e) { return []; } }

  const METR = {
    Almacen: [
      { lab: "OR Cargadas", f: (s) => num(s.fila.or_cargadas_total) },
      { lab: "Remitos Egreso", f: (s) => num(s.fila.remitos_egreso_total) },
      { lab: "Remitos Ingreso", f: (s) => num(s.fila.remitos_ingreso_total) },
      { lab: "Transferencias", f: (s) => TRANSF.reduce((a, k) => a + num(s.fila["transf_" + k + "_total"]), 0) },
      { lab: "Necesidades", f: (s) => contarNec(s.fila) },
    ],
    Supervisores: [
      { lab: "Órdenes", f: (s) => num(s.fila.ordenes) },
      { lab: "Tareas", f: (s) => num(s.fila.tareas) },
      { lab: "En reparación", f: (s) => num(s.fila.en_reparacion) },
      { lab: "Tercerizado", f: (s) => num(s.fila.tercerizado) },
      { lab: "Repuestos en espera", f: (s) => contarRep(s.fila) },
      { lab: "Necesidades", f: (s) => contarNec(s.fila) },
      { lab: "Km", f: (s) => num(s.fila.km) },
      { lab: "Mecánicos", f: (s) => num(s.fila.cant_mecanicos) },
    ],
    Campo: [
      { lab: "Órdenes", f: (s) => (s.obras || []).reduce((a, o) => a + num(o.ordenes), 0) },
      { lab: "Tareas", f: (s) => (s.obras || []).reduce((a, o) => a + num(o.tareas), 0) },
      { lab: "Obras", f: (s) => (s.obras || []).filter((o) => val(o.obra)).length },
      { lab: "Vehículos", f: (s) => (s.vehiculos || []).filter((v) => val(v.dominio)).length },
      { lab: "Km", f: (s) => (s.vehiculos || []).reduce((a, v) => a + num(v.km), 0) },
      { lab: "Litros", f: (s) => (s.vehiculos || []).reduce((a, v) => a + num(v.litros), 0) },
      { lab: "Insumos", f: (s) => (s.insumos || []).filter((x) => val(x.insumo)).length },
      { lab: "Repuestos en espera", f: (s) => (s.repuestos || []).filter((r) => val(r.obra) || val(r.repuesto)).length },
      { lab: "Pendientes", f: (s) => (s.pendientes || []).filter((p) => val(p.obra) || val(p.pendiente)).length },
    ],
  };

  const setStatus = hacerStatus($("est-status"));

  // ---------- datos ----------
  function subsFiltradas() {
    let subs = hist().filter((s) => s.planilla === AMBITO && s.fila);
    if (AMBITO === "Supervisores") {
      const t = $("est-taller").value, sup = $("est-sup").value;
      if (t) subs = subs.filter((s) => s.fila.taller === t);
      if (sup) subs = subs.filter((s) => s.fila.supervisor === sup);
    } else if (AMBITO === "Campo") {
      const sup = $("est-sup").value;
      if (sup) subs = subs.filter((s) => s.fila.supervisor === sup);
    }
    return subs;
  }
  function semanasOrdenadas(subs) {
    const orden = {}; (LISTADOS.semanas || []).forEach((s, i) => (orden[s[0]] = i));
    const set = Array.from(new Set(subs.map((s) => s.fila.semana).filter(Boolean)));
    set.sort((a, b) => {
      const oa = orden[a] == null ? 999 : orden[a], ob = orden[b] == null ? 999 : orden[b];
      return oa - ob || String(a).localeCompare(b);
    });
    return set;
  }
  function suma(subs, sem, m) { return subs.filter((s) => s.fila.semana === sem).reduce((a, s) => a + m.f(s), 0); }

  // ---------- gráfico de barras (SVG) ----------
  function barChart(titulo, subs, semanas, m) {
    const n = semanas.length;
    const bw = 38, gap = 20, padL = 36, padR = 14, padT = 24, padB = 28;
    const w = padL + padR + n * bw + Math.max(0, n - 1) * gap;
    const h = 180, chartH = h - padT - padB;
    const vals = semanas.map((sem) => suma(subs, sem, m));
    const max = Math.max(1, ...vals);
    let bars = "";
    semanas.forEach((sem, i) => {
      const v = vals[i];
      const x = padL + i * (bw + gap);
      const bh = (v / max) * chartH;
      const y = padT + chartH - bh;
      const last = i === n - 1;
      bars += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${last ? "var(--verde-osc)" : "var(--azul-borde)"}"></rect>`;
      bars += `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#333">${v}</text>`;
      bars += `<text x="${x + bw / 2}" y="${padT + chartH + 17}" text-anchor="middle" font-size="11" fill="#666">${esc(abrev(sem))}</text>`;
    });
    return `<div class="est-chart"><div class="est-chart-tit">${esc(titulo)}</div>` +
      `<svg class="est-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<line x1="${padL - 6}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="#ccc"></line>${bars}</svg></div>`;
  }

  // ---------- KPIs (última vs anterior) ----------
  function kpis(subs, semanas, metrics) {
    const ult = semanas[semanas.length - 1];
    const ant = semanas.length > 1 ? semanas[semanas.length - 2] : null;
    const cards = metrics.map((m) => {
      const v = suma(subs, ult, m);
      const p = ant != null ? suma(subs, ant, m) : null;
      const d = p != null ? v - p : null;
      const cls = d == null ? "eq" : (d > 0 ? "up" : (d < 0 ? "down" : "eq"));
      const fl = d == null ? "" : (d > 0 ? "▲" : (d < 0 ? "▼" : "="));
      const dtxt = d == null ? "primera semana" : `${fl} ${d > 0 ? "+" : ""}${d} vs ${abrev(ant)}`;
      return `<div class="kpi"><div class="kpi-lab">${esc(m.lab)}</div><div class="kpi-val">${v}</div><div class="kpi-delta ${cls}">${esc(dtxt)}</div></div>`;
    }).join("");
    return `<div class="kpi-head">Última semana: <b>${esc(ult)}</b>${ant ? " · comparada con " + esc(ant) : ""}</div><div class="kpis">${cards}</div>`;
  }

  // ---------- cuadro comparativo ----------
  function cuadro(subs, semanas, metrics) {
    const th = "<th>Semana</th>" + metrics.map((m) => `<th>${esc(m.lab)}</th>`).join("");
    const rows = semanas.map((sem) =>
      `<tr><td class="label">${esc(sem)}</td>` + metrics.map((m) => `<td>${suma(subs, sem, m)}</td>`).join("") + "</tr>"
    ).join("");
    return `<h3 class="est-h3">Cuadro comparativo semanal</h3><div style="overflow-x:auto"><table class="grid est-tabla"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- render ----------
  function render() {
    const subs = subsFiltradas();
    const semanas = semanasOrdenadas(subs);
    const metrics = METR[AMBITO];
    if (!semanas.length) {
      $("est-kpis").innerHTML = ""; $("est-charts").innerHTML = ""; $("est-tabla").innerHTML = "";
      setStatus("No hay datos cargados para este ámbito todavía.", "");
      return;
    }
    setStatus("", "");
    $("est-kpis").innerHTML = kpis(subs, semanas, metrics);
    $("est-charts").innerHTML = '<div class="est-charts-grid">' + metrics.map((m) => barChart(m.lab, subs, semanas, m)).join("") + "</div>";
    $("est-tabla").innerHTML = cuadro(subs, semanas, metrics);
  }

  // ---------- selectores ----------
  function pobTaller() {
    $("est-taller").innerHTML = '<option value="">Todos los talleres</option>' +
      (LISTADOS.talleres || []).map((t) => `<option>${esc(t)}</option>`).join("");
  }
  function pobSup() {
    let list;
    if (AMBITO === "Campo") {
      list = (LISTADOS.supervisores || []).filter((s) => s[2] === "Campo").map((s) => s[0]);
    } else {
      const t = $("est-taller").value;
      list = (LISTADOS.supervisores || []).filter((s) => !t || s[2] === t).map((s) => s[0]);
    }
    $("est-sup").innerHTML = '<option value="">Todos</option>' + list.map((n) => `<option>${esc(n)}</option>`).join("");
  }

  function recargar() {
    if (!CONFIG.APPS_SCRIPT_URL) { render(); return; }
    setStatus("Actualizando…", "");
    fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "historial" }),
    }).then((r) => r.json()).then((o) => {
      if (o && o.ok) { try { localStorage.setItem("ops_historial", JSON.stringify(o.datos || [])); } catch (e) {} }
      render();
    }).catch(() => render());
  }

  // ---------- eventos ----------
  document.querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    AMBITO = b.dataset.amb;
    $("est-f-taller").style.display = AMBITO === "Supervisores" ? "" : "none";
    $("est-f-sup").style.display = (AMBITO === "Supervisores" || AMBITO === "Campo") ? "" : "none";
    pobSup();
    render();
  }));
  $("est-taller").addEventListener("change", () => { pobSup(); render(); });
  $("est-sup").addEventListener("change", render);
  $("est-recargar").addEventListener("click", recargar);
  const tabEst = document.querySelector('.tab[data-tab="estadisticas"]');
  if (tabEst) tabEst.addEventListener("click", render);

  pobTaller();
  pobSup();
  render();
})();
