"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const { connectMongoDB } = require('./config/connectMongodb');
const { attachRequestContext } = require('./middleware/requestContext');
const mealSchedulesRouter = require('./modules/meal-schedules/meal-schedules.route');
const usersRouter = require('./modules/users/users.route');
const mealsRouter = require('./modules/meals/meals.route');
const financeRouter = require('./modules/finance/finance.routes');
const mealDeadlinesRouter = require('./modules/meal-deadlines/meal-deadlines.route');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');
const logger_1 = require("./modules/shared/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
        (0, logger_1.logInfo)('server_started', { port });
    });
}).catch((error) => {
    const startupError = error instanceof Error ? error : new Error(String(error));
    (0, logger_1.logError)('server_start_failed', {
        errorName: startupError.name,
        errorMessage: startupError.message,
        stack: startupError.stack
    });
    process.exit(1);
});
