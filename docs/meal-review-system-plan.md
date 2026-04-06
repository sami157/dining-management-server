# Meal Review System Plan

## Goal

Add a meal review system that allows users to rate each item in a consumed meal they registered for.

Constraints:
- no free-text comments
- ratings only
- menu definitions should move from a single string to a set of items
- item definitions should live in a separate collection
- item definitions should be mutable by `admin` and `super_admin`
- historical meal schedules and reviews should remain meaningful even if item names change later

## Recommended Design

The feature should be built around three layers:

1. `menuItems` as the mutable master catalog
2. `mealSchedules.availableMeals[].menuItems` as the date-specific menu snapshot
3. `mealReviews` as the user-submitted per-item ratings for a registered meal

This keeps admin-managed item definitions separate from the exact menu served on a given date.

## Core Data Model

### 1. `menuItems` collection

Purpose:
- canonical item catalog managed by admins

Suggested shape:

```ts
type MenuItemRecord = {
  _id?: ObjectId;
  name: string;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

Notes:
- `name` should be trimmed and required
- prefer soft-disable via `isActive` rather than hard delete
- if later needed, this can grow with fields like `sortOrder`, `tags`, or `description`

Suggested indexes:
- unique on normalized `name` if item names must be globally unique
- or non-unique `name` plus an app-level duplicate policy
- index on `isActive`

### 2. Schedule menu model

Current state:
- each available meal stores `menu: string`

Target state:

```ts
type ScheduledMenuItem = {
  itemId: ObjectId;
  nameSnapshot: string;
};

type MealOption = {
  mealType: "morning" | "evening" | "night";
  isAvailable: boolean;
  customDeadline: string | null;
  weight: number;
  menuItems: ScheduledMenuItem[];
};
```

Why snapshots are necessary:
- admins may rename items later
- past schedules should still show what was served at that time
- reviews should still mean the same thing after item catalog changes

Compatibility option during rollout:
- keep legacy `menu: string` temporarily
- derive it from `menuItems.map(i => i.nameSnapshot).join(", ")`

### 3. `mealReviews` collection

Purpose:
- store one review per user per consumed registered meal

Suggested shape:

```ts
type MealReviewItem = {
  itemId: ObjectId;
  itemNameSnapshot: string;
  rating: 1 | 2 | 3 | 4 | 5;
};

