import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceReportDto } from './dto/attendance-report.dto';
import { FeesReportDto } from './dto/fees-report.dto';
import { ExamsReportDto } from './dto/exams-report.dto';
import { Role, AttendanceStatus, FeeStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate fee status (overdue detection)
   */
  private calculateFeeStatus(dueDate: Date, status: FeeStatus): FeeStatus {
    if (status === FeeStatus.PAID) {
      return FeeStatus.PAID;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    if (due < now) {
      return FeeStatus.OVERDUE;
    }

    return FeeStatus.PENDING;
  }

  /**
   * Attendance Report
   * Aggregated queries with role-based access
   */
  async getAttendanceReport(
    attendanceReportDto: AttendanceReportDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const { studentId, classId, startDate, endDate } = attendanceReportDto;

    // Build where clause based on role
    const where: any = {};

    if (currentUser.role === Role.STUDENT) {
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
      // PARENT can view attendance for linked students
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
          summary: {
            totalRecords: 0,
            present: 0,
            absent: 0,
            late: 0,
            attendancePercentage: '0.00%',
          },
          details: [],
        };
      }

      where.studentId = { in: linkedStudentIds };

      if (studentId && !linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view attendance for your linked students',
        );
      }
    } else if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.TEACHER
    ) {
      // SCHOOL_ADMIN/TEACHER can view attendance in their school
      if (!currentUser.schoolId) {
        throw new ForbiddenException('User must be associated with a school');
      }

      where.student = {
        schoolId: currentUser.schoolId,
      };

      if (classId) {
        where.student.classId = classId;
      }

      if (studentId) {
        where.studentId = studentId;
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    // Date range filter
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

    // Get all attendance records
    const attendanceRecords = await this.prisma.attendance.findMany({
      where,
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
    });

    // Calculate aggregated statistics
    const totalRecords = attendanceRecords.length;
    const present = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.PRESENT,
    ).length;
    const absent = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.ABSENT,
    ).length;
    const late = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.LATE,
    ).length;
    const attendancePercentage =
      totalRecords > 0 ? ((present / totalRecords) * 100).toFixed(2) : '0.00';

    // Group by student for detailed breakdown
    const studentStats = attendanceRecords.reduce(
      (acc, record) => {
        const studentId = record.studentId;
        if (!acc[studentId]) {
          acc[studentId] = {
            student: record.student,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
          };
        }
        acc[studentId].total++;
        if (record.status === AttendanceStatus.PRESENT)
          acc[studentId].present++;
        if (record.status === AttendanceStatus.ABSENT) acc[studentId].absent++;
        if (record.status === AttendanceStatus.LATE) acc[studentId].late++;
        return acc;
      },
      {} as Record<string, any>,
    );

    const studentDetails = Object.values(studentStats).map((stat: any) => ({
      ...stat,
      attendancePercentage:
        stat.total > 0
          ? ((stat.present / stat.total) * 100).toFixed(2)
          : '0.00',
    }));

    return {
      summary: {
        totalRecords,
        present,
        absent,
        late,
        attendancePercentage: `${attendancePercentage}%`,
      },
      byStudent: studentDetails,
      details: attendanceRecords,
    };
  }

  /**
   * Fees Report
   * Aggregated queries with role-based access
   */
  async getFeesReport(
    feesReportDto: FeesReportDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const { studentId, classId, status, startDate, endDate } = feesReportDto;

    // Build where clause based on role
    const where: any = {};

    if (currentUser.role === Role.STUDENT) {
      // STUDENT can only view their own fees
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
      // PARENT can view fees for linked students
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
          summary: {
            totalFees: 0,
            paidFees: 0,
            pendingFees: 0,
            overdueFees: 0,
            totalAmount: '0.00',
            paidAmount: '0.00',
            pendingAmount: '0.00',
            overdueAmount: '0.00',
          },
          details: [],
        };
      }

      where.studentId = { in: linkedStudentIds };

      if (studentId && !linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view fees for your linked students',
        );
      }
    } else if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.TEACHER
    ) {
      // SCHOOL_ADMIN/TEACHER can view fees in their school
      if (!currentUser.schoolId) {
        throw new ForbiddenException('User must be associated with a school');
      }

      where.student = {
        schoolId: currentUser.schoolId,
      };

      if (classId) {
        where.student.classId = classId;
      }

      if (studentId) {
        where.studentId = studentId;
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Date range filter (based on dueDate)
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) {
        where.dueDate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.dueDate.lte = end;
      }
    }

    // Get all fees
    const fees = await this.prisma.fee.findMany({
      where,
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
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Calculate aggregated statistics (with overdue detection)
    const feesWithStatus = fees.map((fee) => ({
      ...fee,
      status: this.calculateFeeStatus(fee.dueDate, fee.status),
    }));

    const totalFees = feesWithStatus.length;
    const paidFees = feesWithStatus.filter(
      (f) => f.status === FeeStatus.PAID,
    ).length;
    const pendingFees = feesWithStatus.filter(
      (f) => f.status === FeeStatus.PENDING,
    ).length;
    const overdueFees = feesWithStatus.filter(
      (f) => f.status === FeeStatus.OVERDUE,
    ).length;

    const totalAmount = feesWithStatus.reduce((sum, f) => sum + f.amount, 0);
    const paidAmount = feesWithStatus
      .filter((f) => f.status === FeeStatus.PAID)
      .reduce((sum, f) => sum + f.amount, 0);
    const pendingAmount = feesWithStatus
      .filter((f) => f.status === FeeStatus.PENDING)
      .reduce((sum, f) => sum + f.amount, 0);
    const overdueAmount = feesWithStatus
      .filter((f) => f.status === FeeStatus.OVERDUE)
      .reduce((sum, f) => sum + f.amount, 0);

    // Group by student for detailed breakdown
    const studentStats = feesWithStatus.reduce(
      (acc, fee) => {
        const studentId = fee.studentId;
        if (!acc[studentId]) {
          acc[studentId] = {
            student: fee.student,
            totalFees: 0,
            paidFees: 0,
            pendingFees: 0,
            overdueFees: 0,
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            overdueAmount: 0,
          };
        }
        acc[studentId].totalFees++;
        acc[studentId].totalAmount += fee.amount;
        if (fee.status === FeeStatus.PAID) {
          acc[studentId].paidFees++;
          acc[studentId].paidAmount += fee.amount;
        }
        if (fee.status === FeeStatus.PENDING) {
          acc[studentId].pendingFees++;
          acc[studentId].pendingAmount += fee.amount;
        }
        if (fee.status === FeeStatus.OVERDUE) {
          acc[studentId].overdueFees++;
          acc[studentId].overdueAmount += fee.amount;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    const studentDetails = Object.values(studentStats).map((stat: any) => ({
      ...stat,
      totalAmount: stat.totalAmount.toFixed(2),
      paidAmount: stat.paidAmount.toFixed(2),
      pendingAmount: stat.pendingAmount.toFixed(2),
      overdueAmount: stat.overdueAmount.toFixed(2),
    }));

    return {
      summary: {
        totalFees,
        paidFees,
        pendingFees,
        overdueFees,
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        pendingAmount: pendingAmount.toFixed(2),
        overdueAmount: overdueAmount.toFixed(2),
      },
      byStudent: studentDetails,
      details: feesWithStatus,
    };
  }

  /**
   * Exams Report
   * Aggregated queries with role-based access
   */
  async getExamsReport(
    examsReportDto: ExamsReportDto,
    currentUser: { userId: string; role: Role; schoolId?: string },
  ) {
    const { studentId, classId, examId, examType } = examsReportDto;

    // Build where clause based on role
    const where: any = {};

    if (currentUser.role === Role.STUDENT) {
      // STUDENT can only view their own exam results
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
      // PARENT can view exam results for linked students
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
          summary: {
            totalExams: 0,
            totalResults: 0,
            averageMarks: '0.00',
            highestMarks: '0.00',
            lowestMarks: '0.00',
          },
          details: [],
        };
      }

      where.studentId = { in: linkedStudentIds };

      if (studentId && !linkedStudentIds.includes(studentId)) {
        throw new ForbiddenException(
          'Access denied. You can only view exam results for your linked students',
        );
      }
    } else if (
      currentUser.role === Role.SCHOOL_ADMIN ||
      currentUser.role === Role.TEACHER
    ) {
      // SCHOOL_ADMIN/TEACHER can view exam results in their school
      if (!currentUser.schoolId) {
        throw new ForbiddenException('User must be associated with a school');
      }

      where.exam = {
        class: {
          schoolId: currentUser.schoolId,
        },
      };

      if (classId) {
        where.exam.classId = classId;
      }

      if (studentId) {
        where.studentId = studentId;
      }

      if (examId) {
        where.examId = examId;
      }

      if (examType) {
        where.exam = {
          ...where.exam,
          type: examType,
        };
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    // Get all exam results
    const examResults = await this.prisma.examResult.findMany({
      where,
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            type: true,
            date: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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
          },
        },
      },
      orderBy: {
        exam: {
          date: 'desc',
        },
      },
    });

    // Calculate aggregated statistics
    const totalResults = examResults.length;
    const totalMarks = examResults.reduce((sum, r) => sum + r.marks, 0);
    const averageMarks =
      totalResults > 0 ? (totalMarks / totalResults).toFixed(2) : '0.00';
    const highestMarks =
      totalResults > 0
        ? Math.max(...examResults.map((r) => r.marks)).toFixed(2)
        : '0.00';
    const lowestMarks =
      totalResults > 0
        ? Math.min(...examResults.map((r) => r.marks)).toFixed(2)
        : '0.00';

    // Get unique exams
    const uniqueExamIds = [...new Set(examResults.map((r) => r.examId))];
    const totalExams = uniqueExamIds.length;

    // Group by exam for detailed breakdown
    const examStats = examResults.reduce(
      (acc, result) => {
        const examId = result.examId;
        if (!acc[examId]) {
          acc[examId] = {
            exam: result.exam,
            totalResults: 0,
            totalMarks: 0,
            highestMarks: 0,
            lowestMarks: Infinity,
          };
        }
        acc[examId].totalResults++;
        acc[examId].totalMarks += result.marks;
        if (result.marks > acc[examId].highestMarks) {
          acc[examId].highestMarks = result.marks;
        }
        if (result.marks < acc[examId].lowestMarks) {
          acc[examId].lowestMarks = result.marks;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    const examDetails = Object.values(examStats).map((stat: any) => ({
      ...stat,
      averageMarks:
        stat.totalResults > 0
          ? (stat.totalMarks / stat.totalResults).toFixed(2)
          : '0.00',
      highestMarks: stat.highestMarks.toFixed(2),
      lowestMarks:
        stat.lowestMarks === Infinity ? '0.00' : stat.lowestMarks.toFixed(2),
    }));

    // Group by student for detailed breakdown
    const studentStats = examResults.reduce(
      (acc, result) => {
        const studentId = result.studentId;
        if (!acc[studentId]) {
          acc[studentId] = {
            student: result.student,
            totalExams: 0,
            totalMarks: 0,
            highestMarks: 0,
            lowestMarks: Infinity,
          };
        }
        acc[studentId].totalExams++;
        acc[studentId].totalMarks += result.marks;
        if (result.marks > acc[studentId].highestMarks) {
          acc[studentId].highestMarks = result.marks;
        }
        if (result.marks < acc[studentId].lowestMarks) {
          acc[studentId].lowestMarks = result.marks;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    const studentDetails = Object.values(studentStats).map((stat: any) => ({
      ...stat,
      averageMarks:
        stat.totalExams > 0
          ? (stat.totalMarks / stat.totalExams).toFixed(2)
          : '0.00',
      highestMarks: stat.highestMarks.toFixed(2),
      lowestMarks:
        stat.lowestMarks === Infinity ? '0.00' : stat.lowestMarks.toFixed(2),
    }));

    return {
      summary: {
        totalExams,
        totalResults,
        averageMarks,
        highestMarks,
        lowestMarks,
      },
      byExam: examDetails,
      byStudent: studentDetails,
      details: examResults,
    };
  }
}
