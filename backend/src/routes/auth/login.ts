import { Hono } from 'hono';
import { getSupabaseClient } from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import type { Env } from '../../types/env';

const loginRouter = new Hono<{ Bindings: Env }>();

loginRouter.post('/', async (c) => {
  try {
    // envチェック（ログに出す）
    console.log('[login] env', {
      SUPABASE_URL: !!c.env.SUPABASE_URL,
      SERVICE_ROLE_KEY: !!(c.env as any).SERVICE_ROLE_KEY,
      JWT_SECRET: !!c.env.JWT_SECRET,
    });

    const { email, password } = await c.req.json().catch(() => ({} as any));

    if (!email || !password) {
      return c.json({ ok: false, error: 'Missing email or password' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // emailは正規化（登録側と合わせる）
    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (error || !user) {
      return c.json({ ok: false, error: 'Invalid credentials' }, 401);
    }

    const isValid = bcrypt.compareSync(String(password), user.hashed_password);
    if (!isValid) {
      return c.json({ ok: false, error: 'Invalid credentials' }, 401);
    }

    if (!c.env.JWT_SECRET) {
      return c.json({ ok: false, error: 'Missing env: JWT_SECRET' }, 500);
    }

    const payload = {
      id: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    };

    const token = await sign(payload, c.env.JWT_SECRET);

    return c.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e: any) {
    console.error('[login] error', e);
    return c.json(
      { ok: false, error: String(e?.message ?? e), stack: e?.stack },
      500
    );
  }
});

export default loginRouter;
