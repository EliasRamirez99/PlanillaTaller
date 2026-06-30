/* ============================================================
   Lógica de la planilla de Equipos Estacionarios  (sector: Panol)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Panol";
  const COLS_EQ = ["total", "disponible", "reparacion", "demora", "observaciones"];
  const edicion = leerEdicion();
  const enEd = !!(edicion && edicion.planilla === "Estacionarios");

  prepararListados(function () {
    poblarSemanas($("semana"));
    poblarSelect($("ubicacion"), LISTADOS.obras, (o) => o[1], (o) => o[1]);
    enlazarSemana("semana", "desde", "hasta");

    const filasEquipos = LISTADOS.equiposEstacionarios.map((eq) => [eq, eq]);
    construirFilasEtiqueta("tabla-equipos", filasEquipos, COLS_EQ);

    // Agregar un equipo que no está en la lista predefinida.
    $("add-equipo").addEventListener("click", function () {
      const n = $("nuevo-equipo").value.trim();
      if (!n) return;
      agregarEquipo(n);
      $("nuevo-equipo").value = "";
    });
    document.querySelector("#tabla-equipos tbody").addEventListener("click", function (e) {
      if (e.target.classList.contains("row-del")) e.target.closest("tr").remove();
    });

    if (enEd) prefill(edicion);

    conectarForm(recolectar, validar, function () {
      if (enEd) { limpiarEdicion(); alert("✅ Cambios guardados."); location.href = "index.html"; return; }
      $("form").reset();
      $("desde").value = $("hasta").value = "";
    });
  });

  function prefill(ed) {
    document.querySelector(".titulo").textContent = "EDITANDO CARGA — EQUIPOS ESTACIONARIOS";
    document.querySelector("button.primary").textContent = "Guardar cambios";
    const f = ed.fila || {};
    $("semana").value = f.semana || ""; $("semana").dispatchEvent(new Event("change"));
    $("ubicacion").value = f.ubicacion || "";
    $("cant_panoleros").value = f.cant_panoleros || "";

    const cat = LISTADOS.equiposEstacionarios || [];
    (ed.equipos || []).forEach((e) => {
      let tr = Array.from(document.querySelectorAll("#tabla-equipos tbody tr")).find((x) => x.dataset.clave === e.equipo);
      if (!tr && cat.indexOf(e.equipo) < 0) tr = agregarEquipo(e.equipo); // equipo fuera de la lista
      if (tr) COLS_EQ.forEach((c) => { const inp = tr.querySelector(`input[data-col="${c}"]`); if (inp) inp.value = e[c] || ""; });
    });
  }

  function agregarEquipo(nombre) {
    const tb = document.querySelector("#tabla-equipos tbody");
    const tr = document.createElement("tr");
    tr.dataset.clave = nombre;
    const lab = document.createElement("td");
    lab.className = "label";
    lab.textContent = nombre + " ";
    const x = document.createElement("button");
    x.type = "button"; x.className = "row-del"; x.title = "Quitar"; x.textContent = "×";
    lab.appendChild(x);
    tr.appendChild(lab);
    COLS_EQ.forEach((c) => {
      const td = document.createElement("td");
      const inp = document.createElement("input");
      inp.type = "text"; inp.setAttribute("data-col", c);
      td.appendChild(inp); tr.appendChild(td);
    });
    tb.appendChild(tr);
    return tr;
  }

  function recolectar() {
    const d = {
      sector: SECTOR,
      planilla: "Estacionarios",
      clave: claveSector(),
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      ubicacion: $("ubicacion").value,
      cant_panoleros: $("cant_panoleros").value,
      equipos: leerTablaEtiquetaArray("tabla-equipos", "equipo", COLS_EQ),
    };
    if (enEd) { d.accion = "editar_carga"; d.id = edicion.id; }
    return d;
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.ubicacion) return "Elegí la ubicación.";
    if (d.equipos.length === 0) return "Cargá al menos un equipo.";
    return null;
  }
})();
