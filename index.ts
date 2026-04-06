import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
const { connectMongoDB } = require('./config/connectMongodb');
const { attachRequestContext } = require('./middleware/requestContext');
const mealSchedulesRouter = require('./modules/meal-schedules/meal-schedules.route');
const usersRouter = require('./modules/users/users.route');
const mealsRouter = require('./modules/meals/meals.route');
const financeRouter = require('./modules/finance/finance.routes');
const mealDeadlinesRouter = require('./modules/meal-deadlines/meal-deadlines.route');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');
import { logError, logInfo } from './modules/shared/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(attachRequestContext);

app.use('/managers', mealSchedulesRouter);
app.use('/meal-schedules', mealSchedulesRouter);
app.use('/users', usersRouter);
app.use('/meals', mealsRouter);
app.use('/users/meals', mealsRouter);
app.use('/finance', financeRouter);
app.use('/meal-deadlines', mealDeadlinesRouter);

app.get('/', (req, res) => {
  res.send('Dining Management System server is running');
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

connectMongoDB().then(() => {
  app.listen(port, () => {
    logInfo('server_started', { port });
  });
}).catch((error: unknown) => {
  const startupError = error instanceof Error ? error : new Error(String(error));
  logError('server_start_failed', {
    errorName: startupError.name,
    errorMessage: startupError.message,
    stack: startupError.stack
  });
  process.exit(1);
});

