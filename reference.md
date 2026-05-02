# Frontend API Reference

Last checked against the backend source on 2026-05-02.

This document is intended as the frontend integration contract for the Dining Management backend. The server is an Express app mounted from `index.js`.

## Runtime Basics

- Development base URL: `http://localhost:5000`
- Production base URL: use the deployed server URL.
- JSON body header: `Content-Type: application/json`
- Authenticated routes require a Firebase ID token:

```http
Authorization: Bearer <firebase_id_token>
```

The backend verifies the Firebase token, looks up an active user by token email, then attaches the MongoDB user document to `req.user`. Inactive users are rejected.

There is no `start` script in `package.json`; run locally with `node index.js` or `npx nodemon index.js`.

## Shared Types

### Role

Allowed user roles:

```ts
type Role = 'admin' | 'manager' | 'member' | 'moderator' | 'staff' | 'super_admin';
```

### Meal Type

```ts
type MealType = 'morning' | 'evening' | 'night';
```

Default registration deadlines use the `Asia/Dhaka` timezone:

| Meal | Deadline |
| --- | --- |
| `morning` | Previous day 10:00 PM |
| `evening` | Same day 8:00 AM |
| `night` | Same day 2:00 PM |

Schedules can override the deadline with `customDeadline`.

### Common Date Formats

- `month`: `YYYY-MM`, for example `2026-04`
- Calendar date inputs: `YYYY-MM-DD`
- Response dates are serialized JSON dates from MongoDB/JavaScript `Date`, usually ISO strings.

### ObjectId

MongoDB IDs are returned as strings in JSON, but many backend writes validate them as MongoDB ObjectIds.

## Domain Models

These are representative response shapes for frontend typing. MongoDB may include extra fields.

```ts
interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  building?: string;
  room?: string;
  bank?: string;
  designation: string;
  department: string;
  role: Role;
  isActive: boolean;
  mealDefault?: boolean;
  fixedDeposit: number;
  mosqueFee: number;
  createdAt: string;
  updatedAt: string;
}

interface AvailableMealConfig {
  mealType: MealType;
  isAvailable: boolean;
  customDeadline: string | null;
  weight: number;
  menu: string;
}

interface MealSchedule {
  _id: string;
  date: string;
  isHoliday: boolean;
  availableMeals: AvailableMealConfig[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MealRegistration {
  _id: string;
  userId: string;
  date: string;
  mealType: MealType;
  numberOfMeals: number;
  registeredAt: string;
  updatedAt?: string;
}

interface Deposit {
  _id: string;
  userId: string;
  amount: number;
  month: string;
  depositDate: string;
  notes: string;
  addedBy: string;
  createdAt: string;
  updatedAt?: string;
  userName?: string;
  userEmail?: string;
}

interface Expense {
  _id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  person: string;
  addedBy: string;
  addedByName?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Common Responses

Success responses are JSON and commonly use one of these patterns:

```json
{ "message": "Operation completed" }
```

```json
{ "count": 1, "items": [] }
```

```json
{ "user": {}, "deposit": {}, "expense": {}, "finalization": {}, "summary": {} }
```

Error responses are inconsistent between controllers and can use either `error` or `message`:

```json
{ "error": "Error message" }
```

```json
{ "message": "Error message" }
```

Frontend error handling should read `data.error || data.message || fallbackMessage`.

Common status codes:

| Status | Meaning |
| --- | --- |
| `200` | Read/update/delete success |
| `201` | Created |
| `400` | Invalid input, duplicate action, deadline passed, finalized month restriction |
| `401` | Unauthorized in a few manager flows |
| `403` | Missing/invalid token, inactive user, or role denied |
| `404` | Resource not found |
| `500` | Server error |

## Health

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | No | Server health/welcome string. |

Response body is plain text:

```text
Welcome to dining management server
```

## Users

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/users/create` | No | Create a dining user profile. |
| `GET` | `/users/profile` | Any active user | Get the current user's profile. |
| `PUT` | `/users/profile` | Any active user | Update the current user's profile. |
| `PATCH` | `/users/meal-default` | Any active user | Toggle current user's default auto-registration preference. |
| `PUT` | `/users/role/:userId` | `admin`, `manager`, `super_admin` | Update a user's role. |
| `PUT` | `/users/fixedDeposit/:userId` | `admin`, `super_admin` | Update a user's fixed deposit amount. |
| `PUT` | `/users/mosqueFee/:userId` | `admin`, `super_admin` | Update a user's mosque fee. |
| `PATCH` | `/users/deactivate/:userId` | `admin`, `super_admin` | Deactivate a user. |
| `PATCH` | `/users/reactivate/:userId` | `admin`, `super_admin` | Reactivate a user. |
| `GET` | `/users` | No token enforced | List users. |
| `GET` | `/users/get-role/:email` | No | Get an active user's role by email. |
| `GET` | `/users/check-user/:email` | No | Check whether an active user exists for an email. |

