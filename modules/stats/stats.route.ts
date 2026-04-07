import express from 'express';
const verifyFirebaseToken = require('../../middleware/verifyFirebaseToken');
const validateRequest = require('../../middleware/validateRequest');
import { ROLE_POLICIES } from '../shared/authorization';
import {
  getAllTimeStatsSummary,
  getDashboard,
  getExpenseTrend,
  getMealTrend,
  getMealTypeBreakdown,
  getMonthStatsSummary,
  getRunningMealRate,
  getTopMembers,
  getTwoDaySheetStatsSummary
} from './stats.controller';
import {
  allTimeSummaryQuerySchema,
  dashboardQuerySchema,
  expenseTrendQuerySchema,
  mealTrendQuerySchema,
  mealTypeBreakdownQuerySchema,
  monthSummaryQuerySchema,
  runningMealRateQuerySchema,
  topMembersQuerySchema,
  twoDaySheetSummaryQuerySchema
} from './stats.validation';

const router = express.Router();

router.get(
  '/all-time-summary',
  verifyFirebaseToken(),
  validateRequest({ query: allTimeSummaryQuerySchema }),
  getAllTimeStatsSummary
);

router.get(
  '/dashboard',
  verifyFirebaseToken(),
  validateRequest({ query: dashboardQuerySchema }),
  getDashboard
);

router.get(
  '/month-summary',
  verifyFirebaseToken(),
  validateRequest({ query: monthSummaryQuerySchema }),
  getMonthStatsSummary
);

router.get(
  '/meal-trend',
  verifyFirebaseToken(),
  validateRequest({ query: mealTrendQuerySchema }),
  getMealTrend
);

router.get(
  '/expense-trend',
  verifyFirebaseToken(ROLE_POLICIES.memberFinanceManagement),
  validateRequest({ query: expenseTrendQuerySchema }),
  getExpenseTrend
);

router.get(
  '/top-members',
  verifyFirebaseToken(ROLE_POLICIES.memberFinanceManagement),
  validateRequest({ query: topMembersQuerySchema }),
  getTopMembers
);

router.get(
  '/meal-type-breakdown',
  verifyFirebaseToken(),
  validateRequest({ query: mealTypeBreakdownQuerySchema }),
  getMealTypeBreakdown
);

router.get(
  '/two-day-sheet-summary',
  verifyFirebaseToken(),
  validateRequest({ query: twoDaySheetSummaryQuerySchema }),
  getTwoDaySheetStatsSummary
);

router.get(
  '/meal-rate',
  verifyFirebaseToken(),
  validateRequest({ query: runningMealRateQuerySchema }),
  getRunningMealRate
);

export = router;
