# Dining Management Server API Guide for Next.js Frontend

## Overview

This document is the frontend implementation guide for the current backend in [`index.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/index.ts).

It is based on the mounted routers, Zod validators, controllers, and service behavior in the codebase.

Business timezone:
- `Asia/Dhaka`

Auth provider:
- Firebase ID token in `Authorization: Bearer <token>`

Root route groups:
- `/users`
- `/meals`
- `/users/meals` (alias of `/meals`)
- `/meal-schedules`
- `/managers` (alias of `/meal-schedules`)
- `/meal-deadlines`
- `/finance`

Health check:
- `GET /`

## Recommended Next.js Setup

Use these environment variables in your frontend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Recommended client helper:

```ts
type ApiError = {
  error: string
  code?: string
  details?: unknown
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null
    throw new Error(error?.error || "Request failed")
  }

  return response.json() as Promise<T>
}
```

Recommended Firebase token pattern:

```ts
const token = await currentUser.getIdToken()
const profile = await apiFetch("/users/profile", { token })
```

## Auth and Roles

Token verification is enforced in [`middleware/verifyFirebaseToken.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/middleware/verifyFirebaseToken.ts).

Protected routes require:

```http
Authorization: Bearer <firebase_id_token>
```

Known roles from [`modules/shared/validation.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/shared/validation.ts):
- `admin`
- `manager`
- `member`
- `moderator`
- `staff`
- `super_admin`

Important role policies from [`modules/shared/authorization.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/shared/authorization.ts):
- Meal schedule management: `admin`, `super_admin`
- Meal deadline management: `admin`, `super_admin`
- Deposit management: `admin`, `super_admin`
- Expense management: `admin`, `super_admin`
- Member finance management: `admin`, `super_admin`
- Month finalization management: `admin`, `super_admin`
- Meal registration override for other users: `admin`, `super_admin`

Frontend rule:
- always send the Firebase token for any non-public route
- treat backend role checks as authoritative
- use role data only to shape UI visibility

## Global Request Rules

### Dates

Canonical business-date fields use:
- `YYYY-MM-DD`

Examples:
- `2026-04-07`
- `2026-04-30`

Month fields use:
- `YYYY-MM`

Examples:
- `2026-04`
- `2026-12`

Do not send locale strings like:
- `4/7/2026`
- `07-04-2026`

Do not send arbitrary timestamps where the API expects a business date.

### Timezone