### `POST /users/create`

Required fields: `name`, `mobile`, `email`.

```json
{
  "name": "Member Name",
  "mobile": "01700000000",
  "email": "member@example.com",
  "building": "A",
  "room": "101",
  "bank": "Bank name",
  "designation": "Student",
  "department": "CSE"
}
```

Creates users with `role: "member"`, `isActive: true`, `fixedDeposit: 0`, and `mosqueFee: 0`.

Response `201`:

```json
{
  "message": "User created successfully",
  "userId": "USER_ID",
  "user": {}
}
```

### `GET /users/profile`

Response `200`:

```json
{ "user": {} }
```

### `PUT /users/profile`

All fields are optional. Empty string values only persist for `designation` and `department`; other fields update only when truthy.

```json
{
  "name": "Updated Name",
  "building": "A",
  "room": "101",
  "mobile": "01700000000",
  "designation": "Student",
  "department": "CSE"
}
```

### `PATCH /users/meal-default`

```json
{ "mealDefault": true }
```

`mealDefault` must be a boolean. When enabled, schedule generation and newly available meals auto-register the user.

### `PUT /users/role/:userId`

```json
{ "role": "manager" }
```

### `PUT /users/fixedDeposit/:userId`

```json
{ "fixedDeposit": 1000 }
```

No numeric validation is currently enforced by the backend.

### `PUT /users/mosqueFee/:userId`

```json
{ "mosqueFee": 50 }
```

No numeric validation is currently enforced by the backend.

### `PATCH /users/deactivate/:userId`

Admins cannot deactivate their own account.

Response `200`:

```json
{ "message": "User deactivated successfully", "user": {} }
```

### `PATCH /users/reactivate/:userId`

Response `200`:

```json
{ "message": "User reactivated successfully", "user": {} }
```

### `GET /users`

Query params:

| Param | Required | Notes |
| --- | --- | --- |
| `role` | No | Must be one of the known roles; invalid values are ignored. |
| `department` | No | Exact department match. |
| `includeInactive` | No | Set to `true` to include inactive users. Defaults to active users only. |

Example:

```http
GET /users?role=member&department=CSE&includeInactive=true
```

Response `200`:

```json
{
  "count": 1,
  "users": [],
  "totalFixedDeposit": 1000
}
```

### `GET /users/get-role/:email`

Returns only active users.

Response `200`:

```json
{ "role": "member" }
```

### `GET /users/check-user/:email`

Response `200`:

```json
{ "doesExist": true }
```

## Meals

