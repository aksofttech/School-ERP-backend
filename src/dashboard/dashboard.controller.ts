import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles(Role.SCHOOL_ADMIN)
  getAdminDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getAdminStats({
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('teacher')
  @Roles(Role.TEACHER)
  getTeacherDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getTeacherStats(user.userId, user.schoolId);
  }

  @Get('student')
  @Roles(Role.STUDENT)
  getStudentDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getStudentStats(user.userId, user.schoolId);
  }

  @Get('parent')
  @Roles(Role.PARENT)
  getParentDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getParentStats(user.userId, user.schoolId);
  }

  @Get('super-admin')
  @Roles(Role.SUPER_ADMIN)
  getSuperAdminDashboard() {
    return this.dashboardService.getSuperAdminStats();
  }
}
