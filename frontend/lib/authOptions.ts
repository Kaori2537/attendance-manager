import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

type BackendLoginResponse = {
  token?: string;
  access_token?: string;
  accessToken?: string;
  user?: {
    id?: string | number;
    email?: string;
    name?: string;
    role?: string;
  };
  // 返却形式が違う場合に備えて緩く許容
  [key: string]: any;
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "email", type: "text" },
        password: { label: "password", type: "password" },
      },

      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password;

        // 入力不足は即失敗
        if (!email || !password) return null;

        // サーバー用途のURLを優先（NEXT_PUBLICはフォールバック）
        const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

        if (!base) {
          console.error("[auth] API_URL (or NEXT_PUBLIC_API_URL) missing");
          return null;
        }

        const url = `${base.replace(/\/$/, "")}/auth/login`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const raw = await res.text();

          // backend側の失敗をログで見える化
          if (!res.ok) {
            console.error("[auth] backend login failed:", res.status, raw);
            return null;
          }

          let parsed: BackendLoginResponse;
          try {
            parsed = JSON.parse(raw);
          } catch {
            console.error("[auth] backend returned non-json:", raw);
            return null;
          }

          // 返却形式ゆれに耐える
          const backendToken =
            parsed?.token ?? parsed?.access_token ?? parsed?.accessToken;

          const user = parsed?.user ?? parsed?.data?.user ?? parsed?.profile;

          const userId = user?.id ?? user?.user_id ?? parsed?.userId;

          if (!backendToken || !userId) {
            console.error("[auth] login response missing fields:", parsed);
            return null;
          }

          // ✅ NextAuthに渡すuser（jwt callbackで token に詰める）
          return {
            id: String(userId),
            email: user?.email ?? email,
            name: user?.name ?? user?.email ?? email,
            role: user?.role ?? "user",
            apiToken: backendToken,
          } as any;
        } catch (e) {
          console.error("[auth] fetch/login error:", e);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // 初回ログイン時のみ user が入る
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.apiToken = (user as any).apiToken;
        token.email = (user as any).email;
        token.name = (user as any).name;
      }
      return token;
    },

    async session({ session, token }) {
      // session.user を拡張
      (session.user as any).id = token.id;
      (session.user as any).role = token.role;
      (session.user as any).apiToken = token.apiToken;

      if (token.email) (session.user as any).email = token.email;
      if (token.name) (session.user as any).name = token.name;

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  // これがあるとローカルでの事故が減る（未設定なら入れて）
  // secret: process.env.NEXTAUTH_SECRET,
};
