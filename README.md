# Apex Motors — Garage Management System

Apex Motors is a workshop operations system for the front desk, the service floor, and the office. It covers customers, vehicles, service requests, mechanics, labour, parts, invoices, reports, notifications, and email. Updates reach the right people over Socket.IO without a refresh.

## Stack

- **Client:** React 18, TypeScript, Vite, React Router, Redux Toolkit, Axios, React Hook Form, Zod, Material UI, Recharts, Socket.IO client
- **Server:** Node.js, Express, MongoDB, Mongoose, JWT (httpOnly cookies), bcryptjs, Zod, Multer, Socket.IO, Nodemailer, Swagger, Helmet, CORS, Morgan, express-rate-limit
- **Tests:** Jest, Supertest, React Testing Library
- **Delivery:** Docker Compose, GitHub Actions

## Roles

Authorization is enforced in Express middleware and again inside handlers. Hiding a menu item is not the security boundary.

| Role | Access |
| --- | --- |
| Admin | Full access, users, roles, settings, SMTP test, audit log |
| Manager | Dashboard, customers, vehicles, jobs, mechanics, catalogue, billing, reports |
| Receptionist | Customers, vehicles, jobs, customer email, invoices |
| Mechanic | Assigned jobs only, related vehicles, diagnosis, status, labour, parts, notes, completion |

Public registration creates an inactive receptionist account until an admin enables it.

## Project layout

```
client/     React application
server/     Express API, seed, tests
docker-compose.yml
```

Interactive API docs are served at `/api/docs` when the server is running.

## Environment

Copy `server/.env.example` to `server/.env` and replace the JWT secrets. SMTP values are optional until you send mail. The API never returns SMTP passwords.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets, 16+ characters |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | Token lifetimes (`15m`, `7d`) |
| `CLIENT_URL` | Browser origin, comma-separated if needed |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Mail server |
| `SMTP_USER`, `SMTP_PASSWORD` | Mailbox credentials |
| `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` | From header |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | First administrator |
| `SEED_USER_PASSWORD` | Shared password for other seeded staff |

Cookies are marked `Secure` when `CLIENT_URL` uses `https`.

## Local development

Requirements: Node.js 20+, MongoDB 7.

```bash
cp server/.env.example server/.env
npm install
npm install --prefix server
npm install --prefix client
npm run seed
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:5000/api
- API docs: http://localhost:5000/api/docs

The Vite dev server proxies `/api`, `/socket.io`, and `/uploads`.

If MongoDB and Docker are not available, this starts a temporary database on port 27017. Everything in it is lost when the process stops:

```bash
npx tsx scripts/memory-mongo.ts
```

Run that from `server/` before `npm run seed`.

## Seed data

`npm run seed` generates a linked workshop: 100+ staff and mechanics, 300+ customers, 500+ vehicles, 1,000+ service requests, 50+ labour items, 200+ parts, 500+ invoices, and 1,000+ notifications plus audit records. Dates, statuses, priorities, stock, and payments vary. Nothing is hard-coded in React.

The command refuses to run when users already exist.

```bash
npm run seed:reset -- --confirm
```

`npm run seed:reset` without `--confirm` does not delete anything.

After seeding, sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. These accounts share `SEED_USER_PASSWORD`:

- manager@apexmotors.local
- receptionist@apexmotors.local
- mechanic@apexmotors.local

## Docker

```bash
cp server/.env.example server/.env
docker compose up --build
```

- App: http://localhost:8080
- API: http://localhost:5000
- MongoDB: localhost:27017

Compose points the API at the `mongo` service and the browser at port 8080. Seed from the host with `MONGODB_URI=mongodb://127.0.0.1:27017/garage_ms` or from a one-off server container.

## Production

1. Set strong JWT secrets and a real `CLIENT_URL` on HTTPS.
2. Set SMTP variables on the server only.
3. Build the client with `npm run build --prefix client` or use the client Docker image, which serves the bundle through nginx and proxies the API and websockets.
4. Run the API with `npm start --prefix server` against a managed MongoDB database.
5. Change the seeded administrator password.

## Service workflow

`Pending → Diagnosing → Waiting for Parts → In Progress → Completed`, with `Cancelled` from the open states. Priorities are Low, Medium, High, and Urgent. Completing a job can raise an invoice. Parts drawn onto a job reduce stock atomically; removing the line returns them.

## Real-time events

Socket.IO authenticates with the access cookie and joins `user:{id}` and `role:{role}` rooms. Opening a job joins `request:{id}` after the server checks access. The client reconnects with backoff and refreshes the session if the socket is rejected.

Events include customer and vehicle changes, service request create/update/assignment/status/parts, billing and invoice changes, notifications, and a dashboard refresh signal.

## Email

Nodemailer templates cover welcome, registration, service confirmation, mechanic assignment, status, completion, invoice, password reset, and an admin SMTP test. Each attempt is stored in the email log with `sent`, `failed`, or `skipped`. Settings can turn operational templates off. Password reset still attempts delivery. If SMTP is missing, the test endpoint names the missing variables and does not reveal secrets.

## Scripts

| Command | Where | What |
| --- | --- | --- |
| `npm run dev` | root | API and client together |
| `npm run lint` | root | ESLint both packages |
| `npm test` | root | Jest both packages |
| `npm run build` | root | Production client build |
| `npm run seed` | root | Seed an empty database |
| `npm run typecheck` | server or client | TypeScript |

## Tests

Server tests use an in-memory MongoDB and cover validation, inactive registration, cookie login, mechanic denial of user administration, the job → parts → completion → payment path, cross-mechanic access, and server-side pagination.
