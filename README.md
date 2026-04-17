# Gen-Mumins

Gen-Mumins is being rebuilt as a production LMS for Islamic children's education on top of `Next.js`, `TypeScript`, and `MySQL`.

## Current Scope

- Marketing site and homepage design are already present.
- LMS foundation has now been scaffolded for:
  - MySQL with Prisma
  - role-based user model
  - parent, student, teacher, and admin dashboard entry points
  - session table and shared auth utilities
  - enrollments, schedules, assessments, payments, journals, and scholarship-ready schema

## Tech Direction

- Frontend: Next.js App Router, React, Tailwind CSS
- Database: MySQL
- ORM: Prisma
- Auth direction: database-backed sessions with role-aware dashboards
- Payments planned: Stripe, PayPal, NayaPay, bank transfer
- Infra target: separate Gen-Mumins deployment from the main TGA website

## Local Setup

1. Copy `.env.example` to `.env.local` and fill in values.
2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Create the first migration after your database is connected:

```bash
npm run prisma:migrate:dev -- --name init_lms_foundation
```

5. Start the app:

```bash
npm run dev
```

## Important Environment Variables

- `DATABASE_URL`
- `APP_URL`
- `AUTH_SESSION_SECRET`
- `AUTH_COOKIE_NAME`
- payment keys for Stripe / PayPal / NayaPay
- email provider credentials
- Zoom credentials

## Initial Route Map

- `/` marketing homepage
- `/registration` public enrollment placeholder
- `/auth/login`
- `/auth/signup`
- `/admin`
- `/teacher`
- `/parent`
- `/student`

## Recommended Delivery Plan

1. Finish marketing and registration UX.
2. Implement real auth and session creation.
3. Add seed data for roles, programs, and demo users.
4. Build parent enrollment and student profile workflows.
5. Build admin and teacher operations.
6. Add payments, subscriptions, reminders, and Zoom integration.

## Database Recommendation

Gen-Mumins can share the same DigitalOcean MySQL cluster as TGA if it uses a separate database name and a separate database user. Do not mix Gen-Mumins tables into the existing TGA database. A separate cluster is still the long-term best option once LMS traffic, payments, and reporting grow.