Business date calculations are normalized in [`modules/shared/date.utils.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/shared/date.utils.ts).

Frontend implications:
- use `serviceDate` as the stable business-day key
- display stored `Date` values only after understanding they are UTC-backed
- for filters and form submission, send `serviceDate` strings, not browser-local date strings

### Validation Errors

Validation uses route-level Zod schemas.

Typical validation response:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "month",
      "message": "month must be in YYYY-MM format (e.g., 2025-01)"
    }
  ]
}
```

### General Error Shape

Global error output from [`middleware/errorHandler.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/middleware/errorHandler.ts):

```json
{
  "error": "Human readable message",
  "code": "OPTIONAL_MACHINE_CODE",
  "details": "OPTIONAL_EXTRA_DETAILS"
}
```

Auth-specific codes you should expect:
- `AUTH_MISSING_TOKEN`
- `AUTH_INVALID_AUTH_HEADER`
- `AUTH_INVALID_TOKEN`
- `AUTH_APP_USER_NOT_FOUND`
- `AUTH_ROLE_FORBIDDEN`

## Shared Frontend Types

Useful baseline types for the frontend:

```ts
export type UserRole =
  | "admin"
  | "manager"
  | "member"
  | "moderator"
  | "staff"
  | "super_admin"

export type MealType = "morning" | "evening" | "night"

export type ApiListResponse<T> = {
  count: number
} & T

export type UserProfile = {
  _id: string
  firebaseUid?: string
  email?: string
  emailVerified?: boolean
  displayName?: string
  phoneNumber?: string
  photoURL?: string
  providers?: string[]
  name?: string
  building?: string
  room?: string
  mobile?: string
  bank?: unknown
  designation?: string
  department?: string
  role?: UserRole
  mealDefault?: boolean
  fixedDeposit?: number
  mosqueFee?: number
  createdAt?: string
  updatedAt?: string
  lastSyncedAt?: string
}
```

## Endpoint Reference

## Users API

Base path:
- `/users`

### `POST /users/create`

Auth:
- required
- valid Firebase user required
- app user may be missing before creation

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
  mealDefault?: boolean
}
```

Notes:
- if `email` is provided, it must match the authenticated Firebase token email
- creates a new app user or syncs an existing one
- new users are created with role `member`

Response:

```ts
{
  message: "User registered and synced successfully" | "User synced successfully"
  userId: string
  user: {
    _id: string
    firebaseUid?: string
    email?: string
    emailVerified?: boolean
    displayName?: string
    phoneNumber?: string
    photoURL?: string
    providers?: string[]
    name?: string
    building?: string
    room?: string
    mobile?: string
    bank?: unknown
    designation?: string
    department?: string
    role?: UserRole
    mealDefault?: boolean
    fixedDeposit?: number
    mosqueFee?: number
    createdAt?: string
    updatedAt?: string
    lastSyncedAt?: string
  }
}
```

### `GET /users/profile`

Auth:
- required

Response:

```ts
{
  user: UserProfile
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
  mealDefault?: boolean
}
```

Validation:
- at least one field is required

Response:

```ts
{
  message: "Profile updated successfully"
  user: UserProfile
}
```

### `GET /users/admins`

Auth:
- required

Response:

```ts
{
  count: number
  admins: Array<{
    _id: string
    name?: string
    email?: string
    role?: "admin" | "super_admin"
    designation?: string
    department?: string
    photoURL?: string
  }>
}
```

### `GET /users`

Auth:
- required

Query:

```ts
{
  role?: UserRole
  department?: string
}
```

Response:

```ts
{
  count: number
  totalFixedDeposit: number
  users: UserProfile[]
}
```

Notes:
- no pagination
- sorted by `room`

### `PUT /users/role/:userId`

Auth:
- required
- role: `admin` or `super_admin`

Params:

```ts
{ userId: string }
```

Body:

```ts
{ role: UserRole }
```

Response:

```ts
{
  message: "User role updated successfully"
  user: UserProfile
}
```

Important behavior:
- users cannot change their own role

### `PUT /users/fixedDeposit/:userId`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{ fixedDeposit: number }
```

Response:

```ts
{
  message: "Fixed Deposit Amount updated successfully"
  user: UserProfile
}
```

### `PUT /users/mosqueFee/:userId`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{ mosqueFee: number }
```

Response:

```ts
{
  message: "Mosque Fee updated successfully"
  user: UserProfile
}
```

### `GET /users/get-role/:email`

Auth:
- required
- valid Firebase token required
- app user may be missing

Response:

```ts
{ role: UserRole }
```

### `GET /users/check-user/:email`

Auth:
- required
- valid Firebase token required
- app user may be missing

Response:

```ts
{ doesExist: boolean }
```

## Meals API

Base paths:
- `/meals`
- `/users/meals` (same router)

### `GET /meals/available`

Auth:
- required

Query:

```ts
{
  month?: string
  startDate?: string
  endDate?: string
}
```

Validation:
- send either `month`
- or both `startDate` and `endDate`
- do not send month and range together

Response:

```ts
{
  count: number
  schedules: Array<{
    date: string
    serviceDate: string
    isHoliday: boolean
    meals: Array<{
      mealType: MealType
      isAvailable: boolean
      menu: string
      weight: number
      deadline: string
      canRegister: boolean
      isRegistered: boolean
      registrationId: string | null
      numberOfMeals: number | null
    }>
  }>
}
```

Frontend note:
- render registration controls from `canRegister`
- use `deadline` for countdowns, but backend still decides

### `POST /meals/register`

Auth:
- required

Body:

```ts
{
  date: string
  mealType: MealType
  userId?: string
  numberOfMeals?: number
}
```

Notes:
- `userId` is only allowed for `admin` or `super_admin`
- without `userId`, the backend enforces registration deadline
- default `numberOfMeals` is `1`

Response:

```ts
{
  message: "Meal registered successfully"
  registrationId: string
  registration: {
    _id: string
    userId: string
    date: string
    serviceDate: string
    mealType: MealType
    numberOfMeals: number
    registeredAt: string
  }
}
```

### `POST /meals/bulk-register?month=YYYY-MM`

Auth:
- required

Important:
- this is a `POST`
- `month` is sent in the query string, not the body

Response:

```ts
{
  message: string
  registeredCount: number
}
```

Possible messages:
- `No available meals to register for`
- `Successfully registered for X meals`

### `PATCH /meals/register/:registrationId`

Auth:
- required

Body:

```ts
{ numberOfMeals: number }
```

Response:

```ts
{
  message: "Registration updated successfully"
}
```

Notes:
- owners can update their own registration before deadline
- `admin` and `super_admin` can update regardless of ownership

### `DELETE /meals/register/cancel/:registrationId`

Auth:
- required

Response:

```ts
{
  message: "Meal registration cancelled successfully"
}
```

Notes:
- same ownership and privilege rules as update

### `GET /meals/total/:email`

Auth:
- required

Params:

```ts
{ email: string }
```

Query:

```ts
{ month?: string }
```

Response:

```ts
{
  userId: string
  userName?: string
  email?: string
  month: string
  totalMeals: number
  mealCount: number
  breakdown: {
    morning: number
    evening: number
    night: number
  }
  registrations: number
}
```

Notes:
- if `month` is omitted, backend uses the current business month
- weighted meal totals depend on schedule meal weights

## Meal Schedules API

Base paths:
- `/meal-schedules`
- `/managers` (same router)

### `POST /meal-schedules/schedules/generate`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{
  startDate: string
  endDate: string
}
```

Rules:
- max range is 90 days
- creates only missing schedules
- auto-creates default registrations for users with `mealDefault: true`

Response:

```ts
{
  message: string
  count: number
  registrationsCreated?: number
}
```

### `GET /meal-schedules/schedules`

Auth:
- required

Query:

```ts
{
  startDate: string
  endDate: string
}
```

Response:

```ts
{
  count: number
  schedules: Array<{
    _id: string
    date: string
    serviceDate: string
    isHoliday: boolean
    availableMeals: Array<{
      mealType: MealType
      isAvailable: boolean
      customDeadline: string | null
      weight: number
      menu: string
    }>
    createdBy?: string
    createdAt?: string
    updatedAt?: string
  }>
}
```

### `PUT /meal-schedules/schedules/:scheduleId`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{
  isHoliday?: boolean
  availableMeals?: Array<{
    mealType: MealType
    isAvailable: boolean
    customDeadline?: string | null
    weight?: number
    menu?: string
  }>
}
```

Validation:
- at least one of `isHoliday` or `availableMeals` is required

Response:

```ts
{
  message: "Schedule and registrations updated successfully"
  schedule: {
    _id: string
    date: string
    serviceDate: string
    isHoliday: boolean
    availableMeals: Array<{
      mealType: MealType
      isAvailable: boolean
      customDeadline: string | null
      weight: number
      menu: string
    }>
    updatedAt?: string
  }
}
```

Important behavior:
- registrations for newly unavailable meals are deleted
- default-user registrations are auto-created for newly available meals
- unavailable meals are stored with `weight: 0`

### `DELETE /meal-schedules/schedules/:scheduleId`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  message: "Schedule deleted successfully"
  registrationsCleared: number
}
```

### `GET /meal-schedules/meal-sheet?date=YYYY-MM-DD`

Auth:
- required

Response:

```ts
{
  date: string
  nextDate: string
  count: 2
  records: Array<{
    serviceDate: string
    schedule: {
      _id: string
      date: string
      serviceDate: string
      isHoliday: boolean
      availableMeals: Array<{
        mealType: MealType
        isAvailable: boolean
        customDeadline: string | null
        weight: number
        menu: string
      }>
    } | null
    users: Array<{
      userId: string
      name?: string
      email?: string
      room?: string
      role?: UserRole
      mealDefault?: boolean
      registrations: Record<
        string,
        {
          registrationId: string | null
          isRegistered: boolean
          numberOfMeals: number
        }
      >
    }>
  }>
}
```

Notes:
- returns the requested day and the next day
- useful for meal-sheet and manager tables

### `GET /meal-schedules/registrations`

Auth:
- required

Query:

```ts
{
  startDate: string
  endDate: string
}
```

Response:

```ts
{
  count: number
  startDate: string
  endDate: string
  registrations: Array<{
    _id: string
    userId: string
    date: string
    serviceDate: string
    mealType: MealType
    numberOfMeals: number
    registeredAt: string
    updatedAt?: string
    user: {
      name?: string
      email?: string
    } | null
  }>
}
```

## Meal Deadlines API

Base path:
- `/meal-deadlines`

Default rules from [`modules/meal-deadlines/meal-deadlines.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/meal-deadlines/meal-deadlines.service.ts):
- `morning`: previous day `22:00`
- `evening`: same day `08:00`
- `night`: same day `14:00`

