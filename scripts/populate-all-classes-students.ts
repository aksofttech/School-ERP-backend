import { PrismaClient, Role, Gender, AttendanceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Populating students for all empty classes...');

  const school = await prisma.school.findFirst();
  if (!school) {
    console.error('No school found!');
    return;
  }

  const defaultPassword = await bcrypt.hash('School@123', 10);

  const classes = await prisma.class.findMany({
    where: { schoolId: school.id },
    include: {
      sections: true,
      students: true,
    },
  });

  // Students data for classes that have 0 students
  const newStudentsByClass: Record<string, { first: string; last: string; gender: Gender; roll: string; dob: string }[]> = {
    'Class Nursery': [
      { first: 'Vivaan', last: 'Sharma', gender: Gender.MALE, roll: 'VM-N01', dob: '2022-05-10' },
      { first: 'Aadhya', last: 'Verma', gender: Gender.FEMALE, roll: 'VM-N02', dob: '2022-08-14' },
    ],
    'Class LKG': [
      { first: 'Reyansh', last: 'Meena', gender: Gender.MALE, roll: 'VM-L01', dob: '2021-03-22' },
      { first: 'Myra', last: 'Joshi', gender: Gender.FEMALE, roll: 'VM-L02', dob: '2021-07-19' },
    ],
    'Class UKG': [
      { first: 'Kabir', last: 'Choudhary', gender: Gender.MALE, roll: 'VM-U01', dob: '2020-04-15' },
      { first: 'Anvi', last: 'Singhal', gender: Gender.FEMALE, roll: 'VM-U02', dob: '2020-09-30' },
    ],
    'Class 1st': [
      { first: 'Aarav', last: 'Khandelwal', gender: Gender.MALE, roll: 'VM-101A', dob: '2019-02-12' },
      { first: 'Prisha', last: 'Mishra', gender: Gender.FEMALE, roll: 'VM-102A', dob: '2019-11-25' },
    ],
    'Class 2nd': [
      { first: 'Advik', last: 'Soni', gender: Gender.MALE, roll: 'VM-201', dob: '2018-06-18' },
      { first: 'Saanvi', last: 'Pareek', gender: Gender.FEMALE, roll: 'VM-202', dob: '2018-10-05' },
    ],
    'Class 3rd': [
      { first: 'Shaurya', last: 'Rathore', gender: Gender.MALE, roll: 'VM-301', dob: '2017-01-20' },
      { first: 'Kiara', last: 'Jain', gender: Gender.FEMALE, roll: 'VM-302', dob: '2017-08-14' },
    ],
    'Class 4th': [
      { first: 'Atharv', last: 'Yadav', gender: Gender.MALE, roll: 'VM-401', dob: '2016-04-09' },
      { first: 'Navya', last: 'Chauhan', gender: Gender.FEMALE, roll: 'VM-402', dob: '2016-12-03' },
    ],
    'Class 6th': [
      { first: 'Dhruv', last: 'Bhardwaj', gender: Gender.MALE, roll: 'VM-601', dob: '2014-05-16' },
      { first: 'Isha', last: 'Bansal', gender: Gender.FEMALE, roll: 'VM-602', dob: '2014-09-28' },
    ],
    'Class 8th': [
      { first: 'Samarth', last: 'Mathur', gender: Gender.MALE, roll: 'VM-801', dob: '2012-03-11' },
      { first: 'Avani', last: 'Saxena', gender: Gender.FEMALE, roll: 'VM-802', dob: '2012-07-24' },
    ],
    'Class 11th': [
      { first: 'Harsh', last: 'Tiwari', gender: Gender.MALE, roll: 'VM-1101', dob: '2009-02-18' },
      { first: 'Tanvi', last: 'Purohit', gender: Gender.FEMALE, roll: 'VM-1102', dob: '2009-08-04' },
    ],
    'Class 12th': [
      { first: 'Manan', last: 'Kulshrestha', gender: Gender.MALE, roll: 'VM-1201', dob: '2008-01-15' },
      { first: 'Rhea', last: 'Vyas', gender: Gender.FEMALE, roll: 'VM-1202', dob: '2008-06-29' },
    ],
  };

  let totalAdded = 0;

  for (const cls of classes) {
    if (cls.students.length > 0) {
      console.log(`⏩ ${cls.name} already has ${cls.students.length} students. Skipping.`);
      continue;
    }

    const studentsToCreate = newStudentsByClass[cls.name] || [
      { first: 'Student', last: cls.name.replace('Class ', ''), gender: Gender.MALE, roll: `VM-${cls.name.substring(6, 9)}1`, dob: '2015-01-01' },
    ];

    const section = cls.sections[0];
    if (!section) continue;

    for (const st of studentsToCreate) {
      const email = `${st.first.toLowerCase()}.${st.last.toLowerCase()}.${cls.name.replace(/\s+/g, '').toLowerCase()}@student.edu.in`;
      
      const user = await prisma.user.create({
        data: {
          email,
          password: defaultPassword,
          role: Role.STUDENT,
          firstName: st.first,
          lastName: st.last,
          schoolId: school.id,
        },
      });

      const student = await prisma.student.create({
        data: {
          userId: user.id,
          rollNumber: st.roll,
          gender: st.gender,
          dob: new Date(st.dob),
          schoolId: school.id,
          classId: cls.id,
          sectionId: section.id,
        },
      });

      // Populate 7 days attendance for this student
      for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
        const attDate = new Date();
        attDate.setDate(attDate.getDate() - dayOffset);
        attDate.setHours(10, 0, 0, 0);

        if (attDate.getDay() === 0) continue; // Sunday off

        await prisma.attendance.create({
          data: {
            studentId: student.id,
            status: AttendanceStatus.PRESENT,
            date: attDate,
          },
        });
      }

      totalAdded++;
    }
    console.log(`✅ ${cls.name}: Added ${studentsToCreate.length} students.`);
  }

  console.log(`🎉 Total ${totalAdded} new students added across all empty classes!`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
