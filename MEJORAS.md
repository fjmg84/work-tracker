# Mejoras de arquitectura y rendimiento

Refactor completo realizado en la rama `refactor/architecture-performance` (sin merges a `main`).

**Verificación:** `npm run build` OK (vite + tsc estricto) · 33/33 tests pasan (3 archivos) · `npm run dev` arranca correctamente.

---

## 1. Arquitectura del proceso main (Electron)

### Antes
`electron/main.ts` era un "god-file" de 592 líneas que concentraba: creación de ventana, cifrado de tokens, ciclo de vida de la app, detección de inactividad, ~20 handlers IPC y toda la lógica de la API de GitHub (con bloques duplicados 5 veces: token → Octokit → parseo de repo → lookup de cuenta).

### Ahora
`main.ts` quedó en 34 líneas como orquestador. Nueva estructura:

```
electron/
├── main.ts                     # Orquestador: lifecycle + init
├── window.ts                   # createWindow() y getMainWindow()
├── preload.ts                  # API tipada, sin `any`
├── shared/
│   └── contract.ts             # FUENTE ÚNICA: tipos de dominio, canales IPC, interfaz Api
├── services/
│   ├── tokens.ts               # safeStore/Get/Delete token (safeStorage)
│   ├── github.ts               # GitHubService: toda la lógica de GitHub consolidada
│   └── idleMonitor.ts          # powerMonitor + auto-pausa por inactividad + sesiones stale
├── ipc/
│   ├── index.ts                # registerIpcHandlers(db)
│   ├── accounts.ts / projects.ts / sessions.ts
│   ├── github.ts / ai.ts / app.ts
│   └── validate.ts             # Validación de payloads IPC (tipos, IDs, formato repo)
└── lib/
    └── concurrency.ts          # mapWithConcurrency (paralelismo limitado)
```

### Beneficios
- **GitHubService** consolidó los 5 bloques duplicados de GitHub en un solo servicio con:
  - Caché de instancias `Octokit` por cuenta (antes se creaba una por llamada).
  - Invalidación automática al actualizar/eliminar el token de una cuenta.
  - `parseRepo` y resolución de contexto (token + cuenta + owner/repo) en un solo lugar.
- **Validación de entrada en todos los handlers IPC**: antes el renderer podía enviar cualquier cosa sin verificación; ahora se validan IDs, timestamps, strings, formato `usuario/repo` e idiomas.
- **Logs de debug eliminados** (`console.log("[PR Desc]...")`) del código de producción.

---

## 2. Contrato IPC tipado de punta a punta

### Antes
`preload.ts` usaba `any` en todos los parámetros y valores de retorno. El tipo `Api` se mantenía a mano en `src/types.ts` sin garantía de que coincidiera con la implementación.

### Ahora
- `electron/shared/contract.ts` define una sola vez: tipos de dominio (`Account`, `Project`, `Session`, `PullRequest`...), payloads IPC, constantes de canales (`IPC.db.listSessions`, etc.) y la interfaz `Api` completa de `window.api`.
- **Main** y **preload** usan las constantes de canal del contrato (imposible que diverjan los strings).
- **Preload** está totalmente tipado contra `Api` (cero `any`).
- **Renderer** consume los tipos re-exportados desde `src/types.ts`, que apunta al contrato.
- El preload se **bundlea con esbuild** en un único archivo autocontenido (requerido por el sandbox de Electron, que no permite `require` de módulos relativos).

---

## 3. Rendimiento — API de GitHub

### Antes
- `getUserActivity` descargaba **todos los PRs del repositorio** (`paginate(pulls.list, state: "all")`) y filtraba en cliente por autor y fecha. En repos grandes eran cientos de MB y decenas de requests.
- Los commits de cada PR se pedían uno a uno.
- `Reports` relanzaba todas las llamadas de red a GitHub **con cada click en un checkbox** de proyecto, y el fetch era **secuencial** por proyecto (`for...await`).
- Sin caché: cambiar de pestaña y volver repetía toda la descarga.

### Ahora
- **GitHub Search API**: `search.issuesAndPullRequests` con query `repo:X is:pr author:Y created:desde..hasta` — el filtrado ocurre en el servidor. Fallback automático al método anterior (`pulls.list`) si el search falla por rate limit (403) o validación (422).
- **Paralelismo limitado**: fetch de commits por PR y diffs por commit con `mapWithConcurrency` (límite 4, helper propio de 20 líneas sin dependencia nueva).
- **Caché en memoria con TTL de 5 minutos** en el main, con clave `(cuenta, repo, rango de fechas)`: toggles de checkboxes y cambios de pestaña ya no repiten llamadas de red.
- **Renderer**: `Reports` y `Activity` fetchean proyectos en paralelo con `Promise.allSettled` (un proyecto que falla no bloquea a los demás).

---

## 4. Rendimiento — Base de datos

- **Índices nuevos** en `sessions`:
  - `idx_sessions_start_time (start_time)` — filtros por rango de fechas (reportes).
  - `idx_sessions_project_start (project_id, start_time)` — filtros por proyecto.
  - `idx_sessions_active (end_time) WHERE end_time IS NULL` — parcial, para la sesión activa.