Meal member routes are mounted under `/users`.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/users/meals/available` | Any active user | Get schedules with current user's registration status. |
| `POST` | `/users/meals/register` | Any active user | Register current user for a meal. Admins/super admins can register another user. |
| `POST` | `/users/meals/bulk-register` | Any active user | Register current user for all available, deadline-open meals in a month. |
| `PATCH` | `/users/meals/register/:registrationId` | Any active user | Update `numberOfMeals`. |
| `DELETE` | `/users/meals/register/cancel/:registrationId` | Any active user | Cancel a registration. |
| `GET` | `/users/meals/total/:email` | Any active user | Get weighted meal totals for a month. |

### `GET /users/meals/available`

Use either `month` or both `startDate` and `endDate`.

```http
GET /users/meals/available?month=2026-04
GET /users/meals/available?startDate=2026-04-01&endDate=2026-04-30
```

Response `200`:

```json
{
  "count": 1,
  "schedules": [
    {
      "date": "2026-04-08T00:00:00.000Z",
      "isHoliday": false,
      "meals": [
        {
          "mealType": "night",
          "isAvailable": true,
          "menu": "Rice, dal, fish",
          "weight": 1,
          "deadline": "2026-04-08T08:00:00.000Z",
          "canRegister": true,
          "isRegistered": false,
          "registrationId": null,
          "numberOfMeals": null
        }
      ]
    }
  ]
}
```

`canRegister` is already computed from availability, deadline, and current user's existing registration.

### `POST /users/meals/register`

Required fields: `date`, `mealType`.

```json
{
  "date": "2026-04-08",
  "mealType": "night",
  "numberOfMeals": 1,
  "userId": "optional-target-user-id-for-admin-or-super-admin"
}
```

Rules:

- Normal users cannot register after the deadline.
- `admin` and `super_admin` can pass `userId` to register another user and can register after the deadline.
- Duplicate registrations for the same `userId`, `date`, and `mealType` are rejected.
- `numberOfMeals` defaults to `1`.

Response `201`:

```json
{
  "message": "Meal registered successfully",
  "registrationId": "REGISTRATION_ID",
  "registration": {}
}
```

### `POST /users/meals/bulk-register?month=YYYY-MM`

No body is required.

Registers the current user for every available meal in the month that is not already registered and whose deadline has not passed.

Response `201` when registrations are created:

```json
{
  "message": "Successfully registered for 10 meals",
  "registeredCount": 10
}
```

Response `200` when nothing is available:

```json
{
  "message": "No available meals to register for",
  "registeredCount": 0
}
```

### `PATCH /users/meals/register/:registrationId`

```json
{ "numberOfMeals": 2 }
```

Rules:

- `numberOfMeals` must be a positive number.
- Normal users can only update their own registration before the default deadline.
- Admins and super admins can update any registration after the deadline.

Response `200`:

```json
{ "message": "Registration updated successfully" }
```

### `DELETE /users/meals/register/cancel/:registrationId`

Rules:

- Normal users can only cancel their own registration before the deadline.
- Admins and super admins can cancel any registration after the deadline.

Response `200`:

```json
{ "message": "Meal registration cancelled successfully" }
```

### `GET /users/meals/total/:email`

Query params:

| Param | Required | Notes |
| --- | --- | --- |
| `month` | No | Defaults to current server month. Must be `YYYY-MM` if provided. |

Response `200`:

```json
{
  "userId": "USER_ID",
  "userName": "Member Name",
  "email": "member@example.com",
  "month": "2026-04",
  "totalMeals": 12.5,
  "mealCount": 14,
  "breakdown": {
    "morning": 1.5,
    "evening": 5,
    "night": 6
  },
  "registrations": 14
}
```

`totalMeals` and `breakdown` are weighted by schedule meal weights.

## Manager Schedules And Registrations

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/managers/schedules/generate` | `admin`, `super_admin` | Generate schedules for a date range and auto-register default users. |
| `GET` | `/managers/schedules` | Any active user | Get schedules for a date range. |
| `PUT` | `/managers/schedules/:scheduleId` | `admin`, `super_admin` | Update one schedule and sync registrations. |
| `DELETE` | `/managers/schedules/:scheduleId` | `admin`, `super_admin` | Delete one schedule and its registrations. |
| `GET` | `/managers/registrations` | No token enforced | Get all registrations for a date range. |

### `POST /managers/schedules/generate`

```json
{
  "startDate": "2026-04-01",
  "endDate": "2026-04-30"
}
```

Rules:

- Date range cannot exceed 90 days.
- Existing schedule dates are skipped.
- Friday/Saturday and holiday defaults make all meals available.
- Normal weekday defaults make only `night` available.
- Users with `mealDefault: true` are auto-registered for available meals.

Response `201`:

```json
{
  "message": "30 schedules created successfully",
  "count": 30,
  "registrationsCreated": 90
}
```

Response `200` if all schedules already exist:

```json
{
  "message": "All schedules already exist for this date range",
  "count": 0
}
```

### `GET /managers/schedules`

Required query params: `startDate`, `endDate`.

```http
GET /managers/schedules?startDate=2026-04-01&endDate=2026-04-30
```

Response `200`:

```json
{
  "count": 1,
  "schedules": []
}
```

### `PUT /managers/schedules/:scheduleId`

```json
{
  "isHoliday": false,
  "availableMeals": [
    {
      "mealType": "morning",
      "isAvailable": true,
      "customDeadline": null,
      "weight": 0.5,
      "menu": "Khichuri"
    },
    {
      "mealType": "evening",
      "isAvailable": true,
      "customDeadline": null,
      "weight": 1,
      "menu": "Rice, dal, chicken"
    },
    {
      "mealType": "night",
      "isAvailable": true,
      "customDeadline": null,
      "weight": 1,
      "menu": "Rice, dal, fish"
    }
  ]
}
```

