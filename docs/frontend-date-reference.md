# Frontend Integration Reference

## Purpose

This document is the frontend-facing API contract for the current backend.

It covers:
- base routing structure
- auth expectations
- request validation behavior
- date and time rules
- endpoint-by-endpoint request shapes
- migration guidance for the future canonical date model

Business timezone:
- `Asia/Dhaka`

Backend stack assumptions:
- TypeScript source
- route-level Zod validation
- modular Express routers
- shared global error handler

## Base Structure

Root route prefixes currently mounted by the backend:
- `/users`
- `/meals`
- `/users/meals`
- `/meal-schedules`
- `/managers`
- `/finance`
- `/meal-deadlines`

Special note:
- `/managers` and `/meal-schedules` currently point to the same router.
- `/users/meals` and `/meals` currently point to the same router.

Health route:
- `GET /`

## Auth Contract

Protected routes require:
- `Authorization: Bearer <firebase_id_token>`

Current backend auth behavior:
- token verification is handled by Firebase Admin
- route authorization is role-based where configured
- authenticated Mongo user is attached to the request as `req.user`

Known roles currently used by validation/business logic:
- `admin`
- `manager`
- `member`
- `moderator`
- `staff`
- `super_admin`

Frontend rule:
- always send the Firebase ID token on protected routes
- do not rely on frontend role checks as the source of truth

## Validation and Error Contract

### Validation errors

Route-level validation uses Zod.

