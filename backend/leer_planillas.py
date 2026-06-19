"""
Lector de planillas OPS desde Google Sheets.
-------------------------------------------------------------
El backend (tu programa de planificación / dashboard del viernes)
usa esto para leer lo que cargaron los sectores.

Dos modos:

A) RÁPIDO (sin credenciales) — si la Sheet está publicada como CSV:
   Archivo > Compartir > Publicar en la web > pestaña "Supervisores" > CSV.
   Pegás esa URL en CSV_URL y listo. Solo lectura, ideal para empezar.

B) API (gspread) — lectura con cuenta de servicio de Google.
   Requiere: pip install gspread google-auth
   y un archivo credenciales.json (cuenta de servicio) compartido
   con la Sheet. Ver README.md.

Uso:
    python leer_planillas.py
"""

import pandas as pd

# ---- Modo A: CSV publicado (más simple para arrancar) ----
CSV_URL = ""  # pegá acá la URL CSV publicada de la pestaña Supervisores

# ---- Modo B: gspread ----
CRED_JSON = "credenciales.json"
SHEET_ID = ""        # id de la Google Sheet (de la URL)
HOJA = "Supervisores"


def leer_csv(url: str) -> pd.DataFrame:
    return pd.read_csv(url)


def leer_gspread(cred: str, sheet_id: str, hoja: str) -> pd.DataFrame:
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds = Credentials.from_service_account_file(cred, scopes=scopes)
    gc = gspread.authorize(creds)
    ws = gc.open_by_key(sheet_id).worksheet(hoja)
    return pd.DataFrame(ws.get_all_records())


def cargar() -> pd.DataFrame:
    if CSV_URL:
        return leer_csv(CSV_URL)
    if SHEET_ID:
        return leer_gspread(CRED_JSON, SHEET_ID, HOJA)
    raise SystemExit("Configurá CSV_URL (modo A) o SHEET_ID (modo B).")


def main():
    df = cargar()
    print(f"Filas cargadas: {len(df)}")
    print(df.head(10).to_string())

    # Ejemplo de filtros (lo que pedías: por fecha / taller / etc.)
    # df_taller = df[df["taller"] == "Pesado"]
    # df_semana = df[df["semana"] == "Semana 5"]
    # print(df_taller.to_string())


if __name__ == "__main__":
    main()