Rules:

- `isHoliday` is optional.
- `availableMeals` is optional, but must be an array when provided.
- Unavailable meals are normalized to `weight: 0`.
- Registrations for meal types changed to unavailable are deleted.
- Meal types changed from unavailable/missing to available auto-register active `mealDefault: true` users.
- Existing registrations are not duplicated.

Response `200`:

```json
{
  "message": "Schedule and registrations updated successfully",
  "schedule": {},
  "registrationsCreated": 3
}
```

### `DELETE /managers/schedules/:scheduleId`

Deletes the schedule and every meal registration on that schedule date.

Response `200`:

```json
{
  "message": "Schedule deleted successfully",
  "registrationsCleared": 12
}
```

### `GET /managers/registrations`

Required query params: `startDate`, `endDate`.

```http
GET /managers/registrations?startDate=2026-04-01&endDate=2026-04-30
```

Response `200`:

```json
{
  "count": 1,
  "startDate": "2026-04-01",
  "endDate": "2026-04-30",
  "registrations": [
    {
      "_id": "REGISTRATION_ID",
      "userId": "USER_ID",
      "date": "2026-04-08T00:00:00.000Z",
      "mealType": "night",
      "numberOfMeals": 1,
      "registeredAt": "2026-04-01T00:00:00.000Z",
      "user": {
        "name": "Member Name",
        "email": "member@example.com"
      }
    }
  ]
}
```

## Finance: Deposits

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/finance/deposits/add` | `admin`, `super_admin` | Add a deposit and increment member balance. |
| `GET` | `/finance/deposits` | Any active user | List deposits with user info. |
| `GET` | `/finance/user-deposit` | Any active user | Get current user's total deposit for a month. |
| `PUT` | `/finance/deposits/:depositId` | `admin`, `super_admin` | Update a deposit and adjust balance if amount changes. |
| `DELETE` | `/finance/deposits/:depositId` | `admin`, `super_admin` | Delete a deposit and deduct it from balance. |

### `POST /finance/deposits/add`

Required fields: `userId`, `amount`, `month`.

```json
{
  "userId": "USER_ID",
  "amount": 1000,
  "month": "2026-04",
  "depositDate": "2026-04-08",
  "notes": "Cash"
}
```

Rules:

- `amount` must be a positive number.
- `month` must be `YYYY-MM`.
- `userId` must belong to an active user.
- The user's `memberBalances.balance` is incremented by `amount`.

Response `201`:

```json
{
  "message": "Deposit added successfully",
  "depositId": "DEPOSIT_ID",
  "deposit": {}
}
```

### `GET /finance/deposits`

Query params:

| Param | Required | Notes |
| --- | --- | --- |
| `month` | No | Exact month match. |
| `userId` | No | Exact user id match. |

Response `200`:

```json
{
  "count": 1,
  "totalDeposit": 1000,
  "deposits": []
}
```

Each deposit includes `userName` and `userEmail` when the user is found.

### `GET /finance/user-deposit?month=YYYY-MM`

Response `200`:

```json
{
  "userId": "USER_ID",
  "userName": "Member Name",
  "email": "member@example.com",
  "month": "2026-04",
  "deposit": 1000,
  "lastUpdated": "2026-04-08T00:00:00.000Z"
}
```

The backend does not currently validate that `month` is present for this route; frontend should always send it.

### `PUT /finance/deposits/:depositId`

```json
{
  "amount": 1200,
  "month": "2026-04",
  "depositDate": "2026-04-09",
  "notes": "Adjusted"
}
```

Rules:

- Invalid ObjectId returns `400`.
- Updating `amount` adjusts the related member balance by the difference.
- Changing a deposit away from a finalized month is blocked.
- No positive-number validation is currently enforced on update, so the frontend should validate `amount > 0`.

Response `200`:

```json
{ "message": "Deposit updated successfully" }
```

### `DELETE /finance/deposits/:depositId`

Rules:

- Deleting a deposit from a finalized month is blocked.
- The user's balance is decremented by the deleted deposit amount.

Response `200`:

```json
{ "message": "Deposit deleted successfully" }
```

## Finance: Expenses

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/finance/expenses/add` | `admin`, `super_admin` | Add an expense. |
| `GET` | `/finance/expenses` | Any active user | List expenses. |
| `PUT` | `/finance/expenses/:expenseId` | `admin`, `super_admin` | Update an expense. |
| `DELETE` | `/finance/expenses/:expenseId` | `admin`, `super_admin` | Delete an expense. |

