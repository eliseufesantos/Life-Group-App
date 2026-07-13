# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend (PWA): `artifacts/life-group` — Vite + React + Tailwind v4 + shadcn/radix, roteamento com wouter
- Design system (tokens de cor/fonte/radius): `artifacts/life-group/src/index.css` (light + dark)
- Layout do app (header + bottom nav de 3 abas): `artifacts/life-group/src/components/layout.tsx`
- Header de sub-páginas (botão voltar): `artifacts/life-group/src/components/page-header.tsx`
- Traduções de role/categoria: `artifacts/life-group/src/lib/labels.ts`
- API server: `artifacts/api-server`; contrato OpenAPI: `lib/api-spec/openapi.yaml`

## Architecture decisions

- UI branco + azul (primário `hsl(217 91% 52%)`), inspirada em AbacatePay/biip.club: fundo azul-claro suave, cards brancos rounded-2xl/3xl, botões pill, headings em Plus Jakarta Sans (mapeada em `--app-font-serif`, então `font-serif` = fonte display)
- Navegação mobile-first com apenas 3 abas: Mural (rota `/`, funde o antigo Início com o mural), Agenda (`/calendario`) e Perfil (`/perfil`, hub que dá acesso a membros, discipulado, convites, campanhas, relatórios, célula, notificações e ajustes)
- Conteúdo autenticado centralizado em `max-w-lg` (aparência de app mesmo no desktop); sub-páginas usam `PageHeader` com voltar em vez do header de marca
- Calendário mobile: grade mensal compacta com pontinhos de evento + lista do dia selecionado (sem grade de células gigante)

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