type MealReviewRecord = {
  _id?: ObjectId;
  userId: ObjectId;
  registrationId: ObjectId;
  scheduleId: ObjectId;
  serviceDate: string;
  mealType: "morning" | "evening" | "night";
  items: MealReviewItem[];
  reviewedAt: Date;
  updatedAt?: Date;
};
```

Suggested indexes:
- unique on `registrationId`
- index on `userId`
- index on `(serviceDate, mealType)`
- optional index on `items.itemId` for aggregation-heavy reporting later

## Review Rules

### Required rules

1. A user can only review a meal they registered for.
2. A review can only be submitted after the meal is considered consumed.
3. A review can only be submitted once per registration.
4. Review items must belong to the scheduled meal.
5. Rating must be an integer from `1` to `5`.

### Consumption timing

This needs a backend rule that is separate from registration deadline logic.

Recommended first version:
- define a review-open time per meal type
- allow review once current time is past that review-open time for the schedule date

Example:
- morning review opens at `10:00`
- evening review opens at `16:00`
- night review opens at `22:00`

Alternative simple version:
- use fixed hardcoded meal consumption cutoffs in backend logic first
- move to configurable values later

Do not reuse registration deadline as the meaning of "meal consumed".

## API Plan

## Menu Items Module

New module suggested:
- `/menu-items`

Routes:

### `GET /menu-items`

Purpose:
- list menu items

Auth:
- required or public, depending on frontend needs

Query options:

```ts
{
  isActive?: boolean
}
```

### `POST /menu-items`

Purpose:
- create a menu item

Auth:
- required
- roles: `admin | super_admin`

Body:

```ts
{
  name: string
  category?: string
  isActive?: boolean
}
```

### `PATCH /menu-items/:itemId`

Purpose:
- update item fields

Auth:
- required
- roles: `admin | super_admin`

Body:

```ts
{
  name?: string
  category?: string
  isActive?: boolean
}
```

### `DELETE /menu-items/:itemId`

Recommendation:
- do not hard delete if the item is already referenced by schedules or reviews
- prefer replacing true delete with an archive-style update: `isActive: false`

If a delete route exists, it should likely reject deletion when referenced.

## Schedule API Changes

Current state:
- schedule update accepts `availableMeals[].menu: string`

Target:

```ts
{
  availableMeals?: Array<{
    mealType: "morning" | "evening" | "night"
    isAvailable: boolean
    customDeadline?: string | null
    weight?: number
    menuItems: Array<{
      itemId: string
    }>
  }>
}
```

Backend behavior:
- validate all `itemId`s exist
- load current item names
- store schedule snapshot as:

```ts
menuItems: [{ itemId, nameSnapshot }]
```

Compatibility option:
- still return legacy `menu` string until frontend is migrated

## Meal Review Module

New module suggested:
- `/meal-reviews`

### `GET /meal-reviews/reviewable`

Purpose:
- list current user meals that are eligible for review and not yet reviewed

Auth:
- required

Response shape suggestion:

```ts
{
  count: number
  meals: Array<{
    registrationId: string
    scheduleId: string
    serviceDate: string
    mealType: "morning" | "evening" | "night"
    menuItems: Array<{
      itemId: string
      name: string
    }>
  }>
}
```

### `POST /meal-reviews`

Purpose:
- submit review for one registered meal

Auth:
- required

Body:

```ts
{
  registrationId: string
  items: Array<{
    itemId: string
    rating: 1 | 2 | 3 | 4 | 5
  }>
}
```

Backend validation:
- registration exists
- registration belongs to current user
- linked schedule exists
- meal is reviewable at current time
- review does not already exist
- submitted `items` match scheduled menu items exactly

Suggested response:

```ts
{
  message: "Review submitted successfully"
  reviewId: string
  review: object
}
```

### `GET /meal-reviews/my`

Purpose:
- list current user past reviews

Auth:
- required

Suggested query:

```ts
{
  month?: string
}
```

### Later admin/reporting endpoints

Not required in first implementation, but likely useful later:
- `GET /meal-reviews/item-stats`
- `GET /meal-reviews/schedule/:scheduleId`

## Validation Plan

## Shared validation additions

Suggested new schemas:

```ts
const menuItemNameSchema = z.string().trim().min(1);
const ratingSchema = z.number().int().min(1).max(5);
```

## Menu item validation

Create body:

```ts
{
  name: string;
  category?: string;
  isActive?: boolean;
}
```

Update body:
- at least one field required

## Schedule validation

New meal config shape:

```ts
{
  mealType: mealTypeSchema,
  isAvailable: z.boolean(),
  customDeadline: z.string().datetime().nullable().optional(),
  weight: z.number().min(0).optional(),
  menuItems: z.array(z.object({
    itemId: objectIdSchema
  })).default([])
}
```

Business rule:
- if `isAvailable === true`, `menuItems` may still be empty if kitchen has not finalized menu yet
- if frontend/business wants stricter enforcement, require at least one item for available meals

Recommendation:
- allow empty `menuItems` initially
- only allow meal reviews when the reviewed meal actually has menu items

## Review validation

Body:

```ts
{
  registrationId: objectIdSchema,
  items: z.array(z.object({
    itemId: objectIdSchema,
    rating: ratingSchema
  })).min(1)
}
```

Extra service-level checks:
- no duplicate `itemId`s
- exact set equality with scheduled menu items

## Service Layer Plan

## New module: `modules/menu-items`

Files:
- `menu-items.route.ts`
- `menu-items.controller.ts`
- `menu-items.service.ts`
- `menu-items.validation.ts`

Core service functions:
- `createMenuItem`
- `listMenuItems`
- `updateMenuItemById`
- `archiveMenuItemById`

## New module: `modules/meal-reviews`

Files:
- `meal-reviews.route.ts`
- `meal-reviews.controller.ts`
- `meal-reviews.service.ts`
- `meal-reviews.validation.ts`

Core service functions:
- `listReviewableMealsForCurrentUser`
- `createMealReview`
- `listMyMealReviews`

## Existing module changes

### `modules/meal-schedules`

Changes needed:
- replace `menu: string` with `menuItems`
- on write, resolve item names from `menuItems` collection and store snapshots
- on read, return the snapshot list
- optionally derive legacy `menu` string during migration

### `modules/meals`

Possible additions:
- helper for finding reviewable registrations
- or keep review logic fully inside the new `meal-reviews` module

Recommendation:
- keep review behavior inside `meal-reviews`
- only reuse shared helpers where necessary

## Query/Write Flow for Review Creation

Recommended service algorithm for `createMealReview`:

1. Validate `registrationId`.
2. Load the registration.
3. Ensure `registration.userId` matches current user.
4. Load the schedule for `registration.serviceDate`.
5. Find the meal config for `registration.mealType`.
6. Ensure the meal has `menuItems`.
7. Ensure current time is after review-open time.
8. Check for existing review by `registrationId`.
9. Compare submitted item ids against schedule menu item ids.
10. Build review snapshot records using schedule snapshot names.
11. Insert review document.

This should use `registrationId` as the main uniqueness anchor.

## Migration Plan

## Phase 1: Add item catalog

- add `menuItems` collection and routes
- no frontend break yet

## Phase 2: Extend schedule storage

- change schedule write path to accept `menuItems`
- keep returning legacy `menu` string derived from snapshot names
- optionally support both old and new payloads temporarily

## Phase 3: Backfill old schedules

Because current schedules store `menu` as one string, there is no clean automatic conversion into item ids unless:
- admins manually map old strings to item records
- or a one-time heuristic mapping script is written

Recommended approach:
- leave historical legacy schedules as-is
- only require `menuItems` for newly edited/newly created schedules
- only allow item-level reviews for schedules that actually have `menuItems`

This avoids unsafe guessing.

## Phase 4: Add meal reviews

- add reviewable-meals endpoint
- add review creation endpoint
- add my-reviews endpoint

## Phase 5: Remove legacy `menu` usage

After frontend is fully migrated:
- stop accepting `menu: string`
- optionally remove the derived `menu` field from responses later

## Backward Compatibility Notes

Historical schedules likely contain only:

```ts
menu: string
```

Because of that:
- those records should not be silently converted into synthetic item ids
- reviews should only be enabled for meals whose schedule contains `menuItems`

Frontend can handle this by:
- showing item-level review only when itemized menu data exists
- otherwise hiding review UI for that registration

## Admin Permissions

Suggested role policy:
- `admin` and `super_admin` can create/update/archive menu items
- `manager` should not modify menu item catalog unless explicitly desired

This should align with existing route-role patterns already used in finance and schedule management.

## Analytics Possibilities Later

This model enables later reporting such as:
- average rating by item
- average rating by item category
- average rating by service date or month
- best/worst performing items
- rating trends over time

None of these are required for initial delivery.

## Risks and Decisions

## Decision: exact item set match vs partial rating

Recommendation:
- require users to rate every item served in that meal

Why:
- simpler backend rules
- more complete analytics
- consistent frontend experience

## Decision: mutable items vs historical meaning

Recommendation:
- always store `nameSnapshot` on schedules and reviews

Why:
- renaming a menu item later should not rewrite historical records

## Decision: delete vs archive

Recommendation:
- archive menu items instead of deleting them

Why:
- safer with existing schedule/review references
- simpler auditability

## Concrete First Implementation Scope

The smallest sensible version is:

1. add `menuItems` collection and admin CRUD
2. update meal schedules to use `menuItems` snapshots
3. keep legacy `menu` string as derived compatibility output
4. add `mealReviews` write/read endpoints
5. only allow reviews for schedules that already have itemized menus

This avoids risky historical backfill and keeps the feature coherent.
