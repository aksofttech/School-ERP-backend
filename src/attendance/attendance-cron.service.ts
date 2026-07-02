import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Auto-mark absent students daily at 11:59 PM
   * Marks all students who don't have attendance marked for the day as ABSENT
   */
  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async autoMarkAbsentDaily() {
    this.logger.log('Starting auto-mark absent job...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active classes
      const classes = await this.prisma.class.findMany({
        include: {
          students: true,
        },
      });

      let totalMarked = 0;

      for (const classEntity of classes) {
        if (classEntity.students.length === 0) {
          continue;
        }

        // Get students who already have attendance marked for today
        const studentIds = classEntity.students.map((s) => s.id);
        const existingAttendance = await this.prisma.attendance.findMany({
          where: {
            studentId: { in: studentIds },
            date: today,
          },
        });

        const markedStudentIds = existingAttendance.map((a) => a.studentId);
        const unmarkedStudents = classEntity.students.filter(
          (s) => !markedStudentIds.includes(s.id),
        );

        if (unmarkedStudents.length === 0) {
          continue;
        }

        // Mark unmarked students as ABSENT
        const attendanceRecords = await Promise.all(
          unmarkedStudents.map((student) =>
            this.prisma.attendance.create({
              data: {
                studentId: student.id,
                date: today,
                status: AttendanceStatus.ABSENT,
              },
            }),
          ),
        );

        totalMarked += attendanceRecords.length;
        this.logger.log(
          `Auto-marked ${attendanceRecords.length} student(s) as ABSENT for class ${classEntity.name}`,
        );
      }

      this.logger.log(
        `Auto-mark absent job completed. Total marked: ${totalMarked}`,
      );
    } catch (error) {
      this.logger.error('Error in auto-mark absent job:', error);
    }
  }
}