### `GET /meal-deadlines`

Auth:
- required

Response:

```ts
{
  mealDeadlines: {
    morning: { hour: number; minute: number; dayOffset: number }
    evening: { hour: number; minute: number; dayOffset: number }
    night: { hour: number; minute: number; dayOffset: number }
    updatedAt?: string
    updatedBy: string | null
  }
}
```

### `PUT /meal-deadlines`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{
  morning: { hour: number; minute: number; dayOffset: number }
  evening: { hour: number; minute: number; dayOffset: number }
  night: { hour: number; minute: number; dayOffset: number }
}
```

Response:

```ts
{
  message: "Meal deadlines updated successfully"
  mealDeadlines: {
    morning: { hour: number; minute: number; dayOffset: number }
    evening: { hour: number; minute: number; dayOffset: number }
    night: { hour: number; minute: number; dayOffset: number }
    updatedAt?: string
    updatedBy: string | null
  }
}
```

## Finance API

Base path:
- `/finance`

This group includes deposits, expenses, balances, finalization, and stats.

## Deposits

### `POST /finance/deposits/add`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{
  userId: string
  amount: number
  month: string
  depositDate?: string
  notes?: string
}
```

Behavior:
- updates member balance immediately
- blocked if the target month is already finalized
- `depositDate` defaults to current business date

