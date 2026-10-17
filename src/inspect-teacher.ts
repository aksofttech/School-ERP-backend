import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const teachers = await prisma.teacher.findMany({
    include: {
      user: true,
      subjects: true,
      timetables: {
        include: { class: true, subject: true },
      },
      homeworks: true,
    },
  });

  console.log(`Found ${teachers.length} teachers:`);
  for (const t of teachers) {
    console.log({
      id: t.id,
      name: `${t.user.firstName} ${t.user.lastName}`,
      email: t.user.email,
      subjects: t.subjects.map((s) => s.name),
      timetableCount: t.timetables.length,
      homeworkCount: t.homeworks.length,
    });
  }

  const classes = await prisma.class.findMany({
    include: {
      students: true,
      exams: {
        include: { results: true },
      },
    },
  });

  console.log('\nClasses count:', classes.length);
  for (const c of classes) {
    console.log({
      className: c.name,
      studentCount: c.students.length,
      examCount: c.exams.length,
      resultCount: c.exams.reduce((acc, e) => acc + e.results.length, 0),
    });
  }
}

main().finally(() => prisma.$disconnect());
