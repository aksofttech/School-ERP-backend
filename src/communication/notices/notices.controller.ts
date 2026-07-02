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
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { ListNoticesDto } from './dto/list-notices.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { Role } from '@prisma/client';

@Controller('communication/notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.SUPER_ADMIN)
  create(@Body() createNoticeDto: CreateNoticeDto, @CurrentUser() user: any) {
    return this.noticesService.create(createNoticeDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get()
  findAll(@Query() listNoticesDto: ListNoticesDto, @CurrentUser() user: any) {
    return this.noticesService.findAll(listNoticesDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.noticesService.findOne(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Patch(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateNoticeDto: UpdateNoticeDto,
    @CurrentUser() user: any,
  ) {
    return this.noticesService.update(id, updateNoticeDto, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }

  @Delete(':id')
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.noticesService.remove(id, {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
    });
  }
}
