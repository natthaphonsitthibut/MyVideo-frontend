# MyVideo — frontend

pnpm workspace: `apps/web` (Vite + React 19 + Tailwind 4 + shadcn/ui + React Router + TanStack Query),
later `packages/stage` and `packages/timeline-core`. Node ≥ 22, pnpm only.

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm dev            # http://127.0.0.1:5180 ; /api is proxied to the API on :3000 (MYVIDEO_API_URL)
pnpm e2e            # Playwright, Chromium, 1 worker; needs the API running
```
