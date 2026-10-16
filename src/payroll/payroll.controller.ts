import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayrollService, DisburseSalaryDto, ListPayrollParams } from './payroll.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getDashboard(
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.payrollService.getPayrollDashboard(user, { month, status, search });
  }

  @Get('staff')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async getStaffList(@CurrentUser() user: any) {
    return this.payrollService.getStaffList(user);
  }

  @Post('disburse')
  @Roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
  async disburse(
    @CurrentUser() user: any,
    @Body() dto: DisburseSalaryDto,
  ) {
    return this.payrollService.disburseOrSave(user, dto);
  }
}
