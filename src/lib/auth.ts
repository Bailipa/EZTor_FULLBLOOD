import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { rateLimit, getClientKey } from "@/lib/rateLimit";
import { getRequiredEnvVar } from "@/lib/envValidator";

const SECRET_KEY = getRequiredEnvVar('NEXTAUTH_SECRET');

const AUTH_ERROR_MESSAGE = "用户名或密码错误 / Invalid username or password";

async function simulatePasswordHash(): Promise<void> {
  await bcrypt.hash("dummy_password_for_timing", 10);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        captchaInput: { label: "Captcha", type: "text" },
        captchaHash: { label: "CaptchaHash", type: "text" },
        captchaTimestamp: { label: "CaptchaTimestamp", type: "text" }
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing username or password");
        }

        const clientKey = getClientKey(req as any);
        const rateLimitResult = await rateLimit(clientKey);
        if (!rateLimitResult.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        if (!credentials.captchaInput || !credentials.captchaHash || !credentials.captchaTimestamp) {
          throw new Error("验证码缺失 / Missing captcha");
        }

        const expectedHash = crypto
          .createHmac('sha256', SECRET_KEY)
          .update(`${credentials.captchaInput.toLowerCase()}:${credentials.captchaTimestamp}`)
          .digest('hex');

        if (expectedHash !== credentials.captchaHash) {
          throw new Error("验证码错误 / Invalid captcha");
        }

        const normalizedUsername = credentials.username.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { username: normalizedUsername }
        });

        // 🔧 修复方案：保留自动注册，但改进逻辑
        if (!user) {
          // 用户不存在，自动创建新账户（注册功能）
          await simulatePasswordHash();
          
          const hashedPassword = await bcrypt.hash(credentials.password, 10);
          try {
            const newUser = await prisma.user.create({
              data: {
                username: normalizedUsername,
                password: hashedPassword,
              }
            });
            return { id: newUser.id, name: newUser.username, isAdmin: newUser.isAdmin };
          } catch (error: any) {
            // 如果创建失败（可能是并发创建相同用户名），返回错误
            console.error("Failed to create user:", error);
            if (error.code === 'P2002') {
              // 唯一约束冲突：用户名已存在
              throw new Error("用户名已被注册，请选择其他用户名");
            }
            throw new Error("注册失败，请稍后重试");
          }
        }

        // 用户已存在，验证密码（登录功能）
        if (user.isBanned) {
          const banInfo = user.banReason 
            ? `账户已被封禁：${user.banReason}` 
            : "账户已被封禁 / Account has been banned";
          throw new Error(banInfo);
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error(AUTH_ERROR_MESSAGE);
        }

        return { id: user.id, name: user.username, isAdmin: user.isAdmin };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.sub as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.isAdmin = (user as any).isAdmin;
      }
      return token;
    }
  },
  pages: {
    signIn: "/auth/signin",
  }
};
