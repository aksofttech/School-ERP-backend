import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ReportsService } from '../reports/reports.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { ViewAttendanceDto } from './dto/view-attendance.dto';
import { MonthlyReportDto } from './dto/monthly-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly reportsService: ReportsService,
  ) {}

  @Post('mark')
  @Roles(Role.TEACHER)
  markAttendance(
    @Body() markAttendanceDto: MarkAttendanceDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.markAttendance(markAttendanceDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  @Roles(
    Role.TEACHER,
    Role.STUDENT,
    Role.PARENT,
    Role.SCHOOL_ADMIN,
    Role.SUPER_ADMIN,
  )
  findAll(
    @Query() viewAttendanceDto: ViewAttendanceDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.findAll(viewAttendanceDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('reports')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  getReports(@Query() query: any, @CurrentUser() user: any) {
    // Map frontend 'start/end' to 'startDate/endDate' if needed
    const reportDto = {
      ...query,
      startDate: query.startDate || query.start,
      endDate: query.endDate || query.end,
    };

    return this.reportsService.getAttendanceReport(reportDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('monthly-report')
  @Roles(Role.TEACHER, Role.STUDENT, Role.PARENT, Role.SCHOOL_ADMIN)
  getMonthlyReport(
    @Query() monthlyReportDto: MonthlyReportDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.getMonthlyReport(monthlyReportDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.TEACHER)
  update(
    @Param('id') id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.update(id, updateAttendanceDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.attendanceService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
