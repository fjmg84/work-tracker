# Work Tracker

App de escritorio para registrar horas de trabajo, proyectos, PRs y commits de GitHub, y generar reportes mensuales en CSV.

## Características

- Registro de sesiones de trabajo por proyecto
- Integración con GitHub para obtener PRs y commits
- Generación de reportes mensuales en CSV
- Almacenamiento seguro de tokens de GitHub
- Interfaz de escritorio con Electron y React

## Requisitos

- Node.js 20+
- npm

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
./start-service.sh
```

O manualmente:

```bash
npm run build
npx electron .
```

## Estructura del Proyecto

```
work-tracker/
├── electron/           # Proceso principal de Electron
│   ├── main.ts        # Proceso principal
│   └── preload.ts     # Script de preload
├── src/               # Código del renderer (React)
│   ├── components/    # Componentes React
│   ├── lib/           # Utilidades
│   ├── types.ts       # Definiciones de tipos TypeScript
│   └── global.d.ts    # Declaraciones globales
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
- `npm run build` - Construye para producción
- `npm run build:electron` - Compila solo el código de Electron
- `npm run dev:vite` - Inicia solo el servidor de Vite
- `npm run dev:electron` - Inicia solo Electron

## Tecnología

- **Frontend**: React 18, TypeScript
- **Desktop**: Electron
- **Build**: Vite
- **Database**: SQLite (better-sqlite3)
- **GitHub API**: Octokit

## Notas

- Los tokens de GitHub se almacenan de forma segura usando `safeStorage` de Electron
- La base de datos SQLite se guarda en el directorio de datos del usuario
- En modo producción, la aplicación carga desde archivos estáticos en `dist/`
