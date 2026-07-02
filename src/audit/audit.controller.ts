import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  findAll(
    @Query() listAuditLogsDto: ListAuditLogsDto,
    @CurrentUser() user: any,
  ) {
    return this.auditService.findAll(listAuditLogsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('statistics')
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  getActivityStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.auditService.getActivityStatistics(
      {
        userId: user.userId,
        role: user.role,
        schoolId: user.schoolId,
      },
      startDate,
      endDate,
    );
  }

  @Get('user/:userId')
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  findByUser(
    @Param('userId') userId: string,
    @Query() listAuditLogsDto: ListAuditLogsDto,
    @CurrentUser() user: any,
  ) {
    return this.auditService.findByUser(userId, listAuditLogsDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('user/:userId/summary')
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  getUserActivitySummary(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.auditService.getUserActivitySummary(userId, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.auditService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