- **Statements preparados cacheados** (`queries.ts`): antes se llamaba a `db.prepare()` en cada query; ahora se cachean por conexión + SQL con un `WeakMap` (incluye las queries dinámicas de `listFiltered`).
- **Migraciones versionadas** con `PRAGMA user_version` y lista ordenada de migraciones (antes: ALTERs ad-hoc inspeccionando columnas). Idempotentes y en transacción.

---

## 5. React — estado y re-renders

### Antes
- Estado con prop-drilling: `App.tsx` usaba un `refreshFlag` que disparaba refetch completo de proyectos/cuentas; cada pestaña refetcheaba por su cuenta.
- `<div key={activeTab}>` remontaba el contenido al cambiar de pestaña — el Timer **perdía notas y proyecto seleccionado**.
- El `setInterval` de 1s del cronómetro re-renderizaba el componente completo (~300 líneas de JSX).
- Errores IPC silenciosos en consola.

### Ahora
- **Store centralizado con Zustand** (`src/store/appStore.ts`): `projects`, `accounts` y `sessionsVersion`. Las mutaciones recargan solo lo que toca; adiós `refreshFlag` y prop-drilling. Los componentes ya no reciben props de datos.
- **Pestañas keep-alive con montaje perezoso**: cada pestaña se monta la primera vez que se visita y luego queda viva (oculta con CSS) — el Timer conserva su estado al alternar, y las pestañas no visitadas no ejecutan efectos.
- **`TimerDisplay` memoizado**: el tick de 1s solo re-renderiza el display del reloj, no el formulario.
- **Reports desacoplado**: las sesiones vienen de SQLite (barato, se recargan al cambiar de mes o guardar sesión); la actividad de GitHub se carga una vez por mes/proyectos con spinner; los checkboxes filtran en memoria con `useMemo` (cero red).
- **`ErrorBoundary`** a nivel App con pantalla de error y botón de reintento.
- **Errores IPC unificados**: handler global de `unhandledrejection` que muestra toast (sonner) limpiando el prefijo técnico de Electron.

---

## 6. Tooling y DX

- **Fix `ELECTRON_RUN_AS_NODE`**: los terminales integrados de IDEs basados en Electron (VS Code, Windsurf) exportan `ELECTRON_RUN_AS_NODE=1`, lo que rompía `npm run dev` con `TypeError: app.getPath undefined` en `db/connection`. Nuevo `scripts/dev-electron.js` que elimina la variable antes de lanzar Electron (`dev:electron` lo usa).
- **Preload bundleado con esbuild** en `build:electron` (ver §2). Sin dependencias nuevas (esbuild viene con Vite).
- **Normalización de clases Tailwind v4**: 206 ocurrencias de `*-[var(--color-*)]` convertidas a utilities nombradas (`text-text-light`, `bg-surface-muted-dark`, `border-border-light`, `text-primary`...) en los 10 componentes de `src/`. Sin warnings del linter de Tailwind.
- **Dependencia nueva**: `zustand@5.0.14` (store de React). No se añadió ninguna otra.

---

## 7. Tests

Suite ampliada de 13 → **33 tests** (vitest):

| Archivo | Cobertura |
|---|---|
| `electron/db/queries.test.ts` (22) | Esquema, pause/resume y acumulación de `total_paused_ms`, idle-pause, cierre masivo, **`user_version` e índices**, sesiones stale (`getStaleSessions`, `closeStale`), `listFiltered` (filtros y orden) |
| `electron/services/github.test.ts` (7) | Query de Search API correcta (autor + rango), filtrado de commits por autor, fallback 403 a `pulls.list`, error claro en 404, caché TTL, validación de formato de repo, `validateGitHubToken` |
| `electron/lib/concurrency.test.ts` (4) | Orden preservado, límite de concurrencia respetado, array vacío, propagación de errores |

> **Nota de entorno:** `better-sqlite3` es un módulo nativo compilado para el ABI de Electron. Para correr los tests bajo Node hay que reconstruirlo antes y restaurarlo después:
> ```bash
> cp node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node /tmp/binding-electron.bak
> npm rebuild better-sqlite3 && npx vitest run
> cp /tmp/binding-electron.bak node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node
> ```

---

## Resumen de impacto

| Área | Antes | Ahora |
|---|---|---|
| `main.ts` | 592 líneas, 6 responsabilidades | 34 líneas, orquestador |
| Lógica GitHub | Duplicada ×5 | `GitHubService` único con cachés |
| PRs por reporte | Descarga completa del repo | Filtrado en servidor (Search API) |
| Fetch de actividad | Secuencial, sin caché | Paralelo (×4) + TTL 5 min |
| Red al filtrar proyectos | Refetch completo por checkbox | Cero (filtro en memoria) |
| Queries SQLite | `prepare()` por llamada, sin índices | Statements cacheados + 3 índices |
| Cambio de pestaña | Remonta y pierde estado | Keep-alive |
| Tick del cronómetro | Re-render de ~300 líneas JSX | Subárbol memoizado |
| Tipado IPC | `any` en todo el preload | Contrato estricto de punta a punta |
| Validación IPC | Ninguna | Todos los handlers |
| Tests | 13 | 33 |
