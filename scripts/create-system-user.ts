/**
 * 创建系统用户
 */

import { PrismaClient } from '@prisma/client';

// 强制设置数据库 URL
process.env.DATABASE_URL = 'file:./prisma/dev.db';

const prisma = new PrismaClient();

async function main() {
  console.log('创建系统用户...');
  
  // 创建系统用户
  const systemUser = await prisma.user.create({
    data: {
      username: 'system',
      password: 'system_password_not_for_login',
      isAdmin: true,
    }
  });
  
  console.log('系统用户创建成功:', systemUser);
  
  // 验证用户是否存在
  const existingUser = await prisma.user.findUnique({
    where: { username: 'system' }
  });
  
  console.log('验证系统用户存在:', existingUser);
  
  // 列出所有用户
  const users = await prisma.user.findMany();
  console.log('所有用户:', users);
  
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('创建系统用户失败:', e);
    process.exit(1);
  });
