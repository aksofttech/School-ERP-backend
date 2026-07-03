import { PrismaClient, Role, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start Seeding...');

  // 0. Cleanup (Recommended to clear existing data to ensure UUID consistency)
  console.log('Cleaning up database...');
  await prisma.auditLog.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.book.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.examResult.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.section.deleteMany();
  await prisma.class.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();

  // 1. Passwords
  const adminYugsoftPassword = await bcrypt.hash('Password@123', 10);
  const adminSchoolPassword = await bcrypt.hash('Admin@123', 10);
  const commonPassword = await bcrypt.hash('Password@123', 10);

  // 2. School
  const school = await prisma.school.upsert({
    where: { code: 'SCH-001' },
    update: {},
    create: {
      name: 'Yug Soft-Tech International School',
      code: 'SCH-001',
      address: '123 Education Hub, Kota, Rajasthan',
      phone: '0141-22334455',
      email: 'contact@yugsoft.com',
    },
  });

  console.log('✅ School created');

  // 3. Admin (2 Admins)
  const adminUser1 = await prisma.user.upsert({
    where: { email: 'admin@yugsoft.com' },
    update: {
      password: adminYugsoftPassword,
    },
    create: {
      email: 'admin@yugsoft.com',
      password: adminYugsoftPassword,
      role: Role.SCHOOL_ADMIN,
      firstName: 'Yug',
      lastName: 'Admin',
      phone: '9000000001',
      schoolId: school.id,
    },
  });

  const adminUser2 = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {
      password: adminSchoolPassword,
    },
    create: {
      email: 'admin@school.com',
      password: adminSchoolPassword,
      role: Role.SCHOOL_ADMIN,
      firstName: 'Main',
      lastName: 'Admin',
      phone: '9000000002',
      schoolId: school.id,
    },
  });
  console.log('✅ Admins created');

  // 4. Classes (15 Classes: Nursery to 12th)
  const classNames = [
    'Nursery', 'LKG', 'UKG', '1st', '2nd', 
    '3rd', '4th', '5th', '6th', '7th', 
    '8th', '9th', '10th', '11th', '12th'
  ];
  const classes = [];
  const sectionsMap: Record<string, any> = {};

  for (const name of classNames) {
    const cls = await prisma.class.create({
      data: {
        name: `Class ${name}`,
        schoolId: school.id,
      },
    });
    classes.push(cls);
    
    // Each class has one section 'A'
    const section = await prisma.section.create({
      data: {
        name: 'A',
        classId: cls.id,
        schoolId: school.id,
      },
    });
    sectionsMap[name] = section;
  }
  console.log(`✅ ${classes.length} Classes and Sections created`);

  // 5. Teachers (10 Teachers)
  const teachers = [];
  for (let i = 1; i <= 10; i++) {
    const email = `teacher${i}@yugsoft.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password: commonPassword,
        role: Role.TEACHER,
        firstName: `Teacher`,
        lastName: `${i}`,
        phone: `800000000${i}`,
        schoolId: school.id,
      },
    });

    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        qualification: i % 2 === 0 ? 'M.Ed' : 'B.Ed',
        experience: 2 + i,
        schoolId: school.id,
      },
    });
    teachers.push(teacher);
  }
  console.log('✅ 10 Teachers created');

  // 6. Parents (18 Parents)
  const parentRecords = [];
  for (let i = 1; i <= 18; i++) {
    const email = `parent${i}@yugsoft.com`;
    const user = await prisma.user.create({
      data: {
        email,
        password: commonPassword,
        role: Role.PARENT,
        firstName: `Parent`,
        lastName: `${i}`,
        phone: `70000000${i.toString().padStart(2, '0')}`,
        schoolId: school.id,
      },
    });

    const parent = await prisma.parent.create({
      data: {
        userId: user.id,
        schoolId: school.id,
      },
    });
    parentRecords.push(parent);
  }
  console.log('✅ 18 Parents created');

  // 7. Students (25 Students)
  // Logic: 7 parents have 2 children, 11 parents have 1 child. (7*2 + 11 = 25)
  const studentData = [];
  let studentCount = 0;

  for (let i = 0; i < 18; i++) {
    const parent = parentRecords[i];
    const childrenCount = i < 7 ? 2 : 1; // First 7 parents get 2 kids, others get 1

    for (let c = 0; c < childrenCount; c++) {
      studentCount++;
      const email = `student${studentCount}@yugsoft.com`;
      
      const user = await prisma.user.create({
        data: {
          email,
          password: commonPassword,
          role: Role.STUDENT,
          firstName: `Student`,
          lastName: `${studentCount}`,
          phone: `60000000${studentCount.toString().padStart(2, '0')}`,
          schoolId: school.id,
        },
      });

      // Assign to a class (cycling through 15 classes)
      const classIdx = (studentCount - 1) % classes.length;
      const targetClass = classes[classIdx];
      const targetSection = sectionsMap[classNames[classIdx]];

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          rollNumber: `ROLL-${studentCount.toString().padStart(3, '0')}`,
          gender: studentCount % 2 === 0 ? Gender.MALE : Gender.FEMALE,
          dob: new Date(2010 + (studentCount % 5), 0, 1),
          schoolId: school.id,
          classId: targetClass.id,
          sectionId: targetSection.id,
          parents: {
            connect: { id: parent.id }
          }
        },
      });
      studentData.push(student);
    }
  }
  console.log('✅ 25 Students created and linked to parents');

  // 8. Announcements
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Holi Holiday Notice',
        content: 'Dear Parents, the school will remain closed on 25th March for Holi.',
        type: 'HOLIDAY',
        priority: 'MEDIUM',
        allSchool: true,
        authorId: adminUser1.id,
        authorName: 'Yug Admin',
      },
      {
        title: 'Mid-Term Exam Schedule',
        content: 'The mid-term exams for Class 10th will start from next Monday.',
        type: 'EXAM',
        priority: 'HIGH',
        allSchool: false,
        classId: classes.find(c => c.name === 'Class 10th')?.id,
        authorId: adminUser1.id,
        authorName: 'Yug Admin',
      },
      {
        title: 'Annual Sports Day',
        content: 'Get ready for the Annual Sports Day on 15th April!',
        type: 'EVENT',
        priority: 'LOW',
        allSchool: true,
        authorId: adminUser1.id,
        authorName: 'Yug Admin',
      }
    ]
  });
  console.log('✅ 3 Announcements created');

  console.log('🌱 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
