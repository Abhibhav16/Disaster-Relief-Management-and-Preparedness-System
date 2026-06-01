# DRRCS API Summary

Base URL: `http://localhost:4000`

Swagger UI: `http://localhost:4000/api-docs`

## Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

All protected routes use:

```http
Authorization: Bearer <jwt>
```

## Disaster Management

- `GET /api/disasters`
- `POST /api/disasters`
- `GET /api/disasters/:id`
- `PUT /api/disasters/:id`
- `PATCH /api/disasters/:id/status`
- `DELETE /api/disasters/:id`

## Emergency Requests

- `GET /api/requests`
- `POST /api/requests`
- `PATCH /api/requests/:id/status`

Workflow statuses:

`PENDING -> ASSIGNED -> IN_PROGRESS -> RESOLVED`

## Resources

- `GET /api/resources`
- `POST /api/resources`
- `PUT /api/resources/:id`
- `DELETE /api/resources/:id`

## Shelters

- `GET /api/shelters`
- `GET /api/shelters/nearby?latitude=19.076&longitude=72.8777`
- `POST /api/shelters`
- `PUT /api/shelters/:id`
- `DELETE /api/shelters/:id`

## Volunteers and Tasks

- `GET /api/volunteers`
- `POST /api/volunteers`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id/status`

## Notifications, Analytics, Reports

- `GET /api/notifications`
- `POST /api/notifications/broadcast`
- `GET /api/analytics`
- `GET /api/reports/export.csv`
- `GET /api/reports/export.pdf`
- `GET /api/audit-logs`
