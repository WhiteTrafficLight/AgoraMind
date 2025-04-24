import { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

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
          throw new Error("이메일과 비밀번호를 모두 입력하세요");
        }
        
        await connectDB();
        const user = await User.findOne({ email: credentials.email }).select("+password");
        if (!user) {
          throw new Error("해당 이메일로 등록된 계정이 없습니다");
        }
        const isMatch = await user.comparePassword(credentials.password);
        if (!isMatch) {
          throw new Error("비밀번호가 일치하지 않습니다");
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
          console.error("Google sign in error:", error);
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
};

// Default export for NextAuth handler
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 