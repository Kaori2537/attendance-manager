// backend/src/routes/auth/register.ts
import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { getSupabaseClient } from "../../../lib/supabase";
import type { Env } from "../../types/env";

const authRegister = new Hono<{ Bindings: Env }>();

authRegister.post("/", async (c) => {
  const supabase = getSupabaseClient(c.env);

  // JSON を一旦 body で受けて、型/整形を揃える
  const body = await c.req.json().catch(() => ({} as any));

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();

  // 入力チェック
  if (!email || !password || !name) {
    return c.json({ error: "name, email, password are required" }, 400);
  }

  // 既存チェック（同一email重複防止）
  const { data: existing, error: existingErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingErr) {
    return c.json({ error: existingErr.message }, 500);
  }
  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  // パスワードをハッシュ化
  const hashed = await bcrypt.hash(password, 10);

  // 社員番号（任意）
  const employeeNumber = crypto.randomUUID().slice(0, 8);

  // DB に保存
  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      name,
      hashed_password: hashed,
      employee_number: employeeNumber,
      role: "user",
    })
    // ハッシュは返さない（安全・UI的にも不要）
    .select("id,email,name,employee_number,role,created_at")
    .single();

  if (error) {
    // supabase のエラーをそのまま返すと便利（必要なら message を隠す）
    return c.json({ error: error.message }, 500);
  }

  return c.json({ user: data }, 201);
});

export default authRegister;
