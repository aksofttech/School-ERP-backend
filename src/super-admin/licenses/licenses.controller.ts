import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('super-admin/licenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
  ) {
    return this.licensesService.findAll(search, plan);
  }

  @Get('stats')
  getStats() {
    return this.licensesService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.licensesService.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.licensesService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.licensesService.update(id, body);
  }

  @Post(':id/renew')
  renew(@Param('id') id: string) {
    return this.licensesService.renew(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.licensesService.remove(id);
  }
}
