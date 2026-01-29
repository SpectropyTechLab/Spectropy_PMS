# AGENTS.md

## Project Overview
Spectropy PMS is a fullstack project management system in a single repo. The frontend is React + TypeScript (Vite) and the backend is Express + TypeScript. Shared types and API contracts live in `shared/`.

## Tech Stack
- Frontend: React 18, Vite, Wouter, TanStack React Query, Tailwind CSS, shadcn/ui (Radix UI)
- Backend: Express, Drizzle ORM, Zod
- Database: PostgreSQL (schema in `shared/schema.ts`)

## Repo Layout
- `client/` React app
- `server/` Express API
- `shared/` Zod + Drizzle schemas and typed routes

## Development Commands
- `npm run dev` - start dev server
- `npm run build` - build for production
- `npm run start` - run production server
- `npm run check` - typecheck
- `npm run db:push` - apply schema to database

## Coding Conventions
- Use TypeScript everywhere; keep types in sync with `shared/` contracts.
- Prefer existing UI components and patterns (shadcn/ui + Tailwind classes).
- Keep UI styling consistent with the current dark theme.
- Use simple, everyday language in user-facing text.
- Avoid adding new libraries unless explicitly requested.

## Notes
- API routes and validation live in `shared/routes.ts` and are consumed by both client and server.
- Database schema changes should go through Drizzle.
