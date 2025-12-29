// backend/src/routes/reports/index.ts
import { Hono } from 'hono';
import type { Env } from '../../types/env';

const route = new Hono<{ Bindings: Env }>();

route.get('/ping', (c) => c.json({ ok: true, route: 'reports' }));

export default route;