### `POST /finance/expenses/add`

Required fields: `date`, `category`, `amount`.

```json
{
  "date": "2026-04-08",
  "category": "bazaar",
  "amount": 2500,
  "description": "Groceries",
  "person": "Purchaser name"
}
```

`amount` must be a positive number.

Response `201`:

```json
{
  "message": "Expense added successfully",
  "expenseId": "EXPENSE_ID",
  "expense": {}
}
```

### `GET /finance/expenses`

Query params:

| Param | Required | Notes |
| --- | --- | --- |
| `startDate` | No | Used only when `endDate` is also present. |
| `endDate` | No | Used only when `startDate` is also present. |
| `category` | No | Exact category match. |

Response `200`:

```json
{
  "count": 1,
  "expenses": []
}
```

Each expense includes `addedByName`.

### `PUT /finance/expenses/:expenseId`

```json
{
  "date": "2026-04-09",
  "category": "bazaar",
  "amount": 2600,
  "description": "Updated groceries",
  "person": "Purchaser name"
}
```

Rules:

- Updating an expense from a finalized month is blocked.
- No positive-number validation is currently enforced on update, so the frontend should validate `amount > 0`.

Response `200`:

```json
{ "message": "Expense updated successfully" }
```

### `DELETE /finance/expenses/:expenseId`

Deleting an expense from a finalized month is blocked.

Response `200`:

```json
{ "message": "Expense deleted successfully" }
```

## Finance: Balances

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/finance/balances` | No token enforced | Get all member balances. |
| `GET` | `/finance/balances/:userId` | No token enforced | Get one member's balance. |
| `GET` | `/finance/my-balance` | Any active user | Get current user's balance. |

### `GET /finance/balances`

Response `200`:

```json
{
  "count": 1,
  "balances": [
    {
      "userId": "USER_ID",
      "userName": "Member Name",
      "email": "member@example.com",
      "balance": 500,
      "lastUpdated": "2026-04-08T00:00:00.000Z"
    }
  ]
}
```

### `GET /finance/balances/:userId`

Returns a zero balance if the user exists but has no balance record.

Response `200`:

```json
{
  "userId": "USER_ID",
  "userName": "Member Name",
  "email": "member@example.com",
  "balance": 0,
  "lastUpdated": null
}
```

### `GET /finance/my-balance`

Response `200`:

```json
{
  "userName": "Member Name",
  "email": "member@example.com",
  "balance": "500.00",
  "lastUpdated": "2026-04-08T00:00:00.000Z"
}
```

Note: `balance` is a string in this response when a balance record exists because the backend uses `toFixed(2)`.

## Finance: Finalization

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/finance/finalize` | `admin`, `super_admin` | Finalize a month and update member balances. |
| `GET` | `/finance/finalization/:month` | Any active user | Get one finalization record. |
| `GET` | `/finance/user-finalization` | Any active user | Get current user's finalization details for a month. |
| `GET` | `/finance/finalizations` | Any active user | List all finalizations. |
| `DELETE` | `/finance/finalization/:month` | `admin`, `super_admin` | Undo the latest finalized month and restore previous balances. |

### `POST /finance/finalize`

```json
{ "month": "2026-04" }
```

Rules:

- `month` must be `YYYY-MM`.
- A month can be finalized only once.
- Uses active users, that month's meal registrations, schedules, deposits, expenses, and current balances.
- Meal cost is `weightedMeals * mealRate`.
- New balance is `previousBalance - mealCost - mosqueFee`.
- Deposits are summarized but are already reflected in balances when deposits are created.

Response `201`:

```json
{
  "message": "Month finalized successfully",
  "finalizationId": "FINALIZATION_ID",
  "summary": {
    "month": "2026-04",
    "totalMembers": 10,
    "totalMealsServed": 125,
    "totalDeposits": 10000,
    "totalFixedDeposit": 5000,
    "totalMosqueFee": 500,
    "totalMemberBalancesAfterFinalization": 1200,
    "totalExpenses": 25000,
    "mealRate": 200
  }
}
```

### `GET /finance/finalization/:month`

```http
GET /finance/finalization/2026-04
```

Response `200`:

```json
{ "finalization": {} }
```

The full finalization contains `memberDetails`, `expenseBreakdown`, totals, `mealRate`, and audit fields.

### `GET /finance/user-finalization?month=YYYY-MM`

