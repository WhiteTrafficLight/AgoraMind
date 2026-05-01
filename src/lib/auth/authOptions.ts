import { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { loggers } from '@/utils/logger';
import { ROUTES } from '@/lib/routes';

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter both email and password");
        }
        
        await connectDB();
        const user = await User.findOne({ email: credentials.email }).select("+password");
        if (!user) {
          throw new Error("No account is registered with this email");
        }
        const isMatch = await user.comparePassword(credentials.password);
        if (!isMatch) {
          throw new Error("Passwords do not match");
        }
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.username,
        };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          await connectDB();
          const existingUser = await User.findOne({ email: user.email });
          if (!existingUser) {
            await User.create({ username: user.name, email: user.email, googleId: user.id });
          } else if (!existingUser.googleId) {
            existingUser.googleId = user.id;
            await existingUser.save();
          }
        } catch (error) {
          loggers.auth.error("Google sign in error:", error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    }
  },
  pages: {
    signIn: ROUTES.login,
    error: ROUTES.login,
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Default export  NextAuth handler
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 