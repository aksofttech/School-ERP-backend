import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const school = await prisma.school.findFirst();
  if (!school) return;
  const count = await prisma.fee.count();
  console.log('Total fees:', count);

  const fees = await prisma.fee.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 15,
    include: {
      student: {
        include: {
          user: true,
          class: true,
        },
      },
    },
  });

  console.log('Recent fees (count =', fees.length, '):');
  fees.forEach((f) => {
    console.log(
      f.id.slice(-6),
      f.student.user.firstName,
      f.student.user.lastName,
      f.student.class?.name,
      'Rs.' + f.amount,
      f.status,
      f.updatedAt
    );
  });
}

check().finally(() => prisma.$disconnect());