Response:

```ts
{
  message: "Deposit added successfully"
  depositId: string
  deposit: {
    _id: string
    userId: string
    amount: number
    month: string
    depositDate: string
    serviceDate: string
    notes: string
    addedBy?: string
    createdAt: string
    createdDate: string
  }
}
```

### `GET /finance/deposits`

Auth:
- required
- role: `admin` or `super_admin`

Query:

```ts
{
  month?: string
  userId?: string
}
```

Response:

```ts
{
  count: number
  totalDeposit: number
  deposits: Array<{
    _id: string
    userId: string
    amount: number
    month: string
    depositDate: string
    serviceDate: string
    notes: string
    addedBy?: string
    createdAt: string
    createdDate: string
    updatedAt?: string
    userName?: string
    userEmail?: string
  }>
}
```

### `GET /finance/user-deposit?month=YYYY-MM`

Auth:
- required

Response:

```ts
{
  userId: string
  userName?: string
  email?: string
  month: string
  deposit: number
  lastUpdated: string | null
  lastUpdatedDate: string | null
}
```

### `PUT /finance/deposits/:depositId`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{
  amount?: number
  month?: string
  depositDate?: string
  notes?: string
}
```

Validation:
- at least one field is required

Response:

```ts
{
  message: "Deposit updated successfully"
}
```

Notes:
- if amount changes, member balance is adjusted by the difference
- cannot move into or edit a finalized month

### `DELETE /finance/deposits/:depositId`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  message: "Deposit deleted successfully"
}
```

## Expenses

### `POST /finance/expenses/add`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{
  date: string
  category: string
  amount: number
  description?: string
  person?: string
}
```

Response:

```ts
{
  message: "Expense added successfully"
  expenseId: string
  expense: {
    _id: string
    date: string
    serviceDate: string
    category: string
    amount: number
    description: string
    person: string
    addedBy?: string
    createdAt: string
    createdDate: string
    updatedAt: string
    updatedDate: string
  }
}
```

### `GET /finance/expenses`

Auth:
- required

Query:

```ts
{
  startDate?: string
  endDate?: string
  category?: string
}
```

Validation:
- if one of `startDate` or `endDate` is set, both are required

Response:

```ts
{
  count: number
  expenses: Array<{
    _id: string
    date: string
    serviceDate: string
    category: string
    amount: number
    description: string
    person: string
    addedBy?: string
    addedByName: string
    createdAt: string
    createdDate: string
    updatedAt: string
    updatedDate: string
  }>
}
```

### `PUT /finance/expenses/:expenseId`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{
  date?: string
  category?: string
  amount?: number
  description?: string
  person?: string
}
```

