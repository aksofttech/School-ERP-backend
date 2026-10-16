import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

export interface ListPayrollParams {
  month?: string;
  status?: string;
  search?: string;
}

export interface DisburseSalaryDto {
  id?: string;
  staffId?: string;
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
  netSalary?: number;
  month?: string;
  paymentMethod?: string;
  transactionId?: string;
  remarks?: string;
  status?: string;
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  private async getEffectiveSchoolId(currentUser: { userId: string; role: Role; schoolId?: string | null }): Promise<string> {
    if (currentUser.schoolId) {
      return currentUser.schoolId;
    }
    // Fallback for SUPER_ADMIN or missing schoolId
    const firstSchool = await this.prisma.school.findFirst({
      select: { id: true },
    });
    if (!firstSchool) {
      throw new BadRequestException('No school found in database');
    }
    return firstSchool.id;
  }

  async getPayrollDashboard(
    currentUser: { userId: string; role: Role; schoolId?: string | null },
    params: ListPayrollParams = {},
  ) {
    const schoolId = await this.getEffectiveSchoolId(currentUser);

    const whereClause: any = { schoolId };

    if (params.month && params.month !== 'all') {
      whereClause.month = params.month;
    }

    if (params.status && params.status !== 'all') {
      whereClause.status = params.status.toUpperCase();
    }

    // Fetch payments
    const payments = await this.prisma.staffPayment.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            phone: true,
            teacher: {
              select: {
                qualification: true,
                experience: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // In-memory filter for search term if provided
    let filteredPayments = payments;
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filteredPayments = payments.filter((p) => {
        const staffName = `${p.staff.firstName} ${p.staff.lastName}`.toLowerCase();
        const email = p.staff.email.toLowerCase();
        const txn = (p.transactionId || '').toLowerCase();
        const remarks = (p.remarks || '').toLowerCase();
        return staffName.includes(q) || email.includes(q) || txn.includes(q) || remarks.includes(q);
      });
    }

    // Get all records for overall stats
    const allRecordsForSchool = await this.prisma.staffPayment.findMany({
      where: {
        schoolId,
        ...(params.month && params.month !== 'all' ? { month: params.month } : {}),
      },
    });

    const totalPayroll = allRecordsForSchool.reduce((sum, p) => sum + p.netSalary, 0);
    const paidRecords = allRecordsForSchool.filter((p) => p.status === 'PAID');
    const pendingRecords = allRecordsForSchool.filter((p) => p.status === 'PENDING');

    const totalPaid = paidRecords.reduce((sum, p) => sum + p.netSalary, 0);
    const totalPending = pendingRecords.reduce((sum, p) => sum + p.netSalary, 0);

    // Get all staff count for school
    const staffCount = await this.prisma.user.count({
      where: {
        schoolId,
        role: { in: [Role.TEACHER, Role.SCHOOL_ADMIN] },
      },
    });

    // Get list of distinct months
    const allMonthsRaw = await this.prisma.staffPayment.findMany({
      where: { schoolId },
      select: { month: true },
      distinct: ['month'],
      orderBy: { createdAt: 'desc' },
    });

    const availableMonths = allMonthsRaw.map((m) => m.month);

    return {
      payments: filteredPayments,
      stats: {
        totalPayroll,
        totalPaid,
        totalPending,
        paidCount: paidRecords.length,
        pendingCount: pendingRecords.length,
        totalStaff: staffCount,
      },
      availableMonths: availableMonths.length > 0 ? availableMonths : ['October 2026', 'September 2026'],
    };
  }

  async getStaffList(currentUser: { userId: string; role: Role; schoolId?: string | null }) {
    const schoolId = await this.getEffectiveSchoolId(currentUser);

    const staffMembers = await this.prisma.user.findMany({
      where: {
        schoolId,
        role: { in: [Role.TEACHER, Role.SCHOOL_ADMIN] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        phone: true,
        teacher: {
          select: {
            qualification: true,
            experience: true,
          },
        },
        staffPayments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            basicSalary: true,
            allowances: true,
            deductions: true,
            netSalary: true,
          },
        },
      },
    });

    return staffMembers.map((s) => {
      const lastPayment = s.staffPayments[0];
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        email: s.email,
        role: s.role,
        phone: s.phone,
        qualification: s.teacher?.qualification || (s.role === Role.SCHOOL_ADMIN ? 'Management' : 'Staff'),
        defaultBasic: lastPayment?.basicSalary || 40000,
        defaultAllowances: lastPayment?.allowances || 4000,
        defaultDeductions: lastPayment?.deductions || 2000,
      };
    });
  }

  async disburseOrSave(
    currentUser: { userId: string; role: Role; schoolId?: string | null },
    dto: DisburseSalaryDto,
  ) {
    const schoolId = await this.getEffectiveSchoolId(currentUser);

    // If ID is provided, this is an update / disbursal of an existing payment
    if (dto.id) {
      const existing = await this.prisma.staffPayment.findUnique({
        where: { id: dto.id },
      });

      if (!existing || existing.schoolId !== schoolId) {
        throw new NotFoundException('Payment record not found');
      }

      const updated = await this.prisma.staffPayment.update({
        where: { id: dto.id },
        data: {
          status: dto.status || 'PAID',
          paymentDate: dto.status === 'PENDING' ? null : (existing.paymentDate || new Date()),
          paymentMethod: dto.paymentMethod || existing.paymentMethod,
          transactionId: dto.transactionId || existing.transactionId || `TXN-${Date.now()}`,
          remarks: dto.remarks !== undefined ? dto.remarks : existing.remarks,
        },
        include: {
          staff: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return updated;
    }

    // Creating a new salary record
    if (!dto.staffId) {
      throw new BadRequestException('Staff ID is required');
    }

    const staffUser = await this.prisma.user.findUnique({
      where: { id: dto.staffId },
    });

    if (!staffUser || staffUser.schoolId !== schoolId) {
      throw new BadRequestException('Staff member does not belong to this school');
    }

    const basicSalary = Number(dto.basicSalary) || 0;
    const allowances = Number(dto.allowances) || 0;
    const deductions = Number(dto.deductions) || 0;
    const netSalary = basicSalary + allowances - deductions;
    const month = dto.month || 'October 2026';
    const status = dto.status || 'PAID';
    const isPaid = status === 'PAID';

    const created = await this.prisma.staffPayment.create({
      data: {
        schoolId,
        staffId: dto.staffId,
        basicSalary,
        allowances,
        deductions,
        netSalary,
        month,
        status,
        paymentDate: isPaid ? new Date() : null,
        paymentMethod: dto.paymentMethod || 'Bank Transfer',
        transactionId: isPaid ? (dto.transactionId || `TXN-${Date.now()}`) : null,
        remarks: dto.remarks || `Salary for ${month}`,
      },
      include: {
        staff: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return created;
  }
}
