import { PrismaClient, Role, Gender, NotificationType, AttendanceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Start Seeding realistic school data...');

  // 0. Cleanup existing records
  console.log('🧹 Cleaning up database...');
  await prisma.vehicle.deleteMany().catch(() => {});
  await prisma.auditLog.deleteMany().catch(() => {});
  await prisma.notice.deleteMany().catch(() => {});
  await prisma.announcement.deleteMany().catch(() => {});
  await prisma.book.deleteMany().catch(() => {});
  await prisma.attendance.deleteMany().catch(() => {});
  await prisma.examResult.deleteMany().catch(() => {});
  await prisma.exam.deleteMany().catch(() => {});
  await prisma.fee.deleteMany().catch(() => {});
  await prisma.homework.deleteMany().catch(() => {});
  await prisma.timetable.deleteMany().catch(() => {});
  await prisma.subject.deleteMany().catch(() => {});
  await prisma.student.deleteMany().catch(() => {});
  await prisma.teacher.deleteMany().catch(() => {});
  await prisma.parent.deleteMany().catch(() => {});
  await prisma.section.deleteMany().catch(() => {});
  await prisma.class.deleteMany().catch(() => {});
  await prisma.school.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});

  // Common password for testing
  const defaultPassword = await bcrypt.hash('School@123', 10);

  // 1. School Creation
  const school = await prisma.school.create({
    data: {
      name: 'Vidya Mandir Senior Secondary School',
      code: 'VMSSS-JPR',
      address: 'Plot 42, Knowledge Park, Mansarovar, Jaipur, Rajasthan',
      phone: '0141-2789100',
      email: 'contact@vidyamandir.edu.in',
    },
  });
  console.log(`✅ School created: ${school.name}`);

  // 2. Super Admin (Platform / Multi-School Owner)
  try {
    await prisma.user.create({
      data: {
        email: 'superadmin@yugsoft.com',
        password: defaultPassword,
        role: Role.SUPER_ADMIN,
        firstName: 'Ajeet',
        lastName: 'Ojha',
        phone: '9829000001',
        schoolId: null,
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
    });
  } catch {
    // Fallback if schema enforces non-nullable schoolId
    await prisma.user.create({
      data: {
        email: 'superadmin@yugsoft.com',
        password: defaultPassword,
        role: Role.SCHOOL_ADMIN,
        firstName: 'Ajeet',
        lastName: 'Ojha',
        phone: '9829000001',
        schoolId: school.id,
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
    });
  }
  console.log('✅ Super Admin created (superadmin@yugsoft.com)');

  // 3. School Admin & Principal
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@vidyamandir.edu.in',
      password: defaultPassword,
      role: Role.SCHOOL_ADMIN,
      firstName: 'Vikram',
      lastName: 'Rathore',
      phone: '9829011111',
      schoolId: school.id,
      createdAt: new Date('2026-02-10T10:00:00Z'),
    },
  });

  const principalUser = await prisma.user.create({
    data: {
      email: 'principal@vidyamandir.edu.in',
      password: defaultPassword,
      role: Role.SCHOOL_ADMIN,
      firstName: 'Dr. Meenakshi',
      lastName: 'Sharma',
      phone: '9829022222',
      schoolId: school.id,
      createdAt: new Date('2026-02-25T10:00:00Z'),
    },
  });
  console.log('✅ School Admin & Principal created');

  // 4. Classes (Nursery to 12th) & Section 'A'
  const classLevels = [
    'Nursery', 'LKG', 'UKG', '1st', '2nd',
    '3rd', '4th', '5th', '6th', '7th',
    '8th', '9th', '10th', '11th', '12th',
  ];

  const classMap: Record<string, any> = {};
  const sectionMap: Record<string, any> = {};

  for (const lvl of classLevels) {
    const cls = await prisma.class.create({
      data: {
        name: `Class ${lvl}`,
        schoolId: school.id,
      },
    });
    classMap[lvl] = cls;

    const sec = await prisma.section.create({
      data: {
        name: 'A',
        classId: cls.id,
        schoolId: school.id,
      },
    });
    sectionMap[lvl] = sec;
  }
  console.log(`✅ ${classLevels.length} Classes & Sections created`);

  // 5. Teachers
  const teacherProfiles = [
    { first: 'Rajesh', last: 'Sharma', qual: 'M.Sc, B.Ed', exp: 8, email: 'rajesh.sharma@vidyamandir.edu.in', phone: '9829033001', registeredAt: new Date('2026-03-14T10:00:00Z') },
    { first: 'Sunita', last: 'Verma', qual: 'M.A, B.Ed', exp: 6, email: 'sunita.verma@vidyamandir.edu.in', phone: '9829033002', registeredAt: new Date('2026-03-28T10:00:00Z') },
    { first: 'Amit', last: 'Choudhary', qual: 'B.Tech, B.Ed', exp: 5, email: 'amit.choudhary@vidyamandir.edu.in', phone: '9829033003', registeredAt: new Date('2026-04-12T10:00:00Z') },
    { first: 'Pooja', last: 'Mishra', qual: 'M.Com, B.Ed', exp: 7, email: 'pooja.mishra@vidyamandir.edu.in', phone: '9829033004', registeredAt: new Date('2026-05-05T10:00:00Z') },
    { first: 'Dinesh', last: 'Pareek', qual: 'M.P.Ed', exp: 10, email: 'dinesh.pareek@vidyamandir.edu.in', phone: '9829033005', registeredAt: new Date('2026-06-18T10:00:00Z') },
    { first: 'Kavita', last: 'Joshi', qual: 'M.A (English)', exp: 4, email: 'kavita.joshi@vidyamandir.edu.in', phone: '9829033006', registeredAt: new Date('2026-07-08T10:00:00Z') },
  ];

  for (const t of teacherProfiles) {
    const u = await prisma.user.create({
      data: {
        email: t.email,
        password: defaultPassword,
        role: Role.TEACHER,
        firstName: t.first,
        lastName: t.last,
        phone: t.phone,
        schoolId: school.id,
        createdAt: t.registeredAt,
      },
    });

    await prisma.teacher.create({
      data: {
        userId: u.id,
        qualification: t.qual,
        experience: t.exp,
        schoolId: school.id,
      },
    });
  }
  console.log(`✅ ${teacherProfiles.length} Teachers registered`);

  // 6. Core Subjects
  const coreSubjects = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies'];
  for (const subName of coreSubjects) {
    await prisma.subject.create({
      data: {
        name: subName,
        code: subName.substring(0, 4).toUpperCase(),
        schoolId: school.id,
      },
    }).catch(() => {});
  }
  console.log('✅ Core Subjects registered');

  // 7. Parents & Students
  const parentStudentProfiles = [
    {
      parent: { first: 'Sanjay', last: 'Agarwal', email: 'sanjay.agarwal@gmail.com', phone: '9829044001', registeredAt: new Date('2026-07-20T10:00:00Z') },
      children: [
        { first: 'Aarav', last: 'Agarwal', roll: 'VM-101', gender: Gender.MALE, classLvl: '10th', dob: '2009-04-12', registeredAt: new Date('2026-07-20T10:00:00Z') },
        { first: 'Ananya', last: 'Agarwal', roll: 'VM-102', gender: Gender.FEMALE, classLvl: '7th', dob: '2012-08-20', registeredAt: new Date('2026-08-05T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Manoj', last: 'Gupta', email: 'manoj.gupta@gmail.com', phone: '9829044002', registeredAt: new Date('2026-08-22T10:00:00Z') },
      children: [
        { first: 'Rohan', last: 'Gupta', roll: 'VM-103', gender: Gender.MALE, classLvl: '9th', dob: '2010-02-15', registeredAt: new Date('2026-08-22T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Ritu', last: 'Singhal', email: 'ritu.singhal@gmail.com', phone: '9829044003', registeredAt: new Date('2026-09-10T10:00:00Z') },
      children: [
        { first: 'Khushi', last: 'Singhal', roll: 'VM-104', gender: Gender.FEMALE, classLvl: '5th', dob: '2014-11-05', registeredAt: new Date('2026-09-25T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Prakash', last: 'Soni', email: 'prakash.soni@gmail.com', phone: '9829044004', registeredAt: new Date('2026-10-04T10:00:00Z') },
      children: [
        { first: 'Yash', last: 'Soni', roll: 'VM-105', gender: Gender.MALE, classLvl: '10th', dob: '2009-09-18', registeredAt: new Date('2026-10-12T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Vikram', last: 'Sharma', email: 'vikram.sharma.p@gmail.com', phone: '9829044005', registeredAt: new Date('2026-06-15T10:00:00Z') },
      children: [
        { first: 'Vivaan', last: 'Sharma', roll: 'VM-N01', gender: Gender.MALE, classLvl: 'Nursery', dob: '2022-05-10', registeredAt: new Date('2026-06-15T10:00:00Z') },
        { first: 'Aadhya', last: 'Sharma', roll: 'VM-N02', gender: Gender.FEMALE, classLvl: 'Nursery', dob: '2022-08-14', registeredAt: new Date('2026-06-15T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Anil', last: 'Meena', email: 'anil.meena@gmail.com', phone: '9829044006', registeredAt: new Date('2026-06-20T10:00:00Z') },
      children: [
        { first: 'Reyansh', last: 'Meena', roll: 'VM-L01', gender: Gender.MALE, classLvl: 'LKG', dob: '2021-03-22', registeredAt: new Date('2026-06-20T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Deepak', last: 'Choudhary', email: 'deepak.choudhary@gmail.com', phone: '9829044007', registeredAt: new Date('2026-06-22T10:00:00Z') },
      children: [
        { first: 'Kabir', last: 'Choudhary', roll: 'VM-U01', gender: Gender.MALE, classLvl: 'UKG', dob: '2020-04-15', registeredAt: new Date('2026-06-22T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Sunil', last: 'Khandelwal', email: 'sunil.khandelwal@gmail.com', phone: '9829044008', registeredAt: new Date('2026-07-01T10:00:00Z') },
      children: [
        { first: 'Aarav', last: 'Khandelwal', roll: 'VM-101A', gender: Gender.MALE, classLvl: '1st', dob: '2019-02-12', registeredAt: new Date('2026-07-01T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Kamal', last: 'Soni', email: 'kamal.soni@gmail.com', phone: '9829044009', registeredAt: new Date('2026-07-05T10:00:00Z') },
      children: [
        { first: 'Advik', last: 'Soni', roll: 'VM-201', gender: Gender.MALE, classLvl: '2nd', dob: '2018-06-18', registeredAt: new Date('2026-07-05T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Mahendra', last: 'Rathore', email: 'mahendra.rathore@gmail.com', phone: '9829044010', registeredAt: new Date('2026-07-10T10:00:00Z') },
      children: [
        { first: 'Shaurya', last: 'Rathore', roll: 'VM-301', gender: Gender.MALE, classLvl: '3rd', dob: '2017-01-20', registeredAt: new Date('2026-07-10T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Mukesh', last: 'Yadav', email: 'mukesh.yadav@gmail.com', phone: '9829044011', registeredAt: new Date('2026-07-12T10:00:00Z') },
      children: [
        { first: 'Atharv', last: 'Yadav', roll: 'VM-401', gender: Gender.MALE, classLvl: '4th', dob: '2016-04-09', registeredAt: new Date('2026-07-12T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Rajendra', last: 'Bhardwaj', email: 'rajendra.bhardwaj@gmail.com', phone: '9829044012', registeredAt: new Date('2026-07-15T10:00:00Z') },
      children: [
        { first: 'Dhruv', last: 'Bhardwaj', roll: 'VM-601', gender: Gender.MALE, classLvl: '6th', dob: '2014-05-16', registeredAt: new Date('2026-07-15T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Alok', last: 'Mathur', email: 'alok.mathur@gmail.com', phone: '9829044013', registeredAt: new Date('2026-07-18T10:00:00Z') },
      children: [
        { first: 'Samarth', last: 'Mathur', roll: 'VM-801', gender: Gender.MALE, classLvl: '8th', dob: '2012-03-11', registeredAt: new Date('2026-07-18T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Naveen', last: 'Tiwari', email: 'naveen.tiwari@gmail.com', phone: '9829044014', registeredAt: new Date('2026-07-22T10:00:00Z') },
      children: [
        { first: 'Harsh', last: 'Tiwari', roll: 'VM-1101', gender: Gender.MALE, classLvl: '11th', dob: '2009-02-18', registeredAt: new Date('2026-07-22T10:00:00Z') },
      ],
    },
    {
      parent: { first: 'Girish', last: 'Kulshrestha', email: 'girish.k@gmail.com', phone: '9829044015', registeredAt: new Date('2026-07-25T10:00:00Z') },
      children: [
        { first: 'Manan', last: 'Kulshrestha', roll: 'VM-1201', gender: Gender.MALE, classLvl: '12th', dob: '2008-01-15', registeredAt: new Date('2026-07-25T10:00:00Z') },
      ],
    },
  ];

  const createdStudents: any[] = [];
  for (const family of parentStudentProfiles) {
    const pUser = await prisma.user.create({
      data: {
        email: family.parent.email,
        password: defaultPassword,
        role: Role.PARENT,
        firstName: family.parent.first,
        lastName: family.parent.last,
        phone: family.parent.phone,
        schoolId: school.id,
        createdAt: family.parent.registeredAt,
      },
    });

    const parent = await prisma.parent.create({
      data: {
        userId: pUser.id,
        schoolId: school.id,
      },
    });

    for (const kid of family.children) {
      const sUser = await prisma.user.create({
        data: {
          email: `${kid.first.toLowerCase()}.${kid.last.toLowerCase()}@student.edu.in`,
          password: defaultPassword,
          role: Role.STUDENT,
          firstName: kid.first,
          lastName: kid.last,
          phone: family.parent.phone,
          schoolId: school.id,
          createdAt: kid.registeredAt,
        },
      });

      const studentRecord = await prisma.student.create({
        data: {
          userId: sUser.id,
          rollNumber: kid.roll,
          gender: kid.gender,
          dob: new Date(kid.dob),
          schoolId: school.id,
          classId: classMap[kid.classLvl].id,
          sectionId: sectionMap[kid.classLvl].id,
          parents: {
            connect: { id: parent.id },
          },
        },
      });
      createdStudents.push(studentRecord);
    }
  }
  console.log('✅ Parents and Students populated');

  // 8. Transport Vehicles
  const vehiclesData = [
    {
      number: 'RJ-14-PA-2024',
      driver: 'Ramesh Chand Sharma',
      phone: '+91 98291 12345',
      model: 'Tata Starbus Ultra (40 Seater)',
      capacity: 40,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PB-4089',
      driver: 'Suresh Kumar Verma',
      phone: '+91 98292 23456',
      model: 'Eicher Skyline Pro (32 Seater)',
      capacity: 32,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PC-7712',
      driver: 'Dharmendra Singh',
      phone: '+91 98293 34567',
      model: 'Force Traveller (20 Seater)',
      capacity: 20,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PD-9901',
      driver: 'Mahesh Kumar Sharma',
      phone: '+91 98294 45678',
      model: 'Ashok Leyland Oyster (45 Seater)',
      capacity: 45,
      schoolId: school.id,
    },
    {
      number: 'RJ-14-PE-5520',
      driver: 'Vikram Rawat',
      phone: '+91 98295 56789',
      model: 'Swaraj Mazda School Bus',
      capacity: 36,
      schoolId: school.id,
    },
  ];
  for (const v of vehiclesData) {
    await prisma.vehicle.create({ data: v });
  }
  console.log(`✅ ${vehiclesData.length} Transport Vehicles seeded`);

  // 9. Weekly Attendance (Last 7 Days)
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const attDate = new Date();
    attDate.setDate(attDate.getDate() - dayOffset);
    attDate.setHours(10, 0, 0, 0);

    const dayOfWeek = attDate.getDay();
    if (dayOfWeek === 0) continue; // Sunday off

    for (let sIdx = 0; sIdx < createdStudents.length; sIdx++) {
      const student = createdStudents[sIdx];
      const isAbsent = (dayOffset + sIdx) % 7 === 3;
      await prisma.attendance.create({
        data: {
          studentId: student.id,
          status: isAbsent ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
          date: attDate,
        },
      });
    }
  }
  console.log('✅ Last 7 Days Attendance seeded');

  // 10. Audit Logs / Recent Activities
  const now = new Date();
  const makeDate = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000);
  const auditEvents = [
    {
      userId: adminUser.id,
      action: 'Fee receipt #REC-8921 generated for Aarav Agarwal (Class 10th-A) - ₹12,500',
      createdAt: makeDate(15),
    },
    {
      userId: adminUser.id,
      action: 'School Bus RJ-14-PA-2024 (Route 1) departed on morning pickup schedule',
      createdAt: makeDate(65),
    },
    {
      userId: principalUser.id,
      action: 'Notice published: Parent-Teacher Meeting (PTM) Scheduled for Saturday',
      createdAt: makeDate(150),
    },
    {
      userId: adminUser.id,
      action: 'New student Yash Soni (Roll: VM-105) admitted to Class 10th-A',
      createdAt: makeDate(24 * 60 + 30),
    },
    {
      userId: principalUser.id,
      action: 'Quarterly academic syllabus review approved by Principal',
      createdAt: makeDate(30 * 60),
    },
    {
      userId: adminUser.id,
      action: 'Transport fleet maintenance & fitness inspection completed for 5 buses',
      createdAt: makeDate(48 * 60),
    },
  ];
  for (const ev of auditEvents) {
    await prisma.auditLog.create({
      data: {
        action: ev.action,
        userId: ev.userId,
        ip: '192.168.1.10',
        createdAt: ev.createdAt,
      },
    });
  }
  console.log('✅ Recent Activity Audit Logs seeded');

  // 8. Announcements
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Summer Vacation Timetable Schedule',
        content: 'Summer vacation will commence from 15th May. Final examinations will wrap by 10th May.',
        type: NotificationType?.HOLIDAY ?? 'HOLIDAY',
        priority: 'HIGH',
        allSchool: true,
        authorId: adminUser.id,
        authorName: 'Vikram Rathore (Admin)',
      },
      {
        title: 'Parent-Teacher Meeting (PTM) Notification',
        content: 'Monthly review PTM for classes 9th and 10th is scheduled for this Saturday between 9:00 AM and 1:00 PM.',
        type: NotificationType?.EVENT ?? 'EVENT',
        priority: 'MEDIUM',
        allSchool: false,
        classId: classMap['10th'].id,
        authorId: principalUser.id,
        authorName: 'Dr. Meenakshi Sharma (Principal)',
      },
    ],
  });
  console.log('✅ Announcements published');

  // 8. Subscription Plans for Super Admin
  const existingPlans = await prisma.plan.count();
  if (existingPlans === 0) {
    await prisma.plan.createMany({
      data: [
        { name: 'Starter Trial', description: 'Evaluation package for growing academies with core classroom tools.', price: 0, duration: 1, isActive: true },
        { name: 'Standard Campus', description: 'Complete school operating system for medium schools up to 1,000 students.', price: 4999, duration: 12, isActive: true },
        { name: 'Pro Institutional', description: 'Advanced academic and financial automation suite for large institutes.', price: 9999, duration: 12, isActive: true },
        { name: 'Enterprise Apex', description: 'Full-featured enterprise plan with multi-campus support and priority SLA.', price: 19999, duration: 12, isActive: true },
      ],
    });
    console.log('✅ 4 Subscription Plans created');
  }

  console.log('\n=========================================');
  console.log('📋 ALL CREDENTIALS (Password: School@123)');
  console.log('=========================================');
  console.log('🌐 Super Admin: superadmin@yugsoft.com');
  console.log('👑 School Admin: admin@vidyamandir.edu.in');
  console.log('🎓 Principal:    principal@vidyamandir.edu.in');
  console.log('🧑‍🏫 Teacher:      rajesh.sharma@vidyamandir.edu.in');
  console.log('👨‍👩‍👦 Parent:       sanjay.agarwal@gmail.com');
  console.log('🎒 Student:      aarav.agarwal@student.edu.in');
  console.log('=========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });