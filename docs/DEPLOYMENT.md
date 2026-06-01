# DRRCS Deployment Guide

## Docker Compose

```bash
cp .env.example .env
docker-compose up --build
```

The backend container runs Prisma migrations and seed data before starting the API.

## Production Checklist

- Replace `JWT_SECRET` with a long random value.
- Set `CORS_ORIGIN` to the deployed frontend origin.
- Configure SMTP variables for real email alerts.
- Replace `sendSms` in `backend/src/services/sms.service.ts` with Twilio, SNS, or another gateway.
- Put frontend and backend behind HTTPS.
- Restrict database access to the application network.
- Configure external backups for PostgreSQL.

## Manual Migration

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run build
npm run start
```

