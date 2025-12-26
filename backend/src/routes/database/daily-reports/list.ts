// backend/src/routes/database/daily-reports/list.ts
import { Hono } from 'hono'
import { getDailyReportSupabaseClient } from '../../../../lib/supabaseDailyReport'
import { verify } from 'hono/jwt'
import { Env } from '../../../types/env'

const dailyReportsListRouter = new Hono<{ Bindings: Env }>()

dailyReportsListRouter.get('/', async (c) => {
  // --- auth ---
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.split(' ')[1]

  if (!c.env.JWT_SECRET) {
    console.error('JWT_SECRET missing')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  let payload: { id: string; role: 'admin' | 'user' }
  try {
    payload = (await verify(token, c.env.JWT_SECRET)) as any
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
  const userId = payload.id

  // --- query params ---
  const year = c.req.query('year')
  const month = c.req.query('month')
  if (!year || !month) {
    return c.json({ error: 'Missing parameters' }, 400)
  }

  const start = `${year}-${month.padStart(2, '0')}-01`
  const endDate = new Date(Number(year), Number(month), 0).getDate()
  const end = `${year}-${month.padStart(2, '0')}-${endDate}`

  const supabase = getDailyReportSupabaseClient(c.env)

  // --- fetch ---
  const { data, error } = await supabase
    .from('daily_reports')
    .select('id, user_id, report_date, content, created_at, updated_at')
    .eq('user_id', userId)
    .gte('report_date', start)
    .lte('report_date', end)
    .order('report_date', { ascending: true })

  if (error) {
    console.error('daily-reports/list supabase error:', JSON.stringify(error, null, 2))
    return c.json({ error: 'Database error', detail: error }, 500)
  }

  const formatted = (data ?? []).map((d) => ({
    id: d.id,
    userId: d.user_id,
    reportDate: d.report_date,
    content: d.content,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }))

  return c.json(formatted)
})

export default dailyReportsListRouter