Response:

```ts
{
  message: "Expense updated successfully"
}
```

Notes:
- blocked if the expense month is finalized

### `DELETE /finance/expenses/:expenseId`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  message: "Expense deleted successfully"
}
```

## Balances

### `GET /finance/balances`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  count: number
  balances: Array<{
    userId: string
    userName: string
    email: string
    balance: number
    lastUpdated: string | null
  }>
}
```

### `GET /finance/balances/:userId`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  userId: string
  userName?: string
  email?: string
  balance: number
  lastUpdated: string | null
}
```

### `GET /finance/my-balance`

Auth:
- required

Response when balance record exists:

```ts
{
  userName: string
  email: string
  balance: string
  lastUpdated: string | null
}
```

Response when balance record does not exist yet:

```ts
{
  userId: string
  userName?: string
  email?: string
  balance: 0
  lastUpdated: null
}
```

Frontend note:
- normalize `balance` with `Number(response.balance)` because the API is inconsistent here

## Finalization

### `POST /finance/finalize`

Auth:
- required
- role: `admin` or `super_admin`

Body:

```ts
{ month: string }
```

Behavior:
- computes meal rate from that month's expenses and weighted meals
- creates month summary
- rewrites member balances to the finalized closing balances
- cannot run twice for the same month

Response:

```ts
{
  message: "Month finalized successfully"
  finalizationId: string
  summary: {
    month: string
    totalMembers: number
    totalMealsServed: number
    totalDeposits: number
    totalExpenses: number
    mealRate: number
  }
}
```

### `GET /finance/finalization/:month`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  finalization: {
    _id: string
    month: string
    finalizedAt: string
    finalizedDate: string
    finalizedBy?: string
    totalMembers: number
    totalMealsServed: number
    totalDeposits: number
    totalExpenses: number
    mealRate: number
    memberDetails: Array<{
      userId: string
      userName: string
      totalMeals: number
      totalDeposits: number
      mealCost: number
      mosqueFee: number
      previousBalance: number
      newBalance: number
      status: "paid" | "due" | "advance"
    }>
    expenseBreakdown: Array<{
      category: string
      amount: number
    }>
    isFinalized: boolean
    notes: string
  }
}
```

### `GET /finance/finalizations`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  count: number
  finalizations: Array<{
    _id: string
    month: string
    finalizedAt: string
    finalizedDate: string
    totalMembers: number
    totalMealsServed: number
    totalDeposits: number
    totalExpenses: number
    mealRate: number
    isFinalized: boolean
  }>
}
```

### `DELETE /finance/finalization/:month`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  message: string
  restoredMembers: number
}
```

Important behavior:
- cannot undo a month if any later month is already finalized

## Stats and Dashboard

All routes below live under `/finance`.

### `GET /finance/all-time-summary`

Auth:
- required

Response:

```ts
{
  totalMealsServed: number
  totalRegistrations: number
  totalRegisteredUsers: number
  totalUsers: number
  activeUsers: number
  totalDeposits: number
  totalExpenses: number
  averageDepositPerUser: number
  finalizedMonths: number
  schedulesCount: number
  topDepositors: Array<{
    userId: string
    userName?: string
    email?: string
    room?: string
    total: number
  }>
  topConsumers: Array<{
    userId: string
    userName?: string
    email?: string
    room?: string
    total: number
  }>
  mealTypeBreakdown: {
    morning: number
    evening: number
    night: number
  }
}
```

### `GET /finance/dashboard?month=YYYY-MM`

Auth:
- required

Response:

