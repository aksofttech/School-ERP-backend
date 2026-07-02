const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const schools = await prisma.school.findMany({
    include: {
      _count: {
        select: { students: true, parents: true, teachers: true }
      }
    }
  });

  console.log('--- Schools ---');
  schools.forEach(s => {
    console.log(`School: ${s.name} (${s.code}) - ID: ${s.id}`);
    console.log(`Counts: Students: ${s._count.students}, Parents: ${s._count.parents}, Teachers: ${s._count.teachers}`);
  });

  const admins = await prisma.user.findMany({
    where: { role: 'SCHOOL_ADMIN' },
    select: { email: true, schoolId: true, school: { select: { name: true } } }
  });

  console.log('\n--- Admins ---');
  admins.forEach(a => {
    console.log(`Admin: ${a.email} - SchoolID: ${a.schoolId} (${a.school?.name || 'No school'})`);
  });
}

check().finally(() => prisma.$disconnect());
