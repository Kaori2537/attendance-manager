// backend/src/index.ts
import { Hono } from 'hono';
import databaseRoute from './routes/database';
import authRoute from './routes/auth';
import slackRoute from './routes/slack';
import { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

app.route('/auth', authRoute);
app.route("/database", databaseRoute);
app.route("/slack", slackRoute)
export default app

app.get("/__routes", (c) => {
  // @ts-ignore
  const routes = app.routes?.map((r: any) => ({ method: r.method, path: r.path })) ?? [];
  return c.json(routes);
});
