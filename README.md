# Dining Management Server

The backend API for the Dining Management application. It provides the Express API used by the [frontend](https://github.com/sami157/dining-management), verifies Firebase users, stores application data in MongoDB, and handles meal and financial calculations.

## Features

- Firebase ID-token authentication and role-based authorization
- User profiles, roles, activation status, and meal preferences
- Meal schedule generation and management
- Meal registration, cancellation, quantity updates, bulk registration, and comments
- Deposits, expenses, member balances, and meal-rate calculations
- Monthly financial finalization and balance restoration when a finalization is undone
- Temporary administrator-created password recovery codes
- MongoDB indexes and database maintenance scripts

## Technology

- Node.js
- Express 5
- MongoDB Node.js driver
- Firebase Admin SDK
- Luxon and date-fns
- CommonJS modules

## Project structure

```text
.
├── config/       MongoDB and Firebase Admin configuration
├── middleware/   Firebase token and role middleware
├── modules/      Auth, users, managers, finance, and stats modules
├── scripts/      Index, backup, and data migration scripts
├── index.js      Express application entry point
└── reference.md  Detailed API integration reference
```

## API route groups

| Prefix | Purpose |
| --- | --- |
| `/users` | Profiles, roles, user management, and meal registrations |
| `/managers` | Meal schedule generation, updates, and registration reports |
| `/finance` | Deposits, expenses, balances, and monthly finalization |
| `/auth` | Administrator recovery-code creation and password recovery |
| `/stats` | Running meal-rate calculations |

The health endpoint is `GET /` and returns a welcome message.

For the complete endpoint list, request formats, response shapes, roles, date formats, and meal deadlines, see [reference.md](./reference.md).

## Authentication

Authenticated requests must include a Firebase ID token:

```http
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

The authentication middleware verifies the token, finds the corresponding active MongoDB user by email, attaches that user to `req.user`, and checks the required role when applicable.

Available roles are:

```text
admin, manager, member, moderator, staff, super_admin
```

Meal deadlines use the `Asia/Dhaka` timezone by default. A schedule can override the default deadline for an individual meal.

## Database

The server connects to MongoDB database `diningManagementDB` and uses these collections:

```text
users
mealSchedules
mealRegistrations
payments
deposits
expenses
memberBalances
monthlyFinalization
systemLogs
passwordRecoveryCodes
```

Monthly finalization calculates meal costs and the meal rate, applies mosque fees, updates member balances, and stores an audit record. Finalization requires an open month and uses a MongoDB transaction. The undo endpoint restores the recorded previous balances and removes the finalization record, provided no later month has already been finalized.

## Prerequisites

- Node.js 18 or newer
- npm
- A MongoDB deployment
- A Firebase project with a service account

## Environment variables

Create a `.env` file in this directory:

```env
PORT=5000
MONGODB_URI=your-mongodb-connection-string
FB_SERVICE_KEY=base64-encoded-firebase-service-account-json
```

`FB_SERVICE_KEY` must contain the Base64-encoded JSON service-account credentials expected by `config/firebaseAdmin.js`. Keep `.env` and `key.json` private; both are excluded by `.gitignore`.

## Getting started

Install dependencies and start the API:

```bash
npm install
node index.js
```

For development with automatic restarts:

```bash
npx nodemon index.js
```

By default, the server listens on `http://localhost:5000`.

## Available scripts

The package currently only contains the default placeholder test script:

```bash
npm test
```

There are no automated tests configured yet. Use `node index.js` or `npx nodemon index.js` to run the server locally.

## Maintenance scripts

The `scripts/` directory contains utilities for:

- Creating MongoDB indexes
- Backing up the current database
- Backfilling user activation fields
- Backfilling finalized-month registration data

Review each script before running it against a production database.

## Deployment

The included `vercel.json` configures the server as a Vercel Node function using `index.js`. Configure `PORT`, `MONGODB_URI`, and `FB_SERVICE_KEY` as deployment environment variables.

## Related frontend

The frontend is a React/Vite application that consumes this API. Its local development project is located alongside this server, and its README contains the frontend setup and route overview.
