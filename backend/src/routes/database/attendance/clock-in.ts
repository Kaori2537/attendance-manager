// backend/src/routes/database/attendance/clock-in.ts
import { Hono } from 'hono';
import { getSupabaseClient } from '../../../../lib/supabase';
import { verify } from 'hono/jwt';
import { todayJSTString } from '../../../../lib/time';
import { Env } from '../../../types/env';

const attendanceClockInRouter = new Hono<{ Bindings: Env }>();

attendanceClockInRouter.post('/', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];

    // JWT 認証
    let payload: { id: string; role: 'admin' | 'user' };
    try {
        payload = await verify(token, c.env.JWT_SECRET) as {
            id: string;
            role: 'admin' | 'user';
        };
    } catch {
        return c.json({ error: 'Invalid token' }, 401);
    }

    const userId = payload.id;
    const supabase = getSupabaseClient(c.env);

    const date = todayJSTString();

    // 1. 今日の attendance_record が存在するか確認
    const { data: record, error: recordErr } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

    if (recordErr) {
        console.error(recordErr);
        return c.json({ error: recordErr.message }, 500);
    }

    let attendanceId = record?.id;

    // 無ければ作る
    if (!attendanceId) {
        const { data: newRecord, error: newRecordErr } = await supabase
            .from('attendance_records')
            .insert({
                user_id: userId,
                date: date,
            })
            .select('id')
            .single();

        if (newRecordErr) {
            console.error(newRecordErr);
            return c.json({ error: newRecordErr.message }, 500);
        }

        attendanceId = newRecord.id;
    }

    // 2. 今日のセッションが既に存在するか確認（1日1セッション制限）
    const { data: existingSession, error: existingSessionErr } = await supabase
        .from('work_sessions')
        .select('id, clock_out')
        .eq('attendance_id', attendanceId)
        .maybeSingle();

    if (existingSessionErr) {
        console.error(existingSessionErr);
        return c.json({ error: existingSessionErr.message }, 500);
    }

    // 既にセッションがある場合
    if (existingSession) {
        // まだ出勤中（clock_out が null）の場合はエラー
        if (!existingSession.clock_out) {
            return c.json({ error: 'Already clocked in' }, 400);
        }
        // 退勤済みの場合は clock_out を null にして再開
        const { error: reopenErr } = await supabase
            .from('work_sessions')
            .update({ clock_out: null })
            .eq('id', existingSession.id);

        if (reopenErr) {
            console.error(reopenErr);
            return c.json({ error: reopenErr.message }, 500);
        }

        return c.json({ success: true, reopened: true });
    }

    // 3. セッションが無ければ新しい work_session を clock_in = now() で作成
    const { error: sessionErr } = await supabase
        .from('work_sessions')
        .insert({
            attendance_id: attendanceId,
            clock_in: new Date().toISOString(),
        });

    if (sessionErr) {
        console.error(sessionErr);
        return c.json({ error: sessionErr.message }, 500);
    }

    return c.json({ success: true });
});

export default attendanceClockInRouter;