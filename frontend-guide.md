# Combined Dining Frontend Guide

## Overview

The backend now supports two dining locations:

- `township`
- `office`

The schedule is still common per date. A schedule does not have a top-level `diningId`; each meal inside `availableMeals` or `meals` has its own `diningId`.

Existing frontend behavior should mostly keep working because `diningId` is additive, but the UI should be updated so users can see where each meal is served.

## Dining IDs

Use these exact values:

```ts
type DiningId = 'township' | 'office';
```

Recommended display labels:

```ts
const diningLabels: Record<DiningId, string> = {
  township: 'Township',
  office: 'Office',
};
```

## Meal Schedule Shape

Generated schedules now look like this:

```json
{
  "_id": "schedule_id",
  "date": "2026-06-07T00:00:00.000Z",
  "isHoliday": false,
  "availableMeals": [
    {
      "mealType": "morning",
      "isAvailable": true,
      "diningId": "office",
      "customDeadline": null,
      "weight": 0.5,
      "menu": ""
    },
    {
      "mealType": "evening",
      "isAvailable": true,
      "diningId": "office",
      "customDeadline": null,
      "weight": 1,
      "menu": ""
    },
    {
      "mealType": "night",
      "isAvailable": true,
      "diningId": "township",
      "customDeadline": null,
      "weight": 1,
      "menu": ""
    }
  ]
}
```

For Friday/Saturday, all generated meals are served at `township`.

## Available Meals API

Endpoint:

```http
GET /users/meals/available?month=2026-06
```

or:

```http
GET /users/meals/available?startDate=2026-06-01&endDate=2026-06-07
```

Each meal in the response now includes `diningId`.

Example:

