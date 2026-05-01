# Frontend API Reference

Base URL in development is usually `http://localhost:5000`.

Authenticated routes expect a Firebase ID token:

```http
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

Roles used by protected admin routes: `admin`, `manager`, `member`, `moderator`, `staff`, `super_admin`.

Date formats used by the API:

- `month`: `YYYY-MM`, for example `2026-04`
- `date`, `startDate`, `endDate`: valid date strings, usually `YYYY-MM-DD`
- `mealType`: one of `morning`, `evening`, `night`

## Health

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | No | Server welcome/health response. |

## Users

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/users/create` | No | Create a dining user profile. |
| `GET` | `/users/profile` | Any authenticated user | Get the current user's profile from the Firebase token email. |
| `PUT` | `/users/profile` | Any authenticated user | Update the current user's profile. |
| `PUT` | `/users/role/:userId` | `admin`, `manager`, `super_admin` | Update a user's role. |
| `PUT` | `/users/fixedDeposit/:userId` | `admin`, `super_admin` | Update a user's fixed deposit amount. |
| `PUT` | `/users/mosqueFee/:userId` | `admin`, `super_admin` | Update a user's mosque fee. |
| `PATCH` | `/users/deactivate/:userId` | `admin`, `super_admin` | Deactivate a user. |
| `PATCH` | `/users/reactivate/:userId` | `admin`, `super_admin` | Reactivate a user. |
| `GET` | `/users` | No token enforced by route | List users. Supports filters. |
| `GET` | `/users/get-role/:email` | No | Get active user's role by email. |
| `GET` | `/users/check-user/:email` | No | Check whether an active user exists for an email. |

### User Request Details

`POST /users/create`

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

Required: `name`, `mobile`, `email`.

`PUT /users/profile`

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

`PUT /users/role/:userId`

```json
{
  "role": "manager"
}
```

Allowed roles: `admin`, `manager`, `member`, `moderator`, `staff`, `super_admin`.

`PUT /users/fixedDeposit/:userId`

```json
{
  "fixedDeposit": 1000
}
```

`PUT /users/mosqueFee/:userId`

```json
{
  "mosqueFee": 50
}
```

`GET /users`

Query params:

- `role`: optional role filter
- `department`: optional department filter
- `includeInactive=true`: include deactivated users

Example: `/users?role=member&department=CSE&includeInactive=true`

## Meals

Meal routes are mounted under `/users`.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/users/meals/available` | Any authenticated user | Get schedules with registration status for the current user. |
| `POST` | `/users/meals/register` | Any authenticated user | Register the current user for a meal. Admins and super admins can register another user. |
| `POST` | `/users/meals/bulk-register` | Any authenticated user | Register current user for all available, not-yet-deadline-passed meals in a month. |
| `PATCH` | `/users/meals/register/:registrationId` | Any authenticated user | Update `numberOfMeals` for a registration. |
| `DELETE` | `/users/meals/register/cancel/:registrationId` | Any authenticated user | Cancel a meal registration. |
| `GET` | `/users/meals/total/:email` | Any authenticated user | Get a user's weighted meal totals for a month. |

### Meal Request Details

`GET /users/meals/available`

Query params:

- Either `month=YYYY-MM`
- Or both `startDate=YYYY-MM-DD` and `endDate=YYYY-MM-DD`

Examples:

- `/users/meals/available?month=2026-04`
- `/users/meals/available?startDate=2026-04-01&endDate=2026-04-30`

`POST /users/meals/register`

```json
{
  "date": "2026-04-08",
  "mealType": "night",
  "numberOfMeals": 1,
  "userId": "optional-target-user-id-for-admins"
}
```

Required: `date`, `mealType`.

`POST /users/meals/bulk-register?month=2026-04`

No body is required.

`PATCH /users/meals/register/:registrationId`

```json
{
  "numberOfMeals": 2
}
```

`GET /users/meals/total/:email`

Query params:

- `month`: optional, defaults to current month

Example: `/users/meals/total/member@example.com?month=2026-04`

## Managers

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/managers/schedules/generate` | `admin`, `super_admin` | Generate meal schedules for a date range. |
| `GET` | `/managers/schedules` | Any authenticated user | Get meal schedules for a date range. |
| `PUT` | `/managers/schedules/:scheduleId` | `admin`, `super_admin` | Update a schedule. |
| `DELETE` | `/managers/schedules/:scheduleId` | `admin`, `super_admin` | Delete a schedule and its registrations. |
| `GET` | `/managers/registrations` | No token enforced by route | Get all meal registrations for a date range. |

### Manager Request Details

`POST /managers/schedules/generate`

```json
{
  "startDate": "2026-04-01",
  "endDate": "2026-04-30"
}
```

Date range cannot exceed 90 days.

`GET /managers/schedules`

Required query params: `startDate`, `endDate`.

Example: `/managers/schedules?startDate=2026-04-01&endDate=2026-04-30`

`PUT /managers/schedules/:scheduleId`

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

`GET /managers/registrations`

Required query params: `startDate`, `endDate`.

Example: `/managers/registrations?startDate=2026-04-01&endDate=2026-04-30`

