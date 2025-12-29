import { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "email", type: "text" },
        password: { label: "password", type: "password" },
      },

      async authorize(credentials) {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/auth/login`;

        console.log("NEXT_PUBLIC_API_URL:", process.env.NEXT_PUBLIC_API_URL);
        console.log("login url:", url);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
          }),
        });

        const text = await res.text();
        console.log("login response:", res.status, text);

        if (!res.ok) return null;

        const { token, user } = JSON.parse(text);

        return {
          ...user,
          token, // backend JWT
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.apiToken = (user as any).token;
      }
      return token;
    },

    async session({ session, token }) {
      (session.user as any).id = token.id;
      (session.user as any).role = token.role;
      (session.user as any).apiToken = token.apiToken;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};