Validation failure response format:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "fieldName",
      "message": "Validation message"
    }
  ]
}
```

### General error shape

The backend global error shape is:

```json
{
  "error": "Human readable message",
  "code": "OPTIONAL_MACHINE_CODE",
  "details": "OPTIONAL_EXTRA_DETAILS"
}
```

Frontend rule:
- always read `error`
- optionally consume `details`
- do not assume every error has `code`

## Date and Time Rules

### Business dates

For business-day input, the frontend should send:
- `YYYY-MM-DD`

Examples:
- `2026-04-06`
- `2026-05-01`

### Months

For month-based input, send:
- `YYYY-MM`

Examples:
- `2026-04`
- `2026-05`

### Do not send for business-day fields

Do not send:
- browser-local formatted dates
- locale strings
- arbitrary ISO timestamps where the API expects a business day

### Deadline enforcement

Deadline checks must be treated as backend-authoritative.

Frontend may show:
- countdowns
- disabled UI states
- warnings

But the backend remains the source of truth.

## Request and Response Notes

This section documents the current validated request contracts. Response bodies are described at a practical level, based on current controllers/services.

## Users Module

Base path:
- `/users`

### `POST /users/create`

Auth:
- required

Body:

```ts
{
  name: string
  building?: string
  room?: string
  email?: string
  mobile: string
  designation?: string
  bank?: unknown
  department?: string
}
```

Notes:
- `email`, if supplied, must be a valid email
- backend syncs with authenticated Firebase user

Typical response:

```ts
{
  message: string
  userId: string
  user: object
}
```

### `GET /users/profile`

Auth:
- required

Response:

```ts
{
  user: object
}
```

### `PUT /users/profile`

Auth:
- required

Body:

```ts
{
  name?: string
  building?: string
  room?: string
  mobile?: string
  designation?: string
  department?: string
}
```

Validation:
- at least one field is required

Response:

```ts
{
  message: "Profile updated successfully"
  user: object
}
```

### `PUT /users/role/:userId`

Auth:
- required
- allowed roles at route layer: `admin | manager | super_admin`

Params:

```ts
{
  userId: string // ObjectId
}
```

Body:

```ts
{
  role: "admin" | "manager" | "member" | "moderator" | "staff" | "super_admin"
}
```

### `PUT /users/fixedDeposit/:userId`

Auth:
- required
- allowed roles: `admin | super_admin`

Body:

```ts
{
  fixedDeposit: number
}
```

Rule:
- must be non-negative

### `PUT /users/mosqueFee/:userId`

Auth:
- required
- allowed roles: `admin | super_admin`

Body:

```ts
{
  mosqueFee: number
}
```

Rule:
- must be non-negative

### `GET /users`

Auth:
- not currently required

Query:

```ts
{
  role?: "admin" | "manager" | "member" | "moderator" | "staff" | "super_admin"
  department?: string
}
```

### `GET /users/get-role/:email`

Params:

```ts
{
  email: string
}
```

Response:

```ts
{
  role: string
}
```

### `GET /users/check-user/:email`

Params:

```ts
{
  email: string
}
```

Response:

```ts
{
  doesExist: boolean
}
```

## Meals Module

Base paths:
- `/meals`
- `/users/meals`

### `GET /meals/available`

Auth:
- required

Query:

```ts
{
  month?: string // YYYY-MM
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
}
```

Rules:
- either `month`
- or both `startDate` and `endDate`
- not both models at the same time

### `POST /meals/register`

Auth:
- required

Body:

```ts
{
  date: string // YYYY-MM-DD
  mealType: "morning" | "evening" | "night"
  userId?: string // ObjectId, only for admin/super_admin flows
  numberOfMeals?: number
}
```

### `POST /meals/bulk-register`

Auth:
- required

Query:

```ts
{
  month: string // YYYY-MM
}
```

### `PATCH /meals/register/:registrationId`

Auth:
- required

Params:

```ts
{
  registrationId: string // ObjectId
}
```

Body:

```ts
{
  numberOfMeals: number
}
```

### `DELETE /meals/register/cancel/:registrationId`

Auth:
- required

Params:

```ts
{
  registrationId: string // ObjectId
}
```

### `GET /meals/total/:email`

Auth:
- required

Params:

```ts
{
  email: string
}
```

Query:

```ts
{
  month?: string // YYYY-MM
}
```

## Meal Schedules Module

Base paths:
- `/meal-schedules`
- `/managers`

### `POST /meal-schedules/schedules/generate`

Auth:
- required
- allowed roles: `admin | super_admin`

Body:

```ts
{
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}
```

### `GET /meal-schedules/schedules`

Auth:
- required

Query:

```ts
{
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}
```

### `PUT /meal-schedules/schedules/:scheduleId`

Auth:
- required
- allowed roles: `admin | super_admin`

Params:

```ts
{
  scheduleId: string // ObjectId
}
```

Body:

```ts
{
  isHoliday?: boolean
  availableMeals?: Array<{
    mealType: "morning" | "evening" | "night"
    isAvailable: boolean
    customDeadline?: string | null // ISO datetime string
    weight?: number
    menu?: string
  }>
}
```

Validation:
- at least one of `isHoliday` or `availableMeals` is required

### `DELETE /meal-schedules/schedules/:scheduleId`

Auth:
- required
- allowed roles: `admin | super_admin`

### `GET /meal-schedules/registrations`

Auth:
- not currently required

Query:

```ts
{
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}
```

## Meal Deadlines Module

Base path:
- `/meal-deadlines`

### `GET /meal-deadlines`

Auth:
- required

### `PUT /meal-deadlines`

Auth:
- required
- allowed roles: `admin | super_admin`

Body:

```ts
{
  morning: { hour: number; minute: number; dayOffset: number }
  evening: { hour: number; minute: number; dayOffset: number }
  night: { hour: number; minute: number; dayOffset: number }
}
```

Rules:
- `hour`: integer `0..23`
- `minute`: integer `0..59`
- `dayOffset`: integer

## Finance Module

Base path:
- `/finance`

### Balances

#### `GET /finance/balances`

Auth:
- not currently required

#### `GET /finance/balances/:userId`

Params:

```ts
{
  userId: string // ObjectId
}
```

#### `GET /finance/my-balance`

Auth:
- required

### Deposits

#### `POST /finance/deposits/add`

Auth:
- required
- allowed roles: `admin | super_admin`

Body:

```ts
{
  userId: string // ObjectId
  amount: number
  month: string // YYYY-MM
  depositDate?: string // YYYY-MM-DD
  notes?: string
}
```

Rules:
- `amount` must be positive

#### `GET /finance/deposits`

Auth:
- required

Query:

```ts
{
  month?: string // YYYY-MM
  userId?: string // ObjectId
}
```

#### `GET /finance/user-deposit`

Auth:
- required

Query:

```ts
{
  month: string // YYYY-MM
}
```

#### `PUT /finance/deposits/:depositId`

Auth:
- required
- allowed roles: `admin | super_admin`

Params:

```ts
{
  depositId: string // ObjectId
}
```

Body:

```ts
{
  amount?: number
  month?: string // YYYY-MM
  depositDate?: string // YYYY-MM-DD
  notes?: string
}
```

Validation:
- at least one field required

#### `DELETE /finance/deposits/:depositId`

Auth:
- required
- allowed roles: `admin | super_admin`

### Expenses

#### `POST /finance/expenses/add`

Auth:
- required
- allowed roles: `admin | super_admin`

Body:

```ts
{
  date: string // YYYY-MM-DD
  category: string
  amount: number
  description?: string
  person?: string
}
```

Rules:
- `category` required
- `amount` positive

#### `GET /finance/expenses`

Auth:
- required

Query:

```ts
{
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  category?: string
}
```

Rules:
- `startDate` and `endDate` must be provided together if either is used

#### `PUT /finance/expenses/:expenseId`

Auth:
- required
- allowed roles: `admin | super_admin`

Params:

```ts
{
  expenseId: string // ObjectId
}
```

Body:

```ts
{
  date?: string // YYYY-MM-DD
  category?: string
  amount?: number
  description?: string
  person?: string
}
```

Validation:
- at least one field required

#### `DELETE /finance/expenses/:expenseId`

Auth:
- required
- allowed roles: `admin | super_admin`

### Finalization

#### `POST /finance/finalize`

Auth:
- required
- allowed roles: `admin | super_admin`

Body:

```ts
{
  month: string // YYYY-MM
}
```

#### `GET /finance/finalization/:month`

Auth:
- required

Params:

```ts
{
  month: string // YYYY-MM
}
```

#### `GET /finance/user-finalization`

Auth:
- required

Query:

```ts
{
  month: string // YYYY-MM
}
```

#### `GET /finance/finalizations`

Auth:
- required

#### `DELETE /finance/finalization/:month`

Auth:
- required
- allowed roles: `admin | super_admin`

Params:

```ts
{
  month: string // YYYY-MM
}
```

### Stats

#### `GET /finance/meal-rate`

Auth:
- required

Query:

```ts
{
  month: string // YYYY-MM
  date?: string // YYYY-MM-DD
}
```

Behavior:
- if the month is finalized, backend returns finalized month meal rate
- if not finalized, backend calculates running meal rate up to the passed `date` or current day

## Frontend Type Recommendations

The frontend should create typed API DTOs that mirror the validated backend inputs.

Recommended categories:
- `UsersApi`
- `MealsApi`
- `MealSchedulesApi`
- `MealDeadlinesApi`
- `FinanceBalancesApi`
- `FinanceDepositsApi`
- `FinanceExpensesApi`
- `FinanceFinalizationApi`
- `FinanceStatsApi`

### Suggested DTO examples

```ts
type BusinessDate = string // YYYY-MM-DD
type ServiceMonth = string // YYYY-MM
type ObjectIdString = string