Response `200`:

```json
{
  "finalization": {
    "month": "2026-04",
    "finalizedAt": "2026-05-01T00:00:00.000Z",
    "mealRate": 200,
    "totalMealsServed": 125,
    "totalExpenses": 25000,
    "userId": "USER_ID",
    "userName": "Member Name",
    "totalMeals": 12,
    "totalDeposits": 1000,
    "mealCost": 2400,
    "mosqueFee": 50,
    "previousBalance": 3000,
    "newBalance": 550,
    "status": "advance"
  }
}
```

`status` is one of `paid`, `due`, or `advance`.

### `GET /finance/finalizations`

Response `200`:

```json
{
  "count": 1,
  "finalizations": []
}
```

Sorted by `month` descending.

### `DELETE /finance/finalization/:month`

```http
DELETE /finance/finalization/2026-04
```

Rules:

- Only the latest finalized month can be undone. If a later month exists, the backend returns `400`.
- Restores each member balance to `previousBalance` from the finalization record.
- Deletes the monthly finalization record.

Response `200`:

```json
{
  "message": "Finalization for 2026-04 has been undone successfully",
  "restoredMembers": 10
}
```

## Auth: Password Recovery

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/admin/create-recovery-code` | `super_admin` | Create a temporary password recovery code for a user. |
| `POST` | `/auth/recover-password` | No | Reset a Firebase password with a recovery code. |

### `POST /auth/admin/create-recovery-code`

```json
{ "userId": "USER_ID" }
```

Rules:

- `userId` must be a valid ObjectId for an active user.
- Target user must have a Firebase account.
- Any previous unused recovery codes for that user are invalidated.
- Recovery codes expire after 10 minutes.

Response `201`:

```json
{
  "recoveryCode": "ABCD-2345-WXYZ",
  "expiresAt": "2026-05-02T12:10:00.000Z"
}
```

### `POST /auth/recover-password`

```json
{
  "email": "member@example.com",
  "recoveryCode": "ABCD-2345-WXYZ",
  "newPassword": "new-password"
}
```

Rules:

- `email` must be valid.
- `recoveryCode` must match `AAAA-1111-BBBB` style format.
- `newPassword` must be 6 to 128 characters.
- The endpoint intentionally returns a generic failure message for invalid or expired codes.

Response `200`:

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

## Stats

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/stats/meal-rate` | Any active user | Calculate running meal rate for a month up to a date. |

### `GET /stats/meal-rate`

Required query params:

| Param | Required | Notes |
| --- | --- | --- |
| `month` | Yes | `YYYY-MM`. |
| `date` | No | Defaults to current server date. |

```http
GET /stats/meal-rate?month=2026-04&date=2026-04-15
```

Response `200`:

```json
{
  "month": "2026-04",
  "asOf": "2026-04-15",
  "totalMealsServed": 75,
  "totalExpenses": 15000,
  "mealRate": 200
}
```

The calculation is based on expenses and weighted registered meals from the first day of `month` through the end of `date`.

## Frontend Integration Notes

- Public or unauthenticated-by-route endpoints currently include `/users`, `/users/get-role/:email`, `/users/check-user/:email`, `/managers/registrations`, `/finance/balances`, and `/finance/balances/:userId`.
- Keep a single API helper that injects the Firebase ID token for authenticated routes and normalizes `error`/`message` response bodies.
- Use `GET /users/profile` after login to get the backend role, MongoDB `_id`, `mealDefault`, fixed deposit, mosque fee, and active state.
- Use `GET /users/meals/available` for member meal UI because it already includes `canRegister`, `isRegistered`, `registrationId`, and `numberOfMeals`.
- For admin schedule editing, refetch schedules and registrations after `PUT /managers/schedules/:scheduleId` because changing availability can create or delete registrations.
- Validate positive numeric fields in the frontend for `amount`, `fixedDeposit`, `mosqueFee`, `weight`, and `numberOfMeals`; some update routes do not fully validate numbers.
- Treat `/finance/my-balance` balance as `string | number` in frontend types because it returns a string when an existing balance record is found.
- Disable deposit/expense edits in the UI for finalized months; the backend rejects many but not all finalized-month edge cases uniformly.
- Prefer `YYYY-MM-DD` strings for date inputs and display response ISO dates in `Asia/Dhaka` for user-facing screens.
- There is no pagination on list endpoints. Large data sets should be filtered by month/date range where available.
