import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { ViewAttendanceDto } from './dto/view-attendance.dto';
import { MonthlyReportDto } from './dto/monthly-report.dto';
import { PaginatedResult } from '../common/utils/pagination.dto';
import { Role, AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mark daily attendance per class
   * Only TEACHER can mark attendance
   */
  async markAttendance(
    markAttendanceDto: MarkAttendanceDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.TEACHER) {
      throw new ForbiddenException('Only TEACHER can mark attendance');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    const { classId, date, students } = markAttendanceDto;

    // Verify teacher exists
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: currentUser.userId,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile not found');
    }

    // Verify class exists and belongs to school
    const classEntity = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: true,
      },
    });

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    if (classEntity.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only mark attendance for classes in your school',
      );
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Validate all students belong to the class
    const studentIds = students.map((s) => s.studentId);
    const classStudents = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        classId,
      },
    });

    if (classStudents.length !== studentIds.length) {
      throw new BadRequestException(
        'One or more students do not belong to this class',
      );
    }

    // Create or update attendance records in transaction
    return await this.prisma.$transaction(async (tx) => {
      const results = await Promise.all(
        students.map(async (student) => {
          // Check if record exists
          const existing = await tx.attendance.findFirst({
            where: {
              studentId: student.studentId,
              date: attendanceDate,
            },
          });

          if (existing) {
            return tx.attendance.update({
              where: { id: existing.id },
              data: { status: student.status },
            });
          } else {
            return tx.attendance.create({
              data: {
                studentId: student.studentId,
                date: attendanceDate,
                status: student.status,
              },
            });
          }
        }),
      );

      return {
        message: `Attendance synchronized for ${results.length} student(s)`,
        date: attendanceDate,
        class: {
          id: classEntity.id,
          name: classEntity.name,
        },
        records: results,
      };
    });
  }

  /**
   * Auto-mark absent students via cron job
   * Marks all students in a class as ABSENT if not marked by end of day
   */
  async autoMarkAbsent(classId: string, date: Date) {
    // Get all students in the class
    const students = await this.prisma.student.findMany({
      where: {
        classId,
      },
    });

    if (students.length === 0) {
      return { message: 'No students found in class' };
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Get students who already have attendance marked
    const existingAttendance = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        date: attendanceDate,
      },
    });

    const markedStudentIds = existingAttendance.map((a) => a.studentId);
    const unmarkedStudents = students.filter(
      (s) => !markedStudentIds.includes(s.id),
    );

    if (unmarkedStudents.length === 0) {
      return { message: 'All students already have attendance marked' };
    }

    // Mark unmarked students as ABSENT
    const attendanceRecords = await Promise.all(
      unmarkedStudents.map((student) =>
        this.prisma.attendance.create({
          data: {
            studentId: student.id,
            date: attendanceDate,
            status: AttendanceStatus.ABSENT,
          },
        }),
      ),
    );

    return {
      message: `Auto-marked ${attendanceRecords.length} student(s) as ABSENT`,
      date: attendanceDate,
      records: attendanceRecords.length,
    };
  }

  /**
   * View attendance
   * - TEACHER can view attendance for their classes
   * - STUDENT can view their own attendance
   * - PARENT can view attendance for their linked students
   */
  async findAll(
    viewAttendanceDto: ViewAttendanceDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      studentId,
      classId,
      startDate,
      endDate,
    } = viewAttendanceDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (currentUser.role === Role.TEACHER) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'Teacher must be associated with a school',
        );
      }

      // TEACHER can view attendance for classes in their school
      if (classId) {
        const classEntity = await this.prisma.class.findUnique({
          where: { id: classId },
        });

        if (!classEntity) {
          throw new NotFoundException(`Class with ID ${classId} not found`);
        }

        if (classEntity.schoolId !== currentUser.schoolId) {
          throw new ForbiddenException(
            'Access denied. You can only view attendance for classes in your school',
          );
        }

        where.student = {
          classId,
        };
      } else {
        where.student = {
          schoolId: currentUser.schoolId,
        };
      }
    } else if (currentUser.role === Role.STUDENT) {
      // STUDENT can only view their own attendance
      const student = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!student) {
        throw new NotFoundException('Student profile not found');
      }

      where.studentId = student.id;
    } else if (currentUser.role === Role.PARENT) {
      // PARENT can view attendance for their linked students
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const linkedStudentIds = parent.students.map((s) => s.id);

      if (linkedStudentIds.length === 0) {
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      where.studentId = { in: linkedStudentIds };

      // If specific studentId is provided, verify it's linked
      if (studentId && !linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view attendance for your linked students',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only TEACHER, STUDENT, and PARENT can view attendance',
      );
    }

    // Filter by specific student if provided
    if (studentId) {
      where.studentId = studentId;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
              section: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get monthly attendance report
   * - STUDENT can view their own report
   * - PARENT can view report for their linked students
   */
  async getMonthlyReport(
    monthlyReportDto: MonthlyReportDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const { studentId, month } = monthlyReportDto;

    // Parse month (YYYY-MM)
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    // Verify student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // RBAC checks
    if (currentUser.role === Role.STUDENT) {
      const currentStudent = await this.prisma.student.findFirst({
        where: {
          userId: currentUser.userId,
        },
      });

      if (!currentStudent || currentStudent.id !== studentId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own attendance report',
        );
      }
    } else if (currentUser.role === Role.PARENT) {
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: currentUser.userId,
        },
        include: {
          students: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent profile not found');
      }

      const linkedStudentIds = parent.students.map((s) => s.id);
      if (!linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view attendance reports for your linked students',
        );
      }
    } else if (
      currentUser.role !== Role.TEACHER &&
      currentUser.role !== Role.SCHOOL_ADMIN
    ) {
      throw new ForbiddenException(
        'Only TEACHER, STUDENT, PARENT, and SCHOOL_ADMIN can view attendance reports',
      );
    }

    // Get attendance records for the month
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        studentId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate statistics
    const totalDays = endDate.getDate();
    const present = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.PRESENT,
    ).length;
    const absent = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.ABSENT,
    ).length;
    const late = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.LATE,
    ).length;
    const markedDays = attendanceRecords.length;
    const unmarkedDays = totalDays - markedDays;
    const attendancePercentage =
      markedDays > 0 ? ((present / markedDays) * 100).toFixed(2) : '0.00';

    return {
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        rollNumber: student.rollNumber,
        class: student.class.name,
        section: student.section.name,
      },
      month,
      period: {
        startDate,
        endDate,
        totalDays,
      },
      statistics: {
        present,
        absent,
        late,
        markedDays,
        unmarkedDays,
        attendancePercentage: `${attendancePercentage}%`,
      },
      records: attendanceRecords,
    };
  }

  /**
   * Update attendance
   * Only TEACHER can update attendance
   */
  async update(
    id: string,
    updateAttendanceDto: UpdateAttendanceDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.TEACHER) {
      throw new ForbiddenException('Only TEACHER can update attendance');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${id} not found`);
    }

    // Verify attendance belongs to teacher's school
    if (attendance.student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only update attendance for students in your school',
      );
    }

    const updatedAttendance = await this.prisma.attendance.update({
      where: { id },
      data: updateAttendanceDto,
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            section: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updatedAttendance;
  }

  /**
   * Delete attendance
   * Only TEACHER can delete attendance
   */
  async remove(
    id: string,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    if (currentUser.role !== Role.TEACHER) {
      throw new ForbiddenException('Only TEACHER can delete attendance');
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('Teacher must be associated with a school');
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${id} not found`);
    }

    // Verify attendance belongs to teacher's school
    if (attendance.student.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'Access denied. You can only delete attendance for students in your school',
      );
    }

    await this.prisma.attendance.delete({
      where: { id },
    });

    return {
      message: 'Attendance record deleted successfully',
    };
  }
}