```json
{
  "count": 1,
  "schedules": [
    {
      "date": "2026-06-07T00:00:00.000Z",
      "isHoliday": false,
      "meals": [
        {
          "mealType": "morning",
          "diningId": "office",
          "isAvailable": true,
          "menu": "",
          "weight": 0.5,
          "deadline": "2026-06-06T16:00:00.000Z",
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

Frontend changes:

- Show the dining location beside every available meal.
- Use `diningId` when deciding whether a meal is registered.
- Do not assume all meals on the same date are served at the same location.

## Registering a Meal

Endpoint:

```http
POST /users/meals/register
```

Request body must include the meal's `diningId`:

```json
{
  "date": "2026-06-07T00:00:00.000Z",
  "mealType": "morning",
  "diningId": "office",
  "mealCategory": "basic",
  "numberOfMeals": 1
}
```

Admin registering for another user:

```json
{
  "date": "2026-06-07T00:00:00.000Z",
  "mealType": "morning",
  "diningId": "office",
  "mealCategory": "alternative",
  "userId": "target_user_id",
  "numberOfMeals": 1
}
```

Response includes `diningId` inside `registration`.

`mealCategory` is optional and defaults to `basic`.

Allowed values:

```ts
type MealCategory = 'basic' | 'alternative';
```

Use `alternative` when a user needs the alternate meal for that registration.

## Updating and Cancelling Registrations

Existing endpoints remain the same:

```http
PATCH /users/meals/register/:registrationId
DELETE /users/meals/register/cancel/:registrationId
```

The frontend does not need to pass `diningId` for update/cancel because the registration already stores it.

Users can mark an existing registration as alternative:

```http
PATCH /users/meals/register/:registrationId
```

```json
{
  "mealCategory": "alternative"
}
```

They can switch back to the regular meal:

```json
{
  "mealCategory": "basic"
}
```

The same endpoint can still update `numberOfMeals`:

```json
{
  "numberOfMeals": 2,
  "mealCategory": "alternative"
}
```

Frontend changes:

- Show a basic/alternative control for registered meals.
- Only show or enable this control after the meal is registered.
- Display alternative registrations clearly in manager registration views.

## Meal Defaults

The existing endpoint now supports both dining locations:

```http
PATCH /users/meal-default
```

Township default:

```json
{
  "mealDefault": true,
  "diningId": "township"
}
```

Office default:

```json
{
  "mealDefault": true,
  "diningId": "office"
}
```

For backward compatibility, omitting `diningId` updates township:

```json
{
  "mealDefault": true
}
```

User objects now include:

```ts
interface User {
  mealDefault?: boolean;
  mealDefaultOffice?: boolean;
}
```

Frontend changes:

- Keep the existing township default toggle.
- Add a separate office default toggle.
- Bind township toggle to `mealDefault`.
- Bind office toggle to `mealDefaultOffice`.

## Manager Schedule Editing

Endpoint:

```http
PUT /managers/schedules/:scheduleId
```

When editing `availableMeals`, include `diningId` per meal:

```json
{
  "availableMeals": [
    {
      "mealType": "morning",
      "isAvailable": true,
      "diningId": "office",
      "weight": 0.5,
      "customDeadline": null,
      "menu": ""
    },
    {
      "mealType": "evening",
      "isAvailable": true,
      "diningId": "office",
      "weight": 1,
      "customDeadline": null,
      "menu": ""
    },
    {
      "mealType": "night",
      "isAvailable": true,
      "diningId": "township",
      "weight": 1,
      "customDeadline": null,
      "menu": ""
    }
  ]
}
```

Important behavior:

- If a meal's `diningId` is changed, existing registrations for that date and meal follow the new `diningId`.
- If a meal is made unavailable, existing registrations for that date and meal are deleted.
- If an unavailable meal becomes available, default users for that meal's dining location are auto-registered.

Frontend changes:

- Add a location selector for each meal row in schedule editing.
- Do not add a top-level schedule location selector.

## Expenses

Expense records now support `diningId`.

Create expense:

```http
POST /finance/expenses/add
```

```json
{
  "date": "2026-06-07",
  "diningId": "office",
  "category": "Groceries",
  "amount": 1200,
  "description": "Vegetables",
  "person": "Manager Name"
}
```

List expenses:

```http
GET /finance/expenses?diningId=office
```

Update expense:

```http
PUT /finance/expenses/:expenseId
```

```json
{
  "diningId": "township",
  "amount": 1500
}
```

Frontend changes:

- Add a dining selector to the expense create/edit form.
- Add an optional dining filter to the expense list.
- Display the dining location in expense tables.

## Running Meal Rate

Endpoint:

```http
GET /stats/meal-rate?month=2026-06&diningId=office
```

If `diningId` is omitted, backend defaults to `township`.

Example response:

```json
{
  "month": "2026-06",
  "diningId": "office",
  "asOf": "2026-06-15",
  "totalMealsServed": 42,
  "totalExpenses": 12000,
  "mealRate": 285.71
}
```

Frontend changes:

- Show separate running meal rates for township and office.
- Call the endpoint twice, once for each dining location, or let the user select a dining location.

## Monthly Finalization

Finalization remains one combined monthly action.

Endpoint:

```http
POST /finance/finalize
```

Request:

```json
{
  "month": "2026-06"
}
```

No `diningId` is needed.

Finalization stores combined totals plus per-dining metadata.

Summary response includes:

```json
{
  "summary": {
    "month": "2026-06",
    "totalMealsServed": 200,
    "totalExpenses": 46000,
    "mealRate": 230,
    "totalFixedDeposit": 50000,
    "totalMosqueFee": 3000,
    "totalMemberBalancesAfterFinalization": 22000,
    "cashAtHand": 75000,
    "diningBreakdown": [
      {
        "diningId": "township",
        "totalMealsServed": 120,
        "totalExpenses": 30000,
        "mealRate": 250,
        "expenseBreakdown": []
      },
      {
        "diningId": "office",
        "totalMealsServed": 80,
        "totalExpenses": 16000,
        "mealRate": 200,
        "expenseBreakdown": []
      }
    ]
  }
}
```

Member details include `diningDetails`:

```json
{
  "userId": "user_id",
  "userName": "Member Name",
  "totalMeals": 20,
  "mealCost": 4600,
  "mosqueFee": 100,
  "previousBalance": 1000,
  "newBalance": -3700,
  "status": "due",
  "diningDetails": [
    {
      "diningId": "township",
      "totalMeals": 12,
      "mealRate": 250,
      "mealCost": 3000
    },
    {
      "diningId": "office",
      "totalMeals": 8,
      "mealRate": 200,
      "mealCost": 1600
    }
  ]
}
```

Frontend changes:

- Do not ask admins to finalize township and office separately.
- Show `diningBreakdown` in finalization summary.
- Show each member's `diningDetails` in finalization detail views.
- Show `cashAtHand` prominently in finalization summary.

## Compatibility Notes

- Old records were backfilled for schedule meals and registrations.
- Old expenses may still need `scripts/backfillDiningMetadata.js` to be run if not already applied after expense support was added.
- Missing `diningId` is treated as `township` by the backend.
- Current frontend should not break from extra `diningId` fields unless strict schema validation rejects unknown fields.

## Meal Delivery Requests

Users can request delivery for meals they are already registered for.

Delivery locations are fixed:

```ts
type DeliveryLocation = 'township' | 'old_admin';
```

Recommended display labels:

```ts
const deliveryLocationLabels: Record<DeliveryLocation, string> = {
  township: 'Township',
  old_admin: 'Old Admin',
};
```

### Default Delivery Location

User profiles support:

```ts
interface User {
  defaultDeliveryLocation?: DeliveryLocation | null;
}
```

Update through the existing profile endpoint:

```http
PUT /users/profile
```

```json
{
  "defaultDeliveryLocation": "township"
}
```

Clear the default:

```json
{
  "defaultDeliveryLocation": null
}
```

### Request Delivery

Endpoint:

```http
PUT /users/meals/register/:registrationId/delivery
```

Request:

```json
{
  "deliveryLocation": "old_admin"
}
```

This creates or updates the delivery request for that registration.

Response:

```json
{
  "message": "Meal delivery request saved successfully",
  "deliveryRequest": {
    "_id": "delivery_request_id",
    "registrationId": "registration_id",
    "userId": "user_id",
    "date": "2026-06-07T00:00:00.000Z",
    "diningId": "office",
    "mealType": "morning",
    "deliveryLocation": "old_admin",
    "requestedAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z"
  }
}
```

### Cancel Delivery

Endpoint:

```http
DELETE /users/meals/register/:registrationId/delivery
```

### Available Meals Response

Registered meals include `deliveryRequest` when one exists:

```json
{
  "mealType": "morning",
  "diningId": "office",
  "isRegistered": true,
  "registrationId": "registration_id",
  "deliveryRequest": {
    "_id": "delivery_request_id",
    "deliveryLocation": "old_admin",
    "requestedAt": "2026-05-14T10:00:00.000Z",
    "updatedAt": "2026-05-14T10:00:00.000Z"
  }
}
```

### Manager Delivery List

Endpoint:

```http
GET /managers/delivery-requests?startDate=2026-06-01&endDate=2026-06-07
```

Optional filters:

```http
GET /managers/delivery-requests?startDate=2026-06-01&endDate=2026-06-07&deliveryLocation=old_admin&diningId=office
```

Frontend changes:

- Add a delivery-location dropdown for registered meals.
- Preselect the user's `defaultDeliveryLocation` when creating a request.
- Show whether a registered meal already has a delivery request.
- Add a manager view for delivery requests grouped by date, meal, and delivery location.
