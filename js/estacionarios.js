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
    poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
    poblarSelect($("ubicacion"), LISTADOS.obras, (o) => o[1], (o) => o[1]);
    enlazarSemana("semana", "desde", "hasta");

    const filasEquipos = LISTADOS.equiposEstacionarios.map((eq) => [eq, eq]);
    construirFilasEtiqueta("tabla-equipos", filasEquipos, COLS_EQ);

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

    const rows = document.querySelectorAll("#tabla-equipos tbody tr");
    (ed.equipos || []).forEach((e) => {
      rows.forEach((tr) => {
        if (tr.dataset.clave === e.equipo) {
          COLS_EQ.forEach((c) => { const inp = tr.querySelector(`input[data-col="${c}"]`); if (inp) inp.value = e[c] || ""; });
        }
      });
    });
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
