import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { loggers } from "@/utils/logger";

// Check if Google OAuth should be enabled (only in production or when explicitly configured)
const isGoogleOAuthEnabled = process.env.NODE_ENV === 'production' && 
  process.env.GOOGLE_CLIENT_ID && 
  process.env.GOOGLE_CLIENT_SECRET;

const providers = [
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
      
      // Include password in the selection
      const user = await User.findOne({ email: credentials.email }).select("+password");
      
      if (!user) {
        throw new Error("No account found with this email address");
      }
      
      const isMatch = await user.comparePassword(credentials.password);
      
      if (!isMatch) {
        throw new Error("Invalid password");
      }
      
      loggers.auth.info('Successful credential login for user:', user.email);
      
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.username,
      };
    }
  })
];

// Only add Google provider in production or when explicitly enabled
if (isGoogleOAuthEnabled) {
  providers.unshift(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  }));
  loggers.auth.info('Google OAuth provider enabled');
} else {
  loggers.auth.info('Google OAuth provider disabled - running in development mode or missing credentials');
}

const handler = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          await connectDB();
          
          // Check if user already exists
          const existingUser = await User.findOne({ email: user.email });
          
          if (existingUser) {
            // Update googleId if not already set
            if (!existingUser.googleId) {
              existingUser.googleId = user.id;
              await existingUser.save();
              loggers.auth.info('Updated existing user with Google ID:', user.email);
            } else {
              loggers.auth.info('Google login for existing user:', user.email);
            }
          } else {
            // Create new user
            await User.create({
              username: user.name,
              email: user.email,
              googleId: user.id
            });
            loggers.auth.info('Created new user via Google:', user.email);
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
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST }; 