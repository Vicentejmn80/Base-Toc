# Base-toc

Aplicación web (Vite + React + TypeScript) para crear y medir espacios de datos personales, con PWA y asistente de IA.

## Requisitos

- Node.js 20+
- npm

## Desarrollo local

```bash
npm install
cp .env.example .env.local
```

En `.env.local` define (sin prefijo `VITE_`):

- `OPENAI_API_KEY` — clave de OpenAI (solo servidor, nunca en el frontend)
- `OPENAI_MODEL` — opcional, por defecto `gpt-4o-mini`

Arranca cliente + servidor Express de IA:

```bash
npm run dev
```

- Cliente Vite: http://localhost:5173  
- Servidor IA (Express): http://127.0.0.1:8787  
- Vite hace proxy de `/api/*` → Express, así que el frontend llama rutas relativas `/api/ai/*`.

Probar solo el frontend contra build estático:

```bash
npm run build
npm run preview
```

(Necesitas `npm run dev:server` en otra terminal para que la IA responda en preview.)

## Deploy en Vercel

1. Conecta el repositorio en [Vercel](https://vercel.com).
2. Framework: **Vite** (o deja que detecte `vercel.json`).
3. Build: `npm run build`, output `dist`.
4. Las rutas de IA viven en **`/api`** (Serverless Functions), no en Express:
   - `POST /api/ai/creation`
   - `POST /api/ai/capture`
   - `POST /api/ai/analyze`
   - `GET /api/health`
5. El frontend usa `fetch('/api/ai/...')` en el mismo dominio; la API key **no** viaja al navegador.

### Variables de entorno en Vercel

Configúralas en **Project → Settings → Environment Variables**.  
Usa los mismos nombres que en local, **sin** prefijo `VITE_`:

| Variable         | Obligatoria | Descripción                          |
|------------------|-------------|--------------------------------------|
| `OPENAI_API_KEY` | Sí          | Clave de OpenAI (solo backend)       |
| `OPENAI_MODEL`   | No          | Modelo, ej. `gpt-4o-mini` (default)  |

Marca al menos **Production** y **Preview** (recomendado también **Development** si usas `vercel dev`).

No añadas `OPENAI_API_KEY` ni `OPENAI_MODEL` como variables expuestas al cliente en Vercel.

## Build

```bash
npm run build
```

Compila el frontend (`tsc -b` + `vite build`). Las funciones en `/api` las empaqueta Vercel al desplegar.

## Arquitectura IA

- **Producción (Vercel):** `api/ai/*.ts` → handlers en `server/handlers/` → `server/openai.ts`.
- **Local:** `server/index.ts` (Express) reutiliza los mismos handlers.

El servidor Express local se mantiene para desarrollo; no hace falta ejecutarlo en Vercel.
