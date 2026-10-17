import { PrismaClient, Role, Gender, AttendanceStatus, ExamType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) {
    console.error('No school found!');
    return;
  }
  const schoolId = school.id;
  console.log(`Using school: ${school.name} (${schoolId})`);

  // Find Rajesh Sharma
  const teacherUser = await prisma.user.findFirst({
    where: { email: 'rajesh.sharma@vidyamandir.edu.in' },
    include: { teacher: true },
  });

  if (!teacherUser || !teacherUser.teacher) {
    console.error('Teacher Rajesh Sharma not found!');
    return;
  }

  const teacher = teacherUser.teacher;
  console.log(`Found teacher: ${teacherUser.firstName} ${teacherUser.lastName} (ID: ${teacher.id})`);

  // Target senior classes for Rajesh Sharma: Class 8th, 9th, 10th, 11th, 12th
  const targetClassNames = ['Class 8th', 'Class 9th', 'Class 10th', 'Class 11th', 'Class 12th'];
  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      name: { in: targetClassNames },
    },
  });

  console.log(`Found ${classes.length} target classes:`, classes.map((c) => c.name));

  // Find or create Mathematics subject
  let mathSubject = await prisma.subject.findFirst({
    where: { schoolId, name: 'Mathematics' },
  });

  if (!mathSubject) {
    mathSubject = await prisma.subject.create({
      data: {
        name: 'Mathematics',
        code: 'MATH',
        schoolId,
        teacherId: teacher.id,
      },
    });
  } else if (!mathSubject.teacherId) {
    await prisma.subject.update({
      where: { id: mathSubject.id },
      data: { teacherId: teacher.id },
    });
  }

  const defaultPassword = await bcrypt.hash('School@123', 10);

  // Student name pools for realistic Indian classrooms
  const firstNamesBoys = [
    'Aarav', 'Vihaan', 'Ishaan', 'Kabir', 'Rohan', 'Aditya', 'Ayush', 'Yash', 'Devendra', 'Kartik',
    'Abhishek', 'Mayank', 'Harsh', 'Pranav', 'Aryan', 'Daksh', 'Gaurav', 'Manish', 'Nikhil', 'Chirag'
  ];
  const firstNamesGirls = [
    'Ananya', 'Diya', 'Riya', 'Meera', 'Tanvi', 'Sneha', 'Khushi', 'Pooja', 'Isha', 'Bhavna',
    'Simran', 'Kritika', 'Divya', 'Anushka', 'Palak', 'Shruti', 'Garima', 'Aakanksha', 'Nehal', 'Rachna'
  ];
  const lastNames = [
    'Sharma', 'Verma', 'Choudhary', 'Pareek', 'Rathore', 'Shekhawat', 'Joshi', 'Gupta', 'Meena', 'Agarwal',
    'Mishra', 'Singh', 'Jain', 'Mathur', 'Sen', 'Bhardwaj', 'Tiwari', 'Pandey', 'Saxena', 'Yadav'
  ];

  let studentCounter = 200;
  const now = new Date();
  const allNewAttendance: { studentId: string; date: Date; status: AttendanceStatus }[] = [];

  for (const cls of classes) {
    const existingCount = await prisma.student.count({ where: { classId: cls.id } });
    const studentsNeeded = Math.max(0, 15 - existingCount);

    console.log(`Class ${cls.name}: has ${existingCount} students. Adding ${studentsNeeded} students...`);

    for (let i = 0; i < studentsNeeded; i++) {
      studentCounter++;
      const isBoy = i % 2 === 0;
      const firstName = isBoy
        ? firstNamesBoys[(i + cls.name.length) % firstNamesBoys.length]
        : firstNamesGirls[(i + cls.name.length) % firstNamesGirls.length];
      const lastName = lastNames[(i + studentCounter) % lastNames.length];
      const roll = (existingCount + i + 1).toString().padStart(2, '0');
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${studentCounter}@vidyamandir.edu.in`;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        const user = await prisma.user.create({
          data: {
            email,
            password: defaultPassword,
            role: Role.STUDENT,
            firstName,
            lastName,
            phone: `98290${studentCounter.toString().padStart(5, '0')}`,
            schoolId,
          },
        });

        await prisma.student.create({
          data: {
            userId: user.id,
            rollNumber: roll,
            gender: isBoy ? Gender.MALE : Gender.FEMALE,
            dob: new Date(2010, (i * 2) % 12, (i * 3 + 1) % 28 + 1),
            schoolId,
            classId: cls.id,
          },
        });
      }
    }

    // Now get all students in this class
    const classStudents = await prisma.student.findMany({
      where: { classId: cls.id },
      include: { user: true },
    });

    console.log(`Class ${cls.name} has ${classStudents.length} students.`);

    // 2. SEED EXAMS & EXAM RESULTS FOR CLASS PERFORMANCE
    let exam = await prisma.exam.findFirst({
      where: { classId: cls.id, name: { contains: 'Mathematics' } },
    });

    if (!exam) {
      exam = await prisma.exam.create({
        data: {
          name: `Mid-Term Examination 2026 - ${cls.name} Mathematics`,
          type: ExamType.MID_TERM,
          date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          totalMarks: 100,
          passingMarks: 40,
          classId: cls.id,
        },
      });
    }

    const baseClassAverages: Record<string, number> = {
      'Class 8th': 84,
      'Class 9th': 79,
      'Class 10th': 88,
      'Class 11th': 76,
      'Class 12th': 91,
    };
    const targetAvg = baseClassAverages[cls.name] || 82;

    for (let idx = 0; idx < classStudents.length; idx++) {
      const student = classStudents[idx];
      const existingResult = await prisma.examResult.findFirst({
        where: { examId: exam.id, studentId: student.id },
      });

      if (!existingResult) {
        const variance = ((idx % 7) - 3) * 3;
        const mark = Math.min(98, Math.max(55, targetAvg + variance));

        await prisma.examResult.create({
          data: {
            examId: exam.id,
            studentId: student.id,
            marks: mark,
          },
        });
      }

      // Collect attendance for bulk creation (last 14 school days)
      for (let d = 0; d < 14; d++) {
        const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        if (date.getDay() === 0) continue; // Skip Sunday

        const rand = (idx * 17 + d * 23) % 100;
        const status =
          rand < 90
            ? AttendanceStatus.PRESENT
            : rand < 96
            ? AttendanceStatus.LATE
            : AttendanceStatus.ABSENT;

        allNewAttendance.push({
          studentId: student.id,
          date,
          status,
        });
      }
    }
  }

  // Bulk insert attendance
  console.log(`Inserting ${allNewAttendance.length} attendance records...`);
  await prisma.attendance.createMany({
    data: allNewAttendance,
  });

  // ==========================================
  // 4. SEED HOMEWORK / ASSIGNMENTS FOR RAJESH SHARMA
  // ==========================================
  console.log('Seeding Homework / Assignments for Rajesh Sharma...');
  await prisma.homework.deleteMany({ where: { teacherId: teacher.id } });

  const daysAhead = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const homeworkData = [
    {
      title: 'Chapter 4: Quadratic Equations - Exercise 4.2 & 4.3 Problems',
      description: 'Solve Q1 to Q12 from Exercise 4.2 using factorization and quadratic formula methods. Submit in your class fair notebooks.',
      className: 'Class 10th',
      days: 2,
    },
    {
      title: 'Surface Areas and Volumes - NCERT Exemplar Problem Set',
      description: 'Complete word problems on combination of solids (Cylinder, Cone, Sphere) with diagrams and step-by-step formula derivations.',
      className: 'Class 9th',
      days: 3,
    },
    {
      title: 'Linear Equations in One Variable - Application Word Problems',
      description: 'Solve age-related, speed-distance-time, and perimeter-area application questions from Exercise 2.4.',
      className: 'Class 8th',
      days: 1,
    },
    {
      title: 'Matrices and Determinants - CBSE Board Sample Paper 2026',
      description: 'Solve questions on Matrix Inversion method, properties of determinants, and system of linear equations in 3 variables.',
      className: 'Class 12th',
      days: 4,
    },
    {
      title: 'Trigonometric Functions - Angle Transformations & Identities',
      description: 'Practice product-to-sum and sum-to-product trigonometric formulae proof exercises from Chapter 3.',
      className: 'Class 11th',
      days: 5,
    },
    {
      title: 'Arithmetic Progressions - Sum of First N Terms Practice Sheet',
      description: 'Complete the 15-question worksheet uploaded in the student portal on finding nth term and sum of AP sequences.',
      className: 'Class 10th',
      days: 6,
    },
  ];

  for (const hw of homeworkData) {
    const targetCls = classes.find((c) => c.name === hw.className);
    if (targetCls) {
      await prisma.homework.create({
        data: {
          title: hw.title,
          description: hw.description,
          classId: targetCls.id,
          subjectId: mathSubject.id,
          teacherId: teacher.id,
          dueDate: daysAhead(hw.days),
        },
      });
      console.log(`Created homework for ${hw.className}: ${hw.title}`);
    }
  }

  console.log('✅ Teacher Portal Seed Complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding teacher portal:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
