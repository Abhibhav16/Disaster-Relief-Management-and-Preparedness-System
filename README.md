# Disaster Relief & Resource Coordination System (DRRCS)

DRRCS is a full-stack disaster response coordination platform for authorities, NGOs, volunteers, and affected individuals.

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript, Prisma
- Database: PostgreSQL
- Auth: JWT, bcrypt, role-based access control
- Realtime: Socket.io
- Docs: Swagger
- Deployment: Docker Compose

## Quick Start

```bash
cp .env.example .env
docker-compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Swagger Docs: http://localhost:4000/api-docs
- PostgreSQL: localhost:5432

Seed login accounts all use password `Password123!`.

- Admin: `admin@drrcs.local`
- Authority: `authority@drrcs.local`
- NGO: `ngo@drrcs.local`
- Volunteer: `volunteer@drrcs.local`
- Individual: `citizen@drrcs.local`

## Local Development

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Deployment Notes

1. Set strong secrets in `.env`, especially `JWT_SECRET`.
2. Configure SMTP settings for email delivery.
3. Replace SMS placeholder implementation in `backend/src/services/sms.service.ts`.
4. Put the API behind HTTPS and a reverse proxy.
5. Run migrations before starting API containers:

```bash
cd backend
npm run prisma:migrate
```

## Project Structure

```text
backend/      Express API, Prisma schema, seed data, Swagger
frontend/     Next.js dashboard and public pages
docker-compose.yml
.env.example
```

