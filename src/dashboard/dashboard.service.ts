import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, AttendanceStatus, FeeStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard statistics for admin
   */
  async getAdminStats(currentUser: {
    userId: string;
    role: Role;
    schoolId?: string;
  }) {
    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'School admin must be associated with a school',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total students count
    const totalStudents = await this.prisma.student.count({
      where: {
        schoolId: currentUser.schoolId,
        user: {
          isActive: true,
        },
      },
    });

    // Get total teachers count
    const totalTeachers = await this.prisma.teacher.count({
      where: {
        schoolId: currentUser.schoolId,
        user: {
          isActive: true,
        },
      },
    });

    // Get active classes count
    const activeClasses = await this.prisma.class.count({
      where: {
        schoolId: currentUser.schoolId,
      },
    });

    // Get today's attendance statistics
    const todayAttendance = await this.prisma.attendance.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
        student: {
          schoolId: currentUser.schoolId,
        },
      },
    });

    const totalTodayAttendance = todayAttendance.length;
    const presentCount = todayAttendance.filter(
      (a) => a.status === AttendanceStatus.PRESENT,
    ).length;
    const attendancePercentage =
      totalTodayAttendance > 0
        ? Math.round((presentCount / totalTodayAttendance) * 100)
        : 0;

    // Get recent activities (last 10) - filter by users in the same school
    const recentActivities = await this.prisma.auditLog.findMany({
      where: {
        user: {
          schoolId: currentUser.schoolId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get attendance history for the last 7 days
    const attendanceHistory = [];
    
    // Find the start date (6 days ago, start of day)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(0, 0, 0, 0);

    const fullWeekAttendance = await this.prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lt: endDate },
        student: { schoolId: currentUser.schoolId },
      },
      select: {
        date: true,
        status: true,
      }
    });

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayAttendance = fullWeekAttendance.filter(a => a.date >= date && a.date < nextDay);

      const total = dayAttendance.length;
      const present = dayAttendance.filter(
        (a) => a.status === AttendanceStatus.PRESENT,
      ).length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      attendanceHistory.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        percentage,
      });
    }

    // Get resource counts
    const totalVehicles = await this.prisma.vehicle.count({
      where: { schoolId: currentUser.schoolId },
    });

    // Get total users for this school
    const totalUsers = await this.prisma.user.count({
      where: { schoolId: currentUser.schoolId, isActive: true },
    });

    return {
      statistics: {
        totalStudents,
        totalTeachers,
        totalUsers,
        activeClasses,
        todayAttendance: attendancePercentage,
        totalVehicles,
      },
      attendanceHistory,
      recentActivities: recentActivities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        user: activity.user
          ? `${activity.user.firstName} ${activity.user.lastName}`
          : 'System',
        createdAt: activity.createdAt,
      })),
    };
  }

  /**
   * Get teacher dashboard statistics
   */
  async getTeacherStats(userId: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) throw new ForbiddenException('Teacher profile not found');

    // Get classes associated with this teacher via Timetable
    const timetables = await this.prisma.timetable.findMany({
      where: { teacherId: teacher.id },
      select: { classId: true },
    });

    const classIds = [...new Set(timetables.map((t) => t.classId))];

    // Total unique students in teacher's classes
    let finalClassIds = classIds;
    if (finalClassIds.length === 0) {
      const schoolClasses = await this.prisma.class.findMany({
        where: { schoolId: teacher.schoolId },
        select: { id: true }
      });
      finalClassIds = schoolClasses.map(c => c.id);
    }

    const totalStudents = await this.prisma.student.count({
      where: { classId: { in: finalClassIds } },
    });

    // Attendance rate for teacher's classes (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendance = await this.prisma.attendance.findMany({
      where: {
        student: { classId: { in: finalClassIds } },
        date: { gte: thirtyDaysAgo },
      },
    });

    const totalAttendance = attendance.length;
    const presentCount = attendance.filter(
      (a) => a.status === AttendanceStatus.PRESENT,
    ).length;
    const attendanceRate =
      totalAttendance > 0
        ? Math.round((presentCount / totalAttendance) * 100)
        : 0;

    // Grade analytics (Average marks per class for this teacher)
    const topClassIds = classIds.slice(0, 5);
    const classesWithExams = await this.prisma.class.findMany({
      where: { id: { in: topClassIds } },
      select: {
        id: true,
        name: true,
        exams: {
          select: {
            results: {
              select: { marks: true }
            }
          }
        }
      }
    });

    const gradeAnalytics = classesWithExams.map((cls) => {
      let totalMarks = 0;
      let count = 0;

      cls.exams.forEach((exam) => {
        exam.results.forEach((result) => {
          totalMarks += result.marks;
          count++;
        });
      });

      return {
        label: cls.name || 'Class',
        average: count > 0 ? Math.round(totalMarks / count) : 0,
      };
    });

    const upcomingHomework = await this.prisma.homework.findMany({
      where: { teacherId: teacher.id },
      orderBy: { dueDate: 'asc' },
      take: 5,
      include: { class: true, subject: true },
    });

    return {
      statistics: {
        totalClasses: finalClassIds.length,
        totalStudents,
        attendanceRate,
        rating: '4.9/5',
      },
      upcomingHomework: upcomingHomework.map((h) => ({
        id: h.id,
        title: h.title,
        dueDate: h.dueDate,
        class: h.class.name,
        subject: h.subject.name,
      })),
      gradeAnalytics,
    };
  }

  /**
   * Get student dashboard statistics
   */
  async getStudentStats(userId: string, schoolId: string) {
    console.log(`[DashboardService] Getting stats for student: ${userId}`);
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        class: true,
        section: true,
      },
    });

    if (!student) {
      console.error(
        `[DashboardService] Student profile not found for userId: ${userId}`,
      );
      throw new ForbiddenException('Student profile not found');
    }

    const homework = await this.prisma.homework.findMany({
      where: { classId: student.classId },
      orderBy: { dueDate: 'desc' },
      take: 5,
      include: { subject: true, teacher: { include: { user: true } } },
    });

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
      take: 30,
    });

    const presentDays = attendanceRecords.filter(
      (a) => a.status === AttendanceStatus.PRESENT,
    ).length;
    const attendanceRate =
      attendanceRecords.length > 0
        ? Math.round((presentDays / attendanceRecords.length) * 100)
        : 0;

    // Get today's schedule
    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const todayDay = days[new Date().getDay()] as any;

    const todaySchedule = await this.prisma.timetable.findMany({
      where: {
        classId: student.classId,
        day: todayDay,
      },
      orderBy: { startTime: 'asc' },
      include: { subject: true, teacher: { include: { user: true } } },
    });

    // Get relevant notices
    const notices = await this.prisma.notice.findMany({
      where: {
        schoolId,
        audience: { in: ['ALL', 'STUDENTS'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    return {
      studentId: student.id,
      statistics: {
        attendanceRate,
        pendingHomework: homework.length,
        examsUpcoming: 0, // Could be count of future exams
      },
      homework,
      recentAttendance: attendanceRecords.slice(0, 5),
      todaySchedule: todaySchedule.map((s) => ({
        id: s.id,
        time: s.startTime,
        subject: s.subject.name,
        teacher: `${s.teacher.user.firstName} ${s.teacher.user.lastName}`,
        room: s.room || 'N/A',
      })),
      notices,
    };
  }

  /**
   * Get parent dashboard statistics
   */
  async getParentStats(userId: string, schoolId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      include: {
        students: {
          include: {
            user: true,
            class: true,
            fees: {
              where: { status: FeeStatus.PENDING },
            },
            attendance: {
              orderBy: { date: 'desc' },
              take: 30,
            },
          },
        },
      },
    });

    if (!parent) throw new ForbiddenException('Parent profile not found');

    const childrenData = parent.students.map((child) => {
      const pendingFees = child.fees.reduce((sum, fee) => sum + fee.amount, 0);

      const presentDays = child.attendance.filter(
        (a) => a.status === AttendanceStatus.PRESENT,
      ).length;
      const attendanceRate =
        child.attendance.length > 0
          ? Math.round((presentDays / child.attendance.length) * 100)
          : 0;

      return {
        id: child.id,
        name: `${child.user.firstName} ${child.user.lastName}`,
        class: child.class.name,
        pendingFees,
        attendanceRate,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.user.firstName}`,
      };
    });

    // Get recent activities for all children
    const childIds = parent.students.map((s) => s.id);
    const recentActivities = await this.prisma.homework.findMany({
      where: {
        classId: { in: parent.students.map((s) => s.classId) },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { class: true, subject: true },
    });

    return {
      children: childrenData,
      totalPendingFees: childrenData.reduce(
        (sum, child) => sum + child.pendingFees,
        0,
      ),
      recentActivities: recentActivities.map((act) => ({
        id: act.id,
        type: 'Academics',
        title: act.title,
        detail: `New homework assigned for ${act.class.name} (${act.subject.name})`,
        date: act.createdAt,
      })),
    };
  }

  /**
   * Get super admin global statistics
   */
  async getSuperAdminStats() {
    const totalSchools = await this.prisma.school.count();
    const totalStudents = await this.prisma.student.count();
    const totalTeachers = await this.prisma.teacher.count();
    const totalUsers = await this.prisma.user.count();

    const recentSchools = await this.prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      statistics: {
        totalSchools,
        totalStudents,
        totalTeachers,
        totalUsers,
      },
      recentSchools,
    };
  }
}
