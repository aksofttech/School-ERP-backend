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
  Request,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { PaginationDto } from '../../common/utils/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('super-admin/schools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  create(
    @Body() createSchoolDto: CreateSchoolDto,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.schoolsService.create(createSchoolDto, user.userId, ip);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.schoolsService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.schoolsService.update(id, updateSchoolDto, user.userId, ip);
  }

  @Delete(':id/deactivate')
  deactivate(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.schoolsService.deactivate(id, user.userId, ip);
  }
}
