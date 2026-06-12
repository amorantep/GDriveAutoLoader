# GDrive AutoLoader — Guía de instalación y configuración

## Requisitos previos

- Python 3.11 o superior
- Una cuenta de Google
- Git

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/amorantep/GDriveAutoLoader.git
cd GDriveAutoLoader
```

---

## 2. Configurar Google Cloud Console

Esta es la parte más importante. Necesitas crear un proyecto en Google Cloud y habilitar la API de Drive para obtener las credenciales OAuth2.

### 2.1 Crear un proyecto

1. Ve a [https://console.cloud.google.com](https://console.cloud.google.com)
2. Haz clic en el selector de proyectos (esquina superior izquierda) → **New Project**
3. Dale un nombre, por ejemplo `gdrive-autoloader`, y haz clic en **Create**
4. Asegúrate de que el proyecto nuevo esté seleccionado en el selector

### 2.2 Habilitar la Google Drive API

1. En el menú lateral ve a **APIs & Services → Library**
2. Busca `Google Drive API`
3. Haz clic en el resultado y luego en **Enable**

### 2.3 Configurar la pantalla de consentimiento OAuth

1. Ve a **APIs & Services → OAuth consent screen**
2. Selecciona **External** y haz clic en **Create**
3. Rellena los campos obligatorios:
   - **App name**: `GDrive AutoLoader` (o el nombre que prefieras)
   - **User support email**: tu correo
   - **Developer contact information**: tu correo
4. Haz clic en **Save and Continue**
5. En la pantalla **Scopes** haz clic en **Save and Continue** (sin agregar scopes manualmente)
6. En la pantalla **Test users**:
   - Haz clic en **Add users**
   - Agrega tu correo de Google (el que vas a usar para autenticarte)
7. Haz clic en **Save and Continue** → **Back to Dashboard**

> **Nota:** Mientras la app esté en modo "Testing" solo los usuarios en la lista de test users pueden usarla. Para uso personal esto es suficiente y no requiere verificación de Google.

### 2.4 Crear las credenciales OAuth 2.0

1. Ve a **APIs & Services → Credentials**
2. Haz clic en **+ Create Credentials → OAuth client ID**
3. En **Application type** selecciona **Web application**
4. Dale un nombre, por ejemplo `gdrive-autoloader-local`
5. En **Authorized redirect URIs** haz clic en **+ Add URI** y agrega:
   ```
   http://localhost:8000/auth/callback
   ```
6. Haz clic en **Create**
7. En el popup que aparece, haz clic en **Download JSON**
8. Renombra el archivo descargado a `credentials.json` y colócalo en la raíz del proyecto:
   ```
   GDriveAutoLoader/
   ├── credentials.json   ← aquí
   ├── main.py
   ├── auth.py
   ...
   ```

> **Importante:** `credentials.json` está en `.gitignore`. Nunca lo subas a un repositorio público.

---

## 3. Instalar dependencias de Python

Se recomienda usar un entorno virtual:

```bash
# Crear entorno virtual
python -m venv .venv

# Activar (Linux/macOS)
source .venv/bin/activate

# Activar (Windows)
.venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

---

## 4. Configuración opcional con .env

Puedes crear un archivo `.env` en la raíz del proyecto para personalizar el comportamiento:

```bash
cp .env.example .env
```

Contenido del `.env`:

```env
# URI de redirección OAuth (debe coincidir con lo configurado en Google Cloud)
REDIRECT_URI=http://localhost:8000/auth/callback

# Pausa entre archivos subidos en milisegundos (default: 500)
DEFAULT_UPLOAD_DELAY_MS=500

# Puerto del servidor (default: 8000)
PORT=8000
```

---

## 5. Iniciar la aplicación

```bash
python main.py
```

O con recarga automática en desarrollo:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Abre el navegador en: **http://localhost:8000**

---

## 6. Primer uso — autenticación con Google

1. En la UI verás el indicador rojo **"No autenticado"** en la cabecera
2. Haz clic en **"Conectar con Google"**
3. Se abrirá la pantalla de consentimiento de Google — inicia sesión con tu cuenta
4. Acepta los permisos solicitados (acceso a archivos de Drive creados por la app)
5. Google redirige de vuelta a `http://localhost:8000` automáticamente
6. El indicador cambia a verde — ya estás autenticado

Las credenciales se guardan en `token.json` (también en `.gitignore`). En las próximas sesiones no tendrás que volver a autenticarte salvo que el token expire o hagas logout.

---

## 7. Flujo de uso

| Paso | Descripción |
|------|-------------|
| **1 — Archivos** | Ingresa la ruta absoluta de tu carpeta local. Puedes ordenar por nombre, fecha, tipo o tamaño. Selecciona los archivos a subir. |
| **2 — Destino** | Elige la carpeta de Google Drive donde se subirán los archivos. |
| **3 — Configurar** | Ajusta la pausa entre archivos (útil para no saturar el API en lotes grandes). |
| **4 — Progreso** | Sigue la subida en tiempo real. Cada archivo muestra su estado al terminar. |
| **5 — Reporte** | Ve el resumen final con conteos de OK / Fallidos / Omitidos y los MD5 comparados. Exporta a CSV o JSON. |

### Lógica de integridad

- Antes de subir: se calcula el **MD5** del archivo local (en streaming, sin cargar el archivo completo en memoria)
- Después de subir: Google Drive devuelve el `md5Checksum` del archivo almacenado
- Si ambos MD5 coinciden → ✅ **OK**
- Si no coinciden → ❌ **Fallo** (el archivo se marcó pero no se elimina; puedes reintentarlo)
- Si el archivo ya existe en Drive con el mismo nombre y mismo MD5 → ⏭ **Omitido** (no se sube de nuevo)

---

## 8. Solución de problemas

| Problema | Solución |
|----------|----------|
| `credentials.json not found` | Descarga el archivo desde Google Cloud Console (paso 2.4) y colócalo en la raíz del proyecto |
| `redirect_uri_mismatch` en Google | Verifica que en Google Cloud Console la URI autorizada sea exactamente `http://localhost:8000/auth/callback` |
| Error 403 al listar carpetas | Tu token puede haber expirado. Haz logout desde la UI y vuelve a autenticarte |
| La app muestra "This app isn't verified" | Es normal en modo Testing. Haz clic en **"Advanced" → "Go to gdrive-autoloader (unsafe)"** para continuar |
| Archivos grandes fallan a mitad | Son subidas resumables de 8 MB por chunk. Si falla, el archivo aparece como ❌ en el reporte; volver a iniciar la subida lo reintentará |
