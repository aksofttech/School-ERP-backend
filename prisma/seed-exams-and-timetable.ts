import { PrismaClient, ExamType, DayOfWeek } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schoolId = 'a457cc2d-27a7-4303-8ae1-262f879635fa';

  // 1. Get classes
  const classes = await prisma.class.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${classes.length} classes`);

  // Map class name to ID
  const classMap = new Map<string, string>();
  classes.forEach((c) => classMap.set(c.name, c.id));

  // 2. Get subjects
  const subjects = await prisma.subject.findMany({
    where: { schoolId },
  });
  console.log(`Found ${subjects.length} subjects`);

  const subjectMap = new Map<string, string>();
  subjects.forEach((s) => subjectMap.set(s.name, s.id));

  // Add Physical Education subject if not present
  let peSubject = subjects.find((s) => s.name === 'Physical Education');
  if (!peSubject) {
    peSubject = await prisma.subject.create({
      data: {
        name: 'Physical Education',
        code: 'PHED',
        schoolId,
      },
    });
    subjectMap.set('Physical Education', peSubject.id);
  }

  // 3. Get teachers
  const teachers = await prisma.teacher.findMany({
    where: { schoolId },
    include: { user: true },
  });
  console.log(`Found ${teachers.length} teachers`);

  const teacherMap = new Map<string, string>();
  teachers.forEach((t) => teacherMap.set(t.user.email, t.id));

  const rajeshId = teacherMap.get('rajesh.sharma@vidyamandir.edu.in')!; // Math
  const sunitaId = teacherMap.get('sunita.verma@vidyamandir.edu.in')!; // English
  const amitId = teacherMap.get('amit.choudhary@vidyamandir.edu.in')!; // Science
  const poojaId = teacherMap.get('pooja.mishra@vidyamandir.edu.in')!; // Social Studies / Commerce
  const dineshId = teacherMap.get('dinesh.pareek@vidyamandir.edu.in')!; // Sports
  const kavitaId = teacherMap.get('kavita.joshi@vidyamandir.edu.in')!; // Hindi

  // Assign teachers to subjects
  if (subjectMap.get('Mathematics')) {
    await prisma.subject.update({ where: { id: subjectMap.get('Mathematics') }, data: { teacherId: rajeshId } });
  }
  if (subjectMap.get('English')) {
    await prisma.subject.update({ where: { id: subjectMap.get('English') }, data: { teacherId: sunitaId } });
  }
  if (subjectMap.get('Science')) {
    await prisma.subject.update({ where: { id: subjectMap.get('Science') }, data: { teacherId: amitId } });
  }
  if (subjectMap.get('Social Studies')) {
    await prisma.subject.update({ where: { id: subjectMap.get('Social Studies') }, data: { teacherId: poojaId } });
  }
  if (subjectMap.get('Hindi')) {
    await prisma.subject.update({ where: { id: subjectMap.get('Hindi') }, data: { teacherId: kavitaId } });
  }
  if (peSubject) {
    await prisma.subject.update({ where: { id: peSubject.id }, data: { teacherId: dineshId } });
  }

  // 4. Seed Exams (clear existing first)
  await prisma.examResult.deleteMany({});
  await prisma.exam.deleteMany({});

  const examDefinitions = [
    // Class 10th
    { className: 'Class 10th', name: 'Mathematics - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 100, passingMarks: 33, date: new Date('2026-10-24T09:00:00Z') },
    { className: 'Class 10th', name: 'Science - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 100, passingMarks: 33, date: new Date('2026-10-26T09:00:00Z') },
    { className: 'Class 10th', name: 'English - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 100, passingMarks: 33, date: new Date('2026-10-28T09:00:00Z') },
    { className: 'Class 10th', name: 'Hindi - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 100, passingMarks: 33, date: new Date('2026-10-30T09:00:00Z') },
    { className: 'Class 10th', name: 'Social Studies - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 100, passingMarks: 33, date: new Date('2026-11-02T09:00:00Z') },

    // Class 9th
    { className: 'Class 9th', name: 'Mathematics - Unit Test 2', type: ExamType.UNIT_TEST, totalMarks: 40, passingMarks: 14, date: new Date('2026-10-25T10:00:00Z') },
    { className: 'Class 9th', name: 'Science - Unit Test 2', type: ExamType.UNIT_TEST, totalMarks: 40, passingMarks: 14, date: new Date('2026-10-27T10:00:00Z') },
    { className: 'Class 9th', name: 'English - Unit Test 2', type: ExamType.UNIT_TEST, totalMarks: 40, passingMarks: 14, date: new Date('2026-10-29T10:00:00Z') },

    // Class 8th
    { className: 'Class 8th', name: 'Mathematics - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 80, passingMarks: 27, date: new Date('2026-10-24T09:30:00Z') },
    { className: 'Class 8th', name: 'Science - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 80, passingMarks: 27, date: new Date('2026-10-26T09:30:00Z') },
    { className: 'Class 8th', name: 'English - Mid Term Examination', type: ExamType.MID_TERM, totalMarks: 80, passingMarks: 27, date: new Date('2026-10-28T09:30:00Z') },

    // Class 7th
    { className: 'Class 7th', name: 'Social Studies - Unit Test 2', type: ExamType.UNIT_TEST, totalMarks: 40, passingMarks: 14, date: new Date('2026-11-04T10:00:00Z') },
    { className: 'Class 7th', name: 'Hindi - Unit Test 2', type: ExamType.UNIT_TEST, totalMarks: 40, passingMarks: 14, date: new Date('2026-11-06T10:00:00Z') },

    // Class 12th & 11th
    { className: 'Class 12th', name: 'Mathematics - Pre-Board Examination', type: ExamType.FINAL, totalMarks: 100, passingMarks: 33, date: new Date('2026-12-05T09:00:00Z') },
    { className: 'Class 11th', name: 'Physics & Science - Mid Term', type: ExamType.MID_TERM, totalMarks: 70, passingMarks: 23, date: new Date('2026-10-27T09:00:00Z') },
  ];

  for (const ed of examDefinitions) {
    const classId = classMap.get(ed.className);
    if (classId) {
      await prisma.exam.create({
        data: {
          name: ed.name,
          type: ed.type,
          totalMarks: ed.totalMarks,
          passingMarks: ed.passingMarks,
          date: ed.date,
          classId,
        },
      });
    }
  }

  const examCount = await prisma.exam.count();
  console.log(`✅ Seeded ${examCount} real exams!`);

  // 5. Seed Timetable (clear existing first)
  await prisma.timetable.deleteMany({});

  const mathSub = subjectMap.get('Mathematics')!;
  const engSub = subjectMap.get('English')!;
  const sciSub = subjectMap.get('Science')!;
  const socSub = subjectMap.get('Social Studies')!;
  const hinSub = subjectMap.get('Hindi')!;
  const peSub = subjectMap.get('Physical Education')!;

  const days: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];

  // Comprehensive schedule for each teacher
  const timetableEntries: any[] = [];

  // Rajesh Sharma (Math Teacher)
  days.forEach((day, idx) => {
    timetableEntries.push(
      { day, startTime: '08:30', endTime: '09:15', className: 'Class 10th', subjectId: mathSub, teacherId: rajeshId, room: 'Room 101' },
      { day, startTime: '09:15', endTime: '10:00', className: 'Class 9th', subjectId: mathSub, teacherId: rajeshId, room: 'Room 102' },
      { day, startTime: '11:00', endTime: '11:45', className: 'Class 8th', subjectId: mathSub, teacherId: rajeshId, room: 'Room 104' },
      { day, startTime: '12:30', endTime: '01:15', className: idx % 2 === 0 ? 'Class 11th' : 'Class 12th', subjectId: mathSub, teacherId: rajeshId, room: 'Room 201' },
    );
  });

  // Sunita Verma (English Teacher)
  days.forEach((day, idx) => {
    timetableEntries.push(
      { day, startTime: '08:30', endTime: '09:15', className: 'Class 8th', subjectId: engSub, teacherId: sunitaId, room: 'Room 104' },
      { day, startTime: '10:15', endTime: '11:00', className: 'Class 10th', subjectId: engSub, teacherId: sunitaId, room: 'Room 101' },
      { day, startTime: '11:00', endTime: '11:45', className: 'Class 9th', subjectId: engSub, teacherId: sunitaId, room: 'Room 102' },
      { day, startTime: '01:15', endTime: '02:00', className: idx % 2 === 0 ? 'Class 7th' : 'Class 6th', subjectId: engSub, teacherId: sunitaId, room: 'Room 105' },
    );
  });

  // Amit Choudhary (Science Teacher)
  days.forEach((day, idx) => {
    timetableEntries.push(
      { day, startTime: '09:15', endTime: '10:00', className: 'Class 10th', subjectId: sciSub, teacherId: amitId, room: 'Science Lab' },
      { day, startTime: '10:15', endTime: '11:00', className: 'Class 9th', subjectId: sciSub, teacherId: amitId, room: 'Science Lab' },
      { day, startTime: '12:30', endTime: '01:15', className: 'Class 8th', subjectId: sciSub, teacherId: amitId, room: 'Room 104' },
      { day, startTime: '01:15', endTime: '02:00', className: idx % 2 === 0 ? 'Class 11th' : 'Class 7th', subjectId: sciSub, teacherId: amitId, room: 'Science Lab' },
    );
  });

  // Pooja Mishra (Social Studies Teacher)
  days.forEach((day, idx) => {
    timetableEntries.push(
      { day, startTime: '09:15', endTime: '10:00', className: 'Class 7th', subjectId: socSub, teacherId: poojaId, room: 'Room 105' },
      { day, startTime: '11:00', endTime: '11:45', className: 'Class 6th', subjectId: socSub, teacherId: poojaId, room: 'Room 106' },
      { day, startTime: '12:30', endTime: '01:15', className: 'Class 9th', subjectId: socSub, teacherId: poojaId, room: 'Room 102' },
      { day, startTime: '01:15', endTime: '02:00', className: 'Class 10th', subjectId: socSub, teacherId: poojaId, room: 'Room 101' },
    );
  });

  // Kavita Joshi (Hindi Teacher)
  days.forEach((day, idx) => {
    timetableEntries.push(
      { day, startTime: '08:30', endTime: '09:15', className: 'Class 7th', subjectId: hinSub, teacherId: kavitaId, room: 'Room 105' },
      { day, startTime: '09:15', endTime: '10:00', className: 'Class 8th', subjectId: hinSub, teacherId: kavitaId, room: 'Room 104' },
      { day, startTime: '11:00', endTime: '11:45', className: 'Class 10th', subjectId: hinSub, teacherId: kavitaId, room: 'Room 101' },
      { day, startTime: '12:30', endTime: '01:15', className: 'Class 6th', subjectId: hinSub, teacherId: kavitaId, room: 'Room 106' },
    );
  });

  // Dinesh Pareek (Physical Education)
  days.forEach((day, idx) => {
    timetableEntries.push(
      { day, startTime: '08:30', endTime: '09:15', className: 'Class 6th', subjectId: peSub, teacherId: dineshId, room: 'Sports Ground' },
      { day, startTime: '10:15', endTime: '11:00', className: 'Class 8th', subjectId: peSub, teacherId: dineshId, room: 'Sports Ground' },
      { day, startTime: '01:15', endTime: '02:00', className: 'Class 10th', subjectId: peSub, teacherId: dineshId, room: 'Sports Ground' },
    );
  });

  for (const entry of timetableEntries) {
    const classId = classMap.get(entry.className);
    if (classId) {
      await prisma.timetable.create({
        data: {
          day: entry.day,
          startTime: entry.startTime,
          endTime: entry.endTime,
          classId,
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          room: entry.room,
        },
      });
    }
  }

  const ttCount = await prisma.timetable.count();
  console.log(`✅ Seeded ${ttCount} timetable slots across all staff members!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
