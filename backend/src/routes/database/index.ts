// backend/src/routes/database/index.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../../types/env";

import attendanceUsersRouter from "./attendance/users";
import attendanceDayRouter from "./attendance/day";
import attendanceMonthRouter from "./attendance/month";
import attendanceClockInRouter from "./attendance/clock-in";
import attendanceClockOutRouter from "./attendance/clock-out";
import attendanceBreakStartRouter from "./attendance/break-start";
import attendanceBreakEndRouter from "./attendance/break-end";
import attendanceWeekTotalHoursRouter from "./attendance/week-total-hours";
import attendanceUserMonthRouter from "./attendance/user-month";
import attendanceGetUserDateSessions from "./attendance/get-user-date-work-sessions";
import attendanceUpdateUserDateSessions from "./attendance/update-user-date-work-sessions";

import dailyReportsListRouter from "./daily-reports/list";
import dailyReportsGetByDateRouter from "./daily-reports/get-by-date";
import dailyReportsUpdateSessionRouter from "./daily-reports/update-session";
import dailyReportsUpsertFromDashboardRouter from "./daily-reports/upsert-from-dashboard";
import upsertFromDashboard from "./daily-reports/upsert-from-dashboard";
import dailyReportsAddSlackReactionRouter from "./daily-reports/add-slack-reaction";
import adminUsersRouter from "./admin/users";
import adminDailyReportsRouter from "./admin/daily-reports";
import dailyReportsCommentsRouter from "./daily-reports/comments";
import dailyReportsAddSlackCommentRouter from "./daily-reports/add-slack-comment";



const database = new Hono<{ Bindings: Env }>();

database.use("*", cors());

// attendance
database.route("/attendance/update-user-date-work-sessions", attendanceUpdateUserDateSessions);
database.route("/attendance/get-user-date-work-sessions", attendanceGetUserDateSessions);
database.route("/attendance/users", attendanceUsersRouter);
database.route("/attendance/user-month", attendanceUserMonthRouter);
database.route("/attendance/day", attendanceDayRouter);
database.route("/attendance/month", attendanceMonthRouter);
database.route("/attendance/clock-in", attendanceClockInRouter);
database.route("/attendance/clock-out", attendanceClockOutRouter);
database.route("/attendance/break-start", attendanceBreakStartRouter);
database.route("/attendance/break-end", attendanceBreakEndRouter);
database.route("/attendance/week-total-hours", attendanceWeekTotalHoursRouter);

// daily-reports
database.route("/daily-reports/list", dailyReportsListRouter);
database.route("/daily-reports/get-by-date", dailyReportsGetByDateRouter);
database.route("/daily-reports/update-session", dailyReportsUpdateSessionRouter);
database.route("/daily-reports/upsert-from-dashboard", dailyReportsUpsertFromDashboardRouter);
database.route("/daily-reports/upsert-from-dashboard", upsertFromDashboard);
database.route("/daily-reports/add-slack-reaction", dailyReportsAddSlackReactionRouter);

// admin
database.route("/admin/users", adminUsersRouter);
database.route("/admin/daily-reports", adminDailyReportsRouter);

// daily-reports (comments)
database.route("/daily-reports/comments", dailyReportsCommentsRouter);
database.route("/daily-reports/add-slack-comment", dailyReportsAddSlackCommentRouter);


export default database;
