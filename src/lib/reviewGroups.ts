import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

export class GroupLimitError extends Error {
  constructor() {
    super('最多只能创建 3 个自定义词库')
  }
}

// All custom-group creation paths lock the same user row before checking capacity.
export async function lockGroupOwner(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
}

export async function createCustomGroupInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  name: string,
) {
  await lockGroupOwner(tx, userId)
  const count = await tx.reviewGroup.count({ where: { userId, isSystem: false } })
  if (count >= 3) throw new GroupLimitError()
  return tx.reviewGroup.create({
    data: { id: randomUUID(), name, userId, updatedAt: new Date() },
  })
}

export async function createCustomGroup(userId: string, name: string) {
  return prisma.$transaction((tx) => createCustomGroupInTransaction(tx, userId, name))
}
