# Taskly

Taskly is a personal to-do app built by VIT Team 3 with Next.js, React, Express, and PostgreSQL. Each account has a private workspace with task priorities, categories, due dates, and completion history. The dashboard includes search, filters, a calendar, and a weekly productivity chart.

## Prerequisites

- Git, npm, and Node.js 22 or later.
- A running PostgreSQL server and a PostgreSQL role that can connect to the application database and create tables and indexes. The local example uses PostgreSQL 16.

## Run locally

**1. Clone the repository and install both sets of dependencies.**

```bash
git clone https://github.com/KrishGuptaVirtusa/todo-app.git
cd todo-app
npm ci
npm --prefix backend ci
```

**2. Start PostgreSQL and create the database.**

If you installed PostgreSQL 16 through Homebrew on macOS, start it with `brew services start postgresql@16`. If you already have a running PostgreSQL instance, use that server and its connection details.

```bash
pg_isready -h localhost -p 5432
createdb -h localhost taskly
```

Run `createdb` only when the database is new. If your PostgreSQL role differs from your OS username, pass `-U your_role` or ask your database administrator to create the database.

**3. Configure Express and apply the schema.**

```bash
cp backend/.env.example backend/.env
# Edit DATABASE_URL in backend/.env to match your PostgreSQL connection.
npm --prefix backend run db:migrate
```

The example uses `postgresql://localhost/taskly`. For a password-authenticated connection, use `postgresql://USER:PASSWORD@HOST:PORT/DATABASE` with your own values. Percent-encode special characters in the username or password. Keep credentials in `backend/.env`, which Git ignores.

**4. Start Express and Next.js in separate terminals.** Run both commands from the project root.

```bash
npm --prefix backend run dev
```

```bash
npm run dev
```

Open [the login page](http://localhost:3000/login), choose **Create an account**, and add a task. A new account starts with an empty workspace. Sign out and back in to see the task again.

## Configuration

| Location | Variable | Development default or purpose |
| --- | --- | --- |
| `backend/.env` | `DATABASE_URL` | PostgreSQL connection string. The example targets `taskly` on localhost. |
| `backend/.env` | `PORT` | Express listens on `5500`. |
| `backend/.env` | `NODE_ENV` | Defaults to `development`. Use `production` for a deployed Express server. |
| `backend/.env` | `CORS_ORIGIN` | Comma-separated frontend origins. The example contains `http://localhost:3000`. |
| `backend/.env` | `COOKIE_SECURE` | Production cookies require HTTPS by default. Set `false` only for a local HTTP production test. |
| Root `.env.local` | `API_BACKEND_URL` | Next.js proxies auth and task requests to `http://127.0.0.1:5500` by default. Change this if Express uses a different host or port. |
| Test command environment | `TEST_DATABASE_URL` | PostgreSQL connection used by the backend integration suite. |

Restart the relevant server after changing its environment. Set `API_BACKEND_URL` before running a production frontend build.

## How it works

The browser talks to Next.js on port `3000`. Next.js forwards `/api/auth/*` and `/api/todos/*` to Express on port `5500`. Express stores salted scrypt password hashes and hashed session tokens in PostgreSQL. The browser receives an HTTP-only session cookie. Express validates it and scopes every task query to the signed-in account.

| Path | Purpose |
| --- | --- |
| `app/` | Login page, task dashboard, and styles |
| `components/` | Task UI components |
| `lib/api.js` | Frontend API client and error handling |
| `next.config.mjs` | API proxy configuration |
| `backend/src/` | Express routes, authentication, validation, and PostgreSQL data access |
| `backend/db/` | Database schema and migration command |
| `backend/tests/` | Backend integration tests |

The [backend API guide](backend/README.md) lists endpoints and example responses.

## Checks and production build

Run from the repository root.

```bash
npm run lint
npm run build
```

Run the backend integration tests against a dedicated test database. The test role needs permission to create schemas. The suite creates and removes its own schema.

```bash
createdb -h localhost taskly_test
TEST_DATABASE_URL=postgresql://localhost/taskly_test npm --prefix backend test
```

The backend suite skips when `TEST_DATABASE_URL` is unset. For a manual check, create two accounts and confirm that a task created in one account appears again after signing back into that account, while the other workspace stays empty.

For production, apply the schema to the target database, build the frontend, and run `npm --prefix backend start` and `npm start` as separate processes. Serve the frontend over HTTPS so the browser accepts the production session cookie.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `EADDRINUSE` on port `5000` or `5500` | Check for an old `PORT` override or another process on that port. The current default is `5500`. If you choose another port, update both `PORT` and `API_BACKEND_URL`. |
| PostgreSQL unreachable or `ECONNREFUSED` on port `5432` | Start PostgreSQL and check the host and port in `DATABASE_URL`. |
| PostgreSQL rejects the connection or says the database does not exist | Verify the role, credentials, and database name in `backend/.env`. Create the database if needed. |
| The database schema is missing | Run `npm --prefix backend run db:migrate` with the application database configured. |
| The frontend cannot reach the API | Check `curl http://localhost:5500/api/health` and confirm that `API_BACKEND_URL` points to the running Express server. The health endpoint confirms Express is reachable. |

## Team

Backend contributors include Kaligotla Venkata Vasistha Ramana Rao (Vasistha) and Krish Gupta.
