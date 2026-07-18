# Este cambio es solo para probar la generacion de descripcion del PR

# Work Tracker

App de escritorio para registrar horas de trabajo, proyectos, PRs y commits de GitHub, y generar reportes mensuales en CSV.

## Características

- Registro de sesiones de trabajo por proyecto
- Pausa/Reanudar manual de sesiones
- Detección automática de inactividad (idle) y suspensión del sistema
- Auto-cierre de sesiones activas mayores a 24 horas
- Integración con GitHub para obtener PRs y commits
- Generación de reportes mensuales en CSV
- Almacenamiento seguro de tokens de GitHub
- Tema oscuro/claro
- Interfaz de escritorio con Electron y React

## Requisitos

- Node.js 20+
- npm
- Herramientas de compilación nativas (para empaquetar, por el módulo `better-sqlite3`):
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Visual Studio Build Tools con el workload de C++
  - **Linux**: `build-essential` y `libsqlite3-dev`

## Instalación

```bash
npm install
```

## Desarrollo

Ejecutar en modo desarrollo con servidor de desarrollo:

```bash
npm run dev
```

## Producción

Ejecutar en modo producción (construye y ejecuta):

```bash
npm run build
npx electron .
```

## Compilar la aplicación (instaladores)

La app usa [electron-builder](https://www.electron.build/) para generar instaladores nativos. Los artefactos se generan en la carpeta `release/`.

> ⚠️ **Importante:** `better-sqlite3` es un **módulo nativo** que se compila específicamente para el sistema operativo y la arquitectura donde se ejecuta el build. Por eso **cada instalador debe generarse en su propio sistema operativo**. Un `.dmg` generado en macOS **no funcionará** en Windows o Linux, y viceversa.

### macOS (configurado actualmente)

El proyecto está configurado para generar el instalador de macOS:

```bash
npm run build:mac
```

Esto genera `release/Work Tracker-<version>-arm64.dmg`. Para instalar, abre el `.dmg` y arrastra **Work Tracker** a la carpeta de Aplicaciones.

Requisito para compilar: Xcode Command Line Tools (`xcode-select --install`).

### Windows y Linux (pasos para habilitarlos)

La configuración actual solo incluye macOS. Para compilar también para Windows y/o Linux, sigue estos pasos:

**1. Agrega los targets en el campo `build` de `package.json`:**

```json
"win": {
  "target": "nsis"
},
"linux": {
  "target": ["AppImage", "deb"],
  "category": "Utility"
}
```

**2. Agrega los scripts en `package.json`:**

```json
"build:win": "npm run pack:base && electron-builder --win",
"build:linux": "npm run pack:base && electron-builder --linux"
```

**3. Compila en el sistema operativo correspondiente:**

| Sistema | Comando               | Dónde compilar | Artefacto                                          | Requisito                                                                                     |
| ------- | --------------------- | -------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| macOS   | `npm run build:mac`   | en un Mac      | `release/Work Tracker-<version>-arm64.dmg`         | Xcode Command Line Tools                                                                      |
| Windows | `npm run build:win`   | en Windows     | `release/Work Tracker Setup <version>.exe`         | [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++) |
| Linux   | `npm run build:linux` | en Linux       | `release/Work Tracker-<version>.AppImage` y `.deb` | `build-essential` y `libsqlite3-dev`                                                          |

### Generar los tres instaladores con CI (recomendado)

Como cada instalador debe compilarse en su propio sistema operativo, la forma más práctica de generar los tres sin tener las tres máquinas es usar **GitHub Actions** con un runner por plataforma (requiere haber agregado los scripts `build:win` y `build:linux` del paso anterior). Ejemplo de workflow (`.github/workflows/build.yml`):

```yaml
name: Build

on:
  push:
    tags:
      - "v*"

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - name: Build macOS
        if: matrix.os == 'macos-latest'
        run: npm run build:mac
      - name: Build Windows
        if: matrix.os == 'windows-latest'
        run: npm run build:win
      - name: Build Linux
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:linux
      - uses: actions/upload-artifact@v4
        with:
          name: installers-${{ matrix.os }}
          path: release/**
```

Cada runner construye su propio instalador (con el `better-sqlite3` compilado para esa plataforma) y lo sube como artefacto descargable.

## Estructura del Proyecto

```
work-tracker/
├── electron/           # Proceso principal de Electron
│   ├── main.ts        # Proceso principal
│   ├── preload.ts     # Script de preload
│   └── db/            # Capa de base de datos
│       ├── connection.ts   # Instancia SQLite
│       ├── migrations.ts   # Schema inicial
│       └── queries.ts      # Queries tipadas
├── src/               # Código del renderer (React)
│   ├── components/    # Componentes React
│   ├── hooks/         # Custom hooks (useTheme)
│   ├── types.ts       # Definiciones de tipos TypeScript
│   ├── global.d.ts    # Declaraciones globales
│   └── index.css      # Estilos Tailwind CSS
├── dist/              # Archivos compilados para producción
├── logs/              # Logs de la aplicación
└── package.json       # Dependencias y scripts
```

## Configuración de GitHub

Para integrar con GitHub, necesitas un token de acceso personal:

1. Ve a GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Genera un nuevo token con permisos `repo` (o `public_repo` para repos públicos)
3. En la aplicación, ve a "Cuentas GitHub" → "Agregar cuenta"
4. Ingresa:
   - **Etiqueta**: nombre descriptivo (ej. "Trabajo", "Personal")
   - **Usuario de GitHub**: tu username
   - **Token**: el token generado (ej. `ghp_xxxxxxxxxxxx`)

## Scripts Disponibles

- `npm run dev` - Inicia en modo desarrollo
- `npm run build` - Construye para producción (sin empaquetar)
- `npm run build:electron` - Compila solo el código de Electron
- `npm run dev:vite` - Inicia solo el servidor de Vite
- `npm run dev:electron` - Inicia solo Electron
- `npm run build:mac` - Genera el instalador `.dmg` para macOS
- `npm run pack:base` - Construye el frontend y el código de Electron (paso previo al empaquetado)

> Los scripts `build:win` y `build:linux` no vienen configurados por defecto. Consulta la sección [Windows y Linux (pasos para habilitarlos)](#windows-y-linux-pasos-para-habilitarlos) para agregarlos.

## Tecnología

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Desktop**: Electron
- **Build**: Vite
- **Database**: SQLite (better-sqlite3)
- **GitHub API**: Octokit

## Notas

- Los tokens de GitHub se almacenan de forma segura usando `safeStorage` de Electron
- La base de datos SQLite se guarda en el directorio de datos del usuario
- En modo producción, la aplicación carga desde archivos estáticos en `dist/`
