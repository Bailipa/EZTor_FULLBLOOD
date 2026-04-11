import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  
  if (!username) {
    console.log('用法: npx tsx scripts/set-admin.ts <username>');
    console.log('示例: npx tsx scripts/set-admin.ts myuser');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user) {
    console.log(`用户 "${username}" 不存在`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { username },
    data: { isAdmin: true }
  });

  console.log(`✅ 用户 "${username}" 已设置为管理员`);
  console.log(`   ID: ${updated.id}`);
  console.log(`   isAdmin: ${updated.isAdmin}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