## Finance: Deposits

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/finance/deposits/add` | `admin`, `super_admin` | Add a member deposit and increment balance. |
| `GET` | `/finance/deposits` | Any authenticated user | List deposits. Supports filters. |
| `GET` | `/finance/user-deposit` | Any authenticated user | Get current user's total deposit for a month. |
| `PUT` | `/finance/deposits/:depositId` | `admin`, `super_admin` | Update a deposit and adjust balance if amount changes. |
| `DELETE` | `/finance/deposits/:depositId` | `admin`, `super_admin` | Delete a deposit and deduct it from balance. |

### Deposit Request Details

`POST /finance/deposits/add`

```json
{
  "userId": "user-id",
  "amount": 1000,
  "month": "2026-04",
  "depositDate": "2026-04-08",
  "notes": "Cash"
}
```

Required: `userId`, `amount`, `month`.

`GET /finance/deposits`

Query params:

- `month`: optional `YYYY-MM`
- `userId`: optional user id

Example: `/finance/deposits?month=2026-04&userId=USER_ID`

`GET /finance/user-deposit?month=2026-04`

`PUT /finance/deposits/:depositId`

```json
{
  "amount": 1200,
  "month": "2026-04",
  "depositDate": "2026-04-09",
  "notes": "Adjusted"
}
```

## Finance: Expenses

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/finance/expenses/add` | `admin`, `super_admin` | Add an expense. |
| `GET` | `/finance/expenses` | Any authenticated user | List expenses. Supports filters. |
| `PUT` | `/finance/expenses/:expenseId` | `admin`, `super_admin` | Update an expense. |
| `DELETE` | `/finance/expenses/:expenseId` | `admin`, `super_admin` | Delete an expense. |

### Expense Request Details

`POST /finance/expenses/add`

```json
{
  "date": "2026-04-08",
  "category": "bazaar",
  "amount": 2500,
  "description": "Groceries",
  "person": "Purchaser name"
}
```

Required: `date`, `category`, `amount`.

`GET /finance/expenses`

Query params:

- `startDate`: optional
- `endDate`: optional
- `category`: optional

Example: `/finance/expenses?startDate=2026-04-01&endDate=2026-04-30&category=bazaar`

`PUT /finance/expenses/:expenseId`

```json
{
  "date": "2026-04-09",
  "category": "bazaar",
  "amount": 2600,
  "description": "Updated groceries",
  "person": "Purchaser name"
}
```

## Finance: Balances

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/finance/balances` | No token enforced by route | Get all member balances. |
| `GET` | `/finance/balances/:userId` | No token enforced by route | Get one member's balance. |
| `GET` | `/finance/my-balance` | Any authenticated user | Get current user's balance. |

## Finance: Finalization

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/finance/finalize` | `admin`, `super_admin` | Finalize a month: calculate meal rate, member costs, mosque fees, and update balances. |
| `GET` | `/finance/finalization/:month` | Any authenticated user | Get finalization record for a month. |
| `GET` | `/finance/user-finalization` | Any authenticated user | Get current user's finalization details for a month. |
| `GET` | `/finance/finalizations` | Any authenticated user | List all finalizations. |
| `DELETE` | `/finance/finalization/:month` | `admin`, `super_admin` | Undo the latest finalized month and restore previous balances. |

### Finalization Request Details

`POST /finance/finalize`

```json
{
  "month": "2026-04"
}
```

`GET /finance/finalization/:month`

Example: `/finance/finalization/2026-04`

`GET /finance/user-finalization?month=2026-04`

`DELETE /finance/finalization/:month`

Example: `/finance/finalization/2026-04`

## Auth

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/admin/create-recovery-code` | `super_admin` | Create a temporary password recovery code for a user. |
| `POST` | `/auth/recover-password` | No | Reset a Firebase password with a recovery code. |

### Auth Request Details

`POST /auth/admin/create-recovery-code`

```json
{
  "userId": "user-id"
}
```

Response includes `recoveryCode` and `expiresAt`. Recovery codes expire after 10 minutes.

`POST /auth/recover-password`

```json
{
  "email": "member@example.com",
  "recoveryCode": "ABCD-2345-WXYZ",
  "newPassword": "new-password"
}
```

`newPassword` must be 6 to 128 characters.

## Stats

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/stats/meal-rate` | Any authenticated user | Calculate running meal rate for a month up to a date. |

### Stats Request Details

`GET /stats/meal-rate`

Required query params:

- `month`: `YYYY-MM`

Optional query params:

- `date`: defaults to today

Example: `/stats/meal-rate?month=2026-04&date=2026-04-15`

## Common Response Shapes

Most success responses return JSON with either:

- A `message` plus created/updated data
- A `count` plus an array, for list endpoints
- A named object such as `user`, `deposit`, `expense`, `finalization`, or `summary`

Most error responses return one of:

```json
{
  "error": "Error message"
}
```

```json
{
  "message": "Error message"
}
```

## Notes For Frontend Integration

- Some read routes currently do not enforce token verification even though they expose management data: `/users`, `/managers/registrations`, `/finance/balances`, and `/finance/balances/:userId`.
- `GET /users/meals/available` returns the current user's registration state per schedule and meal.
- Admin and super admin users can late-register or cancel meals for other users in some meal flows.
- Updating a schedule can delete registrations for meal types changed to unavailable.
- Deposit and expense updates/deletes may fail if the related month has already been finalized.
