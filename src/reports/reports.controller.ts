import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AttendanceReportDto } from './dto/attendance-report.dto';
import { FeesReportDto } from './dto/fees-report.dto';
import { ExamsReportDto } from './dto/exams-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance')
  getAttendanceReport(
    @Query() attendanceReportDto: AttendanceReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getAttendanceReport(attendanceReportDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('fees')
  getFeesReport(
    @Query() feesReportDto: FeesReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getFeesReport(feesReportDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('exams')
  getExamsReport(
    @Query() examsReportDto: ExamsReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getExamsReport(examsReportDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
