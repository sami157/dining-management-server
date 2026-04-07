import type { Request, Response } from 'express';
const { asyncHandler } = require('../shared/controller.utils');
import {
  getAllTimeSummary,
  getDashboardSummary,
  getExpenseTrendSummary,
  getMealTrendSummary,
  getMealTypeBreakdownSummary,
  getMonthSummary,
  getRunningMealRateSummary,
  getTopMembersSummary,
  getTwoDaySheetSummary
} from './stats.service';
import type {
  AllTimeSummaryQuery,
  DashboardQuery,
  ExpenseTrendQuery,
  MealTrendQuery,
  MealTypeBreakdownQuery,
  MonthSummaryQuery,
  RunningMealRateQuery,
  TopMembersQuery,
  TwoDaySheetSummaryQuery
} from './stats.validation';

const getAllTimeStatsSummary = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAllTimeSummary(req.query as AllTimeSummaryQuery);
  return res.status(200).json(result);
});

const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await getDashboardSummary(req.user?._id, req.query as DashboardQuery);
  return res.status(200).json(result);
});

const getMonthStatsSummary = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMonthSummary(req.query as MonthSummaryQuery);
  return res.status(200).json(result);
});

const getMealTrend = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMealTrendSummary(req.query as MealTrendQuery);
  return res.status(200).json(result);
});

const getExpenseTrend = asyncHandler(async (req: Request, res: Response) => {
  const result = await getExpenseTrendSummary(req.query as ExpenseTrendQuery);
  return res.status(200).json(result);
});

const getTopMembers = asyncHandler(async (req: Request, res: Response) => {
  const result = await getTopMembersSummary(req.query as unknown as TopMembersQuery);
  return res.status(200).json(result);
});

const getMealTypeBreakdown = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMealTypeBreakdownSummary(req.query as MealTypeBreakdownQuery);
  return res.status(200).json(result);
});

const getTwoDaySheetStatsSummary = asyncHandler(async (req: Request, res: Response) => {
  const result = await getTwoDaySheetSummary(req.query as TwoDaySheetSummaryQuery);
  return res.status(200).json(result);
});

const getRunningMealRate = asyncHandler(async (req: Request, res: Response) => {
  const result = await getRunningMealRateSummary(req.query as RunningMealRateQuery);
  return res.status(200).json(result);
});

export {
  getAllTimeStatsSummary,
  getDashboard,
  getMonthStatsSummary,
  getMealTrend,
  getExpenseTrend,
  getTopMembers,
  getMealTypeBreakdown,
  getTwoDaySheetStatsSummary,
  getRunningMealRate
};
