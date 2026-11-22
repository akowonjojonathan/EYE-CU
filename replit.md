# Miotso Campus Guide

A mobile campus guide that helps students and visitors find mapped locations around Central University Miotso.

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

- `artifacts/miotso-maps` — Expo mobile app.
- `artifacts/miotso-maps/constants/campus.ts` — campus boundary and initial place directory.
- `artifacts/api-server` — shared Express API service.

## Architecture decisions

- The initial campus boundary and named places come from OpenStreetMap community data; confirm names and pin coordinates with the university before relying on them.
- Native devices use the platform map. The browser preview uses a schematic campus view.

## Product

- Search and filter campus places, view map pins, show the user's location, and open walking directions in Google Maps.

## User preferences

_No additional preferences recorded._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
