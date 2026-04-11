import prisma from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      isAdmin: true,
    }
  });
  
  console.log('Users in database:');
  console.table(users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
