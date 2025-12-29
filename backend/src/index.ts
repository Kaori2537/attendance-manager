import { Hono } from 'hono';
import databaseRoute from './routes/database';
import authRoute from './routes/auth';
import slackRoute from './routes/slack';
import dailyReportsRoute from './routes/dailyReports/index';
import reportsRoute from './routes/reports';
import type { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

app.route('/auth', authRoute);
app.route('/database', databaseRoute);
app.route('/slack', slackRoute);

// 追加
app.route('/daily-reports', dailyReportsRoute);
app.route('/reports', reportsRoute);

app.get('/__routes', (c) => {
  // @ts-ignore
  const routes = app.routes?.map((r: any) => ({ method: r.method, path: r.path })) ?? [];
  return c.json(routes);
});

export default app;
