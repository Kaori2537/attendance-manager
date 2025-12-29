import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { Env } from '../../../types/env'
import { createClient } from '@supabase/supabase-js'

const route = new Hono<{ Bindings: Env }>()

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function getSupabase(c: any) {
  const url = c.env?.SUPABASE_URL
  const key = c.env?.SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      `Missing env: SUPABASE_URL or SERVICE_ROLE_KEY (SUPABASE_URL=${!!url}, SERVICE_ROLE_KEY=${!!key})`
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function ensureThreeSessions(sb: any, dailyReportId: string) {
  const { data: sessions, error } = await sb
    .from('daily_report_sessions')
    .select('*')
    .eq('daily_report_id', dailyReportId)
    .order('session_no', { ascending: true })

  if (error) throw new Error(`sessions select: ${error.message}`)

  const existing = sessions ?? []
  const existingNos = new Set(existing.map((s: any) => s.session_no))

  const toInsert = [1, 2, 3]
    .filter((no) => !existingNos.has(no))
    .map((no) => ({
      daily_report_id: dailyReportId,
      session_no: no,
      planned_minutes: 0,
      actual_minutes: 0,
    }))

  if (toInsert.length > 0) {
    const ins = await sb.from('daily_report_sessions').insert(toInsert).select('*')
    if (ins.error) throw new Error(`sessions insert: ${ins.error.message}`)

    const again = await sb
      .from('daily_report_sessions')
      .select('*')
      .eq('daily_report_id', dailyReportId)
      .order('session_no', { ascending: true })

    if (again.error) throw new Error(`sessions re-select: ${again.error.message}`)
    return again.data ?? []
  }

  return existing
}

/**
 * GET /database/daily-reports/get-by-date?date=YYYY-MM-DD[&userId=uuid]
 * - user: 自分の分のみ
 * - admin: userId 指定があればそれを優先
 */
route.get('/', async (c) => {
  try {
    // --- auth ---
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ ok: false, error: 'Unauthorized' }, 401)
    }
    const token = authHeader.split(' ')[1]

    if (!c.env.JWT_SECRET) {
      console.error('JWT_SECRET missing')
      return c.json({ ok: false, error: 'Server configuration error' }, 500)
    }

    let payload: { id: string; role: 'admin' | 'user' }
    try {
      payload = (await verify(token, c.env.JWT_SECRET)) as any
    } catch {
      return c.json({ ok: false, error: 'Invalid token' }, 401)
    }

    // --- params ---
    const date = c.req.query('date')
    if (!date || !isValidDate(date)) {
      return c.json({ ok: false, error: 'date is required (YYYY-MM-DD)' }, 400)
    }

    // admin だけ userId 指定を許可（なければ自分）
    const requestedUserId = c.req.query('userId')
    const userId =
      payload.role === 'admin' && requestedUserId ? requestedUserId : payload.id

    const sb = getSupabase(c)

    // 1) daily_reports を取得（なければ作成）
    let { data: report, error: reportErr } = await sb
      .from('daily_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('report_date', date)
      .maybeSingle()

    if (reportErr) {
      console.error('daily_reports select error:', reportErr)
      return c.json({ ok: false, error: reportErr.message, detail: reportErr }, 500)
    }

    if (!report) {
      const ins = await sb
        .from('daily_reports')
        .insert({ user_id: userId, report_date: date, content: '' })
        .select('*')
        .single()

      // UNIQUE 制約がある場合は競合し得るので、競合だったら再selectでもOK
      if (ins.error) {
        console.error('daily_reports insert error:', ins.error)
        return c.json({ ok: false, error: ins.error.message, detail: ins.error }, 500)
      }
      report = ins.data
    }

    // 2) sessions（必ず1〜3）
    const sessions = await ensureThreeSessions(sb, report.id)
    const sessionIds = sessions.map((s: any) => s.id)

    // 3) tasks
    const tasksRes =
      sessionIds.length === 0
        ? { data: [], error: null as any }
        : await sb
            .from('daily_report_tasks')
            .select('*')
            .in('session_id', sessionIds)
            .order('kind', { ascending: true })
            .order('sort_order', { ascending: true })

    if (tasksRes.error) {
      console.error('tasks select error:', tasksRes.error)
      return c.json({ ok: false, error: tasksRes.error.message, detail: tasksRes.error }, 500)
    }

    const tasks = tasksRes.data ?? []

    const tasksBySession = new Map<string, { planned: any[]; actual: any[] }>()
    for (const t of tasks) {
      const bucket = tasksBySession.get(t.session_id) ?? { planned: [], actual: [] }
      if (t.kind === 'planned') bucket.planned.push(t)
      else bucket.actual.push(t)
      tasksBySession.set(t.session_id, bucket)
    }

    const sessionsWithTasks = sessions.map((s: any) => ({
      ...s,
      plannedTasks: tasksBySession.get(s.id)?.planned ?? [],
      actualTasks: tasksBySession.get(s.id)?.actual ?? [],
    }))

    return c.json({ ok: true, userId, date, dailyReport: report, sessions: sessionsWithTasks })
  } catch (e: any) {
    console.error('get-by-date uncaught:', e)
    return c.json({ ok: false, error: e?.message ?? String(e) }, 500)
  }
})

export default route
