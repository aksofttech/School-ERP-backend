import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { SystemLogsService } from './system-logs.service';
import { PaginationDto } from '../../common/utils/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('super-admin/system-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemLogsController {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.systemLogsService.findAll(paginationDto);
  }

  @Get('health')
  getHealth() {
    return this.systemLogsService.getHealth();
  }

  @Post('run-diagnostics')
  runDiagnostics() {
    return this.systemLogsService.runDiagnostics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.systemLogsService.findOne(id);
  }
}
