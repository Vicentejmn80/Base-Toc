# Base-toc

Aplicación web (Vite + React + TypeScript) para crear y medir espacios de datos personales, con PWA y asistente de IA en desarrollo local.

## Requisitos

- Node.js 20+
- npm

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Añade OPENAI_API_KEY en .env.local para las rutas /api/ai/*
npm run dev
```

- Cliente: http://localhost:5173
- Servidor IA (Express): http://127.0.0.1:8787

## Build

```bash
npm run build
npm run preview
```

## Nota sobre despliegue

El frontend se puede publicar en Vercel como sitio estático. Las rutas `/api/ai/*` requieren el servidor Node en `server/` (variables `OPENAI_API_KEY`, etc.); en producción conviene un backend aparte o funciones serverless adaptadas.
