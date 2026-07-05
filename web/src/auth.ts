import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { authUsers, authAccounts, authVerificationTokens, students } from '@/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: authUsers,
    accountsTable: authAccounts,
    verificationTokensTable: authVerificationTokens,
  }),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      id: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const [user] = await db
          .select()
          .from(authUsers)
          .where(eq(authUsers.email, credentials.email as string));
        if (!user?.password) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name ?? '', email: user.email ?? '', role: 'teacher' as const };
      },
    }),
    Credentials({
      id: 'student-credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.pin) return null;
        const [student] = await db
          .select()
          .from(students)
          .where(eq(students.username, credentials.username as string));
        if (!student) return null;
        const valid = await bcrypt.compare(credentials.pin as string, student.pinHash);
        if (!valid) return null;
        return {
          id: student.id,
          name: student.displayName,
          email: null,
          role: 'student' as const,
          username: student.username,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      (session.user as { role: 'teacher' | 'student' }).role = (token.role ?? 'student') as 'teacher' | 'student';
      if (token.username) (session.user as { username?: string }).username = token.username as string;
      return session;
    },
  },
});
