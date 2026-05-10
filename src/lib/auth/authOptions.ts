import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { loggers } from '@/utils/logger';
import { ROUTES } from '@/lib/routes';

/**
 * Single source of truth for NextAuth configuration.
 *
 * Used by:
 *   - src/app/api/auth/[...nextauth]/route.ts (the actual auth handler)
 *   - getServerSession(authOptions) calls in API routes
 *
 * Previously this codebase had three parallel authOptions configs
 * (lib/auth.ts, lib/auth/authOptions.ts, and inline in [...nextauth]
 * route). They drifted independently — most notably, lib/auth.ts wrote
 * `token.id` while the actual auth handler wrote `token.sub`, so
 * session.user.id resolution was inconsistent across routes.
 */

const isGoogleOAuthEnabled =
  process.env.NODE_ENV === 'production' &&
  !!process.env.GOOGLE_CLIENT_ID &&
  !!process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Please enter both email and password');
      }

      await connectDB();

      const user = await User.findOne({ email: credentials.email }).select('+password');
      if (!user) {
        throw new Error('No account found with this email address');
      }

      const isMatch = await user.comparePassword(credentials.password);
      if (!isMatch) {
        throw new Error('Invalid password');
      }

      loggers.auth.info('Successful credential login for user:', user.email);

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.username,
      };
    },
  }),
];

if (isGoogleOAuthEnabled) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  );
  loggers.auth.info('Google OAuth provider enabled');
} else {
  loggers.auth.info(
    'Google OAuth provider disabled - running in development mode or missing credentials',
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          await connectDB();
          const existingUser = await User.findOne({ email: user.email });
          if (existingUser) {
            if (!existingUser.googleId) {
              existingUser.googleId = user.id;
              await existingUser.save();
              loggers.auth.info('Updated existing user with Google ID:', user.email);
            } else {
              loggers.auth.info('Google login for existing user:', user.email);
            }
          } else {
            await User.create({
              username: user.name,
              email: user.email,
              googleId: user.id,
            });
            loggers.auth.info('Created new user via Google:', user.email);
          }
        } catch (error) {
          loggers.auth.error('Google sign in error:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: ROUTES.login,
    signOut: ROUTES.home,
    error: ROUTES.login,
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