```ts
{
  month: string
  finalized: boolean
  user: {
    userId: string
    name?: string
    email?: string
    role?: UserRole
    mosqueFee: number
    fixedDeposit: number
  }
  monthData: {
    weightedMeals: number
    mealsConsumed: number
    totalDeposit: number
  }
  balance: {
    current: number
    projected: number
  }
  projection: {
    averageMealRate: number
    sourceMonths: string[]
    projectedMealCost: number
    projectedMosqueFee: number
  }
  finalization:
    | null
    | {
        finalizedAt: string
        finalizedDate: string
        mealRate: number
        totalMealsServed: number
        totalExpenses: number
        user: {
          userId: string
          userName: string
          totalMeals: number
          totalDeposits: number
          mealCost: number
          mosqueFee: number
          previousBalance: number
          newBalance: number
          status: "paid" | "due" | "advance"
        }
      }
}
```

Notes:
- if the month is finalized, `projected` equals finalized balance
- if not finalized, projection uses average meal rate from recent finalized months

### `GET /finance/month-summary?month=YYYY-MM`

Auth:
- required

Response:

```ts
{
  month: string
  finalized: boolean
  totalMealsServed: number
  totalExpenses: number
  totalDeposits: number
  mealRate: number
  totalMembers: number
}
```

### `GET /finance/meal-trend?month=YYYY-MM`

Auth:
- required

Response:

```ts
{
  month: string
  count: number
  records: Array<{
    serviceDate: string
    totalMeals: number
    morning: number
    evening: number
    night: number
  }>
}
```

### `GET /finance/meal-type-breakdown?month=YYYY-MM`

Auth:
- required

Response:

```ts
{
  month: string
  totalMeals: number
  breakdown: {
    morning: { total: number; percentage: number }
    evening: { total: number; percentage: number }
    night: { total: number; percentage: number }
  }
}
```

### `GET /finance/two-day-sheet-summary?date=YYYY-MM-DD`

Auth:
- required

Response:

```ts
{
  date: string
  nextDate: string
  count: 2
  records: Array<{
    serviceDate: string
    scheduleExists: boolean
    isHoliday: boolean
    availableMeals: MealType[]
    totalRegisteredUsers: number
    totalRegistrations: number
    mealTypes: Record<
      MealType,
      {
        registeredUsers: number
        totalMeals: number
      }
    >
  }>
}
```

### `GET /finance/meal-rate?month=YYYY-MM&date=YYYY-MM-DD`

Auth:
- required

Query:

```ts
{
  month: string
  date?: string
}
```

Response:

```ts
{
  month: string
  asOf: string
  totalMealsServed: number
  totalExpenses: number
  mealRate: number
}
```

Notes:
- if the month is finalized, `asOf` becomes the month end
- otherwise it calculates up to the provided date, or current business date

## Frontend Implementation Notes

### 1. Normalize numeric edge cases

Handle a few inconsistent response values defensively:
- `GET /finance/my-balance` may return `balance` as a string
- weighted meal totals can be decimals because morning meal weight defaults to `0.5`

Recommended:

```ts
const balance = Number(data.balance ?? 0)
```

### 2. Prefer `serviceDate` over raw `date`

When rendering tables, storing cache keys, or routing between screens:
- use `serviceDate`

Treat raw `date` fields as backend storage artifacts.

### 3. Expect no pagination

Most list endpoints currently return full arrays:
- users
- schedules
- registrations
- deposits
- expenses
- balances
- finalizations

Frontend should add:
- client-side search
- client-side filters
- virtualization for large tables if needed

### 4. Handle finalized-month locks

The backend blocks edits in finalized months for:
- deposits
- expenses
- finalized-month operations that conflict with ordering

Recommended UX:
- fetch finalization status before showing edit controls
- still handle backend `400` responses as final authority

### 5. Route alias cleanup

These aliases currently work, but the frontend should standardize on one path:
- use `/meal-schedules`, not `/managers`
- use `/meals`, not `/users/meals`

## Suggested Screen-to-Endpoint Map

