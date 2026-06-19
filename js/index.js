/* ============================================================
   Inicio: elegir planilla -> pedir clave del sector -> entrar
   ============================================================ */
(function () {
  "use strict";

  let seleccion = null; // { sector, page, label }

  const gate = $("gate");
  const gTitle = $("gate-title");
  const gClave = $("gate-clave");
  const gStatus = $("gate-status");
  const setStatus = hacerStatus(gStatus);

  // Click en una tarjeta -> mostrar pedido de clave debajo.
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".card").forEach((c) => c.classList.remove("sel"));
      card.classList.add("sel");
      seleccion = {
        sector: card.dataset.sector,
        page: card.dataset.page,
        label: card.dataset.label,
      };
      gTitle.textContent = seleccion.label;
      gClave.value = "";
      setStatus("", "");
      gate.style.display = "block";
      gClave.focus();
      gate.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  async function acceder() {
    if (!seleccion) return;
    const clave = gClave.value.trim();
    if (!clave) { setStatus("Ingresá la clave.", "err"); return; }

    setStatus("Verificando…", "");
    const ok = await validarClave(seleccion.sector, clave);
    if (ok === null) { setStatus("❌ No se pudo verificar. Revisá tu internet.", "err"); return; }
    if (!ok) { setStatus("❌ Clave incorrecta.", "err"); return; }

    // Guardar sesión y entrar a la planilla.
    sessionStorage.setItem("ops_sector", seleccion.sector);
    sessionStorage.setItem("ops_clave", clave);
    location.href = seleccion.page;
  }

  $("gate-go").addEventListener("click", acceder);
  gClave.addEventListener("keydown", (e) => { if (e.key === "Enter") acceder(); });
  $("gate-cancel").addEventListener("click", () => {
    gate.style.display = "none";
    document.querySelectorAll(".card").forEach((c) => c.classList.remove("sel"));
    seleccion = null;
  });
})();
