import { Hono } from 'hono';
import type { Env } from '../../types/env';

const route = new Hono<{ Bindings: Env }>();

route.get('/ping', (c) => c.json({ ok: true, route: 'dailyReports' }));

export default route;