Suggested Next.js page mapping:
- profile page: `GET /users/profile`, `PUT /users/profile`
- user onboarding page: `POST /users/create`
- member list page: `GET /users`
- role management page: `PUT /users/role/:userId`
- meal calendar page: `GET /meals/available`, `POST /meals/register`, `PATCH /meals/register/:registrationId`, `DELETE /meals/register/cancel/:registrationId`
- bulk meal opt-in page: `POST /meals/bulk-register`
- meal sheet page: `GET /meal-schedules/meal-sheet`
- schedule admin page: `GET /meal-schedules/schedules`, `POST /meal-schedules/schedules/generate`, `PUT /meal-schedules/schedules/:scheduleId`
- deadline settings page: `GET /meal-deadlines`, `PUT /meal-deadlines`
- deposits admin page: `GET /finance/deposits`, `POST /finance/deposits/add`, `PUT /finance/deposits/:depositId`, `DELETE /finance/deposits/:depositId`
- expenses page: `GET /finance/expenses`, `POST /finance/expenses/add`, `PUT /finance/expenses/:expenseId`, `DELETE /finance/expenses/:expenseId`
- personal finance page: `GET /finance/my-balance`, `GET /finance/user-deposit`, `GET /finance/user-finalization`, `GET /finance/dashboard`
- admin finance dashboard: `GET /finance/month-summary`, `GET /finance/meal-rate`, `GET /finance/top-members`, `GET /finance/expense-trend`, `GET /finance/meal-type-breakdown`
- month closing page: `POST /finance/finalize`, `GET /finance/finalization/:month`, `DELETE /finance/finalization/:month`

## Source Files

Primary backend references used for this guide:
- [`index.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/index.ts)
- [`middleware/verifyFirebaseToken.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/middleware/verifyFirebaseToken.ts)
- [`middleware/errorHandler.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/middleware/errorHandler.ts)
- [`modules/users/users.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/users/users.route.ts)
- [`modules/users/users.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/users/users.service.ts)
- [`modules/meals/meals.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/meals/meals.route.ts)
- [`modules/meals/meals.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/meals/meals.service.ts)
- [`modules/meal-schedules/meal-schedules.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/meal-schedules/meal-schedules.route.ts)
- [`modules/meal-schedules/meal-schedules.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/meal-schedules/meal-schedules.service.ts)
- [`modules/meal-deadlines/meal-deadlines.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/meal-deadlines/meal-deadlines.route.ts)
- [`modules/meal-deadlines/meal-deadlines.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/meal-deadlines/meal-deadlines.service.ts)
- [`modules/deposits/deposits.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/deposits/deposits.route.ts)
- [`modules/deposits/deposits.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/deposits/deposits.service.ts)
- [`modules/expenses/expenses.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/expenses/expenses.route.ts)
- [`modules/expenses/expenses.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/expenses/expenses.service.ts)
- [`modules/finance/balances.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/finance/balances.route.ts)
- [`modules/finance/balances.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/finance/balances.service.ts)
- [`modules/finalization/finalization.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/finalization/finalization.route.ts)
- [`modules/finalization/finalization.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/finalization/finalization.service.ts)
- [`modules/stats/stats.route.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/stats/stats.route.ts)
- [`modules/stats/stats.service.ts`](/c:/Users/SAMI/Downloads/my-projects/dining-management-server/modules/stats/stats.service.ts)

### `GET /finance/expense-trend?month=YYYY-MM`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  month: string
  count: number
  records: Array<{
    serviceDate: string
    totalAmount: number
    categories: Record<string, number>
  }>
}
```

### `GET /finance/top-members?month=YYYY-MM&limit=10`

Auth:
- required
- role: `admin` or `super_admin`

Response:

```ts
{
  month: string
  count: number
  limit: number
  members: Array<{
    rank: number
    userId: string
    userName?: string
    email?: string
    room?: string
    totalMeals: number
    breakdown: {
      morning: number
      evening: number
      night: number
    }
  }>
}
```

### `GET /finance/user-finalization?month=YYYY-MM`

Auth:
- required

Response:

```ts
{
  finalization: {
    month: string
    finalizedAt: string
    finalizedDate: string
    mealRate: number
    totalMealsServed: number
    totalExpenses: number
    userId: string
    userName: string
    totalMeals: number
    totalDeposits: number
    mealCost: number
    mosqueFee: number
    previousBalance: number
    newBalance: number
    status: "paid" | "due" | "advance"
  }
}
```
