# FitTrack - Solo Coach Dashboard

## Overview
A simple fitness trainer app designed for solo coaches who see clients in person and online. Streamlines all client data in one place with schedule management, client profiles, session packages, payments, and notes.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter (frontend), Express (backend)
- **State**: TanStack React Query

## Project Structure
- `client/src/pages/` - Dashboard, Schedule, Clients, Payments, Notes, Settings
- `client/src/components/` - AppSidebar, shadcn UI components
- `server/` - Express server, routes, storage layer, database connection, seed data
- `shared/schema.ts` - Drizzle schema definitions (clients, sessions, packages, sessionNotes, settings)

## Key Features
- **Dashboard**: Today's schedule, stats, upcoming sessions, low session alerts
- **Schedule**: Weekly calendar view, book sessions (1:1, group, online, outdoor), mark complete/cancel
- **Clients**: Client profiles with session history, packages, notes in a detail dialog
- **Payments**: Session packages with usage tracking, progress bars, low session alerts
- **Notes**: Session notes with client filter and search
- **Settings**: Trainer profile, cancellation policy, payment link, notification threshold

## Database Tables
- `clients` - name, email, phone, notes, sessionType, status
- `sessions` - clientId, title, date, startTime, endTime, sessionType, location, status, notes
- `packages` - clientId, name, totalSessions, usedSessions, price, status
- `session_notes` - sessionId, clientId, content, date
- `settings` - trainerName, businessName, cancellationPolicy, paymentLink, lowSessionThreshold

## API Routes (all prefixed with /api)
- GET/POST /clients, GET/PATCH/DELETE /clients/:id
- GET/POST /sessions, GET/PATCH/DELETE /sessions/:id
- GET/POST /packages, PATCH /packages/:id
- GET/POST /notes
- GET/PUT /settings

## Running
- `npm run dev` starts both frontend and backend on port 5000
- `npm run db:push` pushes schema changes to database
