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
import { TimetableService } from './timetable.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { CreateWeeklyTimetableDto } from './dto/create-weekly-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { ViewTimetableDto } from './dto/view-timetable.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('timetable')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Post()
  @Roles(Role.SCHOOL_ADMIN)
  create(
    @Body() createTimetableDto: CreateTimetableDto,
    @CurrentUser() user: any,
  ) {
    return this.timetableService.create(createTimetableDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Post('weekly')
  @Roles(Role.SCHOOL_ADMIN)
  createWeekly(
    @Body() createWeeklyTimetableDto: CreateWeeklyTimetableDto,
    @CurrentUser() user: any,
  ) {
    return this.timetableService.createWeekly(createWeeklyTimetableDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  findAll(
    @Query() viewTimetableDto: ViewTimetableDto,
    @CurrentUser() user: any,
  ) {
    return this.timetableService.findAll(viewTimetableDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('my-timetable')
  @Roles(Role.TEACHER)
  getMyTimetable(@CurrentUser() user: any) {
    return this.timetableService.getMyTimetable({
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get('class/:classId')
  findByClass(
    @Param('classId') classId: string,
    @Query() viewTimetableDto: ViewTimetableDto,
    @CurrentUser() user: any,
  ) {
    return this.timetableService.findByClass(classId, viewTimetableDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timetableService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.SCHOOL_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateTimetableDto: UpdateTimetableDto,
    @CurrentUser() user: any,
  ) {
    return this.timetableService.update(id, updateTimetableDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.SCHOOL_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.timetableService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
