# Planillas OPS — Carga semanal por web

Reemplaza el Excel compartido por una **página web** donde cada sector carga su
planilla. Los datos caen en una **Google Sheet** y el **backend de Python** los lee.

```
Navegador (form)  →  Google Apps Script (valida clave)  →  Google Sheet  →  Python
```

Hoy está armada la planilla de **Supervisores**. Las de Estacionarios y Almacén
quedan para la siguiente etapa (la estructura ya está lista para sumarlas).

---

## Estructura del proyecto

```
index.html              Página de inicio (elegir planilla)
supervisores.html       Planilla de Supervisores
css/styles.css          Estilos
js/listados.js          ★ Datos maestros (supervisores, obras, semanas…) — editá acá para alta/baja
js/config.js            ★ Pegás acá la URL del Apps Script
js/supervisores.js      Lógica del formulario
apps-script/Codigo.gs   Código para Google Apps Script (el "backend de datos")
backend/leer_planillas.py  Lector en Python para tu análisis
```

★ = los dos archivos que vas a tocar normalmente.

---

## Probarlo YA (modo demo, sin Google)

1. Abrí `index.html` en el navegador (doble clic).
2. Entrá a "Resumen Supervisores", completá y tocá **Enviar**.
3. Como todavía no hay Google configurado, te muestra abajo los datos que
   enviaría. Sirve para ver que todo funciona.

---

## Paso 1 — Publicar la web (GitHub Pages)

1. Subí estos archivos al repo (ver "Subir cambios" más abajo).
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Branch: `main`, carpeta `/ (root)` → **Save**.
4. A los minutos queda en:
   `https://eliasramirez99.github.io/PlanillaTaller/`
   Ese es el link que compartís con los sectores.

## Paso 2 — Crear la Google Sheet + Apps Script (el "backend de datos")

1. Creá una Google Sheet nueva (la llamás, p. ej., "Planillas OPS").
2. **Extensiones → Apps Script**. Borrá lo que haya y pegá **todo** el contenido
   de `apps-script/Codigo.gs`.
3. Cambiá las claves de cada sector en la parte de arriba (`const CLAVES`).
4. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquiera**
5. Autorizá los permisos cuando lo pida.
6. Copiá la **URL del Web App** (termina en `/exec`).

## Paso 3 — Conectar la web con la Sheet

1. Abrí `js/config.js`.
2. Pegá la URL en `APPS_SCRIPT_URL`.
3. Subí el cambio. Listo: ahora **Enviar** escribe en la Google Sheet.

## Paso 4 — Que Python lea los datos

Opción simple (sin credenciales):
1. En la Sheet: **Archivo → Compartir → Publicar en la web** → pestaña
   "Supervisores" → formato **CSV** → Publicar.
2. Pegá esa URL en `backend/leer_planillas.py` (`CSV_URL`).
3. `python backend/leer_planillas.py`

Opción con API (gspread, recomendada a futuro): ver comentarios del mismo archivo.

---

## Tareas de mantenimiento

- **Alta/baja de personal u obras:** editá `js/listados.js` y subí el cambio.
- **Cambiar una clave de sector:** editá `const CLAVES` en el Apps Script y
  volvé a implementar (**Implementar → Gestionar implementaciones → editar**).

---

## Subir cambios al repo

Desde `C:\Users\eramirez\PlanillaTaller`:

```powershell
git add .
git commit -m "Mensaje del cambio"
git push
```

---

## Seguridad (importante)

- El "login por sector" es una clave simple compartida: evita cargas de gente
  ajena, pero **no** es seguridad fuerte. Suficiente para uso interno.
- **Nunca** subas `credenciales.json` al repo (ya está en `.gitignore`).