type MealType = "morning" | "evening" | "night"
type UserRole = "admin" | "manager" | "member" | "moderator" | "staff" | "super_admin"
```

## Canonical Date Migration Guidance

As the backend date migration progresses, the frontend should prefer canonical fields when they become available.

Prefer these fields when present:
- `serviceDate`
- `createdDate`
- `updatedDate`
- `finalizedDate`
- `month`

Legacy fields may still appear during transition:
- `date`
- `depositDate`
- `createdAt`
- `updatedAt`

Frontend rule:
- if a canonical business-date field exists, use it
- treat legacy timestamp/date fields as compatibility fields

## Safe Frontend Migration Order

### Phase 1
- keep existing integration
- begin accepting canonical response fields when backend starts returning them

### Phase 2
- ensure all business-date requests send `YYYY-MM-DD`
- ensure all month requests send `YYYY-MM`

### Phase 3
- switch UI rendering to canonical business-date fields

### Phase 4
- remove browser-local date assumptions and legacy field dependence

## Anti-Patterns to Avoid

Do not:
- use browser-local `Date` parsing as the business truth for API day fields
- send ISO timestamps for routes expecting `YYYY-MM-DD`
- use client time as the final authority for deadlines
- assume old `date` fields will remain the long-term canonical model

## Minimal Integration Rules

Frontend should:
- send `Authorization: Bearer <token>` for protected routes
- send `YYYY-MM-DD` for day fields
- send `YYYY-MM` for month fields
- handle `Validation failed` error responses with `details`
- prefer canonical business-date response fields when available

Backend remains authoritative for:
- role checks
- deadline enforcement
- Dhaka timezone interpretation
- month boundary logic
