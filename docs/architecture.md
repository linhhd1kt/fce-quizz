# System Architecture — fce-quiz

## Overview

fce-quiz is a Next.js 16 web application for FCE (Cambridge English) exam practice.
Teachers upload PDF quizzes; students join live sessions via a 6-character room code.

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Browser (Client)"]
        T[Teacher UI\n/teacher/*]
        S[Student UI\n/s/CODE]
    end

    subgraph Server["VPS — PM2 Process"]
        App[Next.js 16 App\nApp Router + API Routes]
        Auth[NextAuth v5\nCredentials Provider]
    end

    subgraph Data["Data Layer"]
        DB[(PostgreSQL\nvia Drizzle ORM)]
    end

    subgraph AI["External AI Service"]
        Azure[Azure Inference Endpoint\nGPT-4o]
    end

    T -->|HTTPS requests| App
    S -->|HTTPS requests| App

    App -->|Session + Auth| Auth
    Auth -->|Read/write users| DB

    App -->|Drizzle queries| DB

    App -->|POST PDF text\n/api/extract-quiz| Azure
    Azure -->|MCQ JSON response| App
```

## Component Descriptions

| Component | Role |
|---|---|
| Next.js App Router | Handles both UI rendering (RSC) and API routes under `/api/*` |
| NextAuth v5 | Email + password authentication; session managed via JWT |
| Drizzle ORM | Type-safe SQL query builder targeting PostgreSQL |
| PostgreSQL | Persistent storage for users, quizzes, sessions, and attempts |
| Azure GPT-4o | Extracts multiple-choice questions from uploaded PDF text |
| PM2 | Process manager on VPS; keeps the Node.js process alive across deploys |

## Deployment

```mermaid
flowchart LR
    Dev[Developer\nlocal machine] -->|git push| GH[GitHub\nmain branch]
    GH -->|SSH deploy script| VPS[VPS\nUbuntu]
    VPS -->|pm2 reload| App[Next.js\nprocess]
    App -->|connects to| DB[(PostgreSQL\non same VPS)]
```

Production runs on a single VPS with PM2 managing the Next.js process.
`pm2 reload` enables zero-downtime restarts on each deploy.
