import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SettingsService, GlobalSettingsData } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/user.decorator';

@Controller(['settings', 'super-admin/settings'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    if (user?.role === Role.SCHOOL_ADMIN) {
      const schoolId =
        user?.schoolId || (await this.prisma.school.findFirst())?.id;
      const school = schoolId
        ? await this.prisma.school.findUnique({ where: { id: schoolId } })
        : await this.prisma.school.findFirst();

      return {
        institutionName: school?.name || 'Vidya Mandir Senior Secondary School',
        address: school?.address || 'Plot 42, Knowledge Park, Mansarovar, Jaipur, Rajasthan',
        contactEmail: school?.email || 'contact@vidyamandir.edu.in',
        phone: school?.phone || '0141-2789100',
        accreditationNo: 'CBSE-AFF-2024-RJ092',
        currency: 'INR',
        currencySymbol: '₹',
        academicYear: '2026-2027',
        schoolCode: school?.code || 'VMSSS-JPR',
        id: school?.id || schoolId,
      };
    }
    return this.settingsService.findAll();
  }

  @Get('academic-years')
  async getAcademicYears() {
    return [
      { id: '1', name: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isActive: true },
      { id: '2', name: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31', isActive: false },
    ];
  }

  @Put()
  async updateAll(@CurrentUser() user: any, @Body() body: any) {
    if (user?.role === Role.SCHOOL_ADMIN) {
      const schoolId =
        user?.schoolId || (await this.prisma.school.findFirst())?.id;
      if (schoolId) {
        const updated = await this.prisma.school.update({
          where: { id: schoolId },
          data: {
            ...(body.institutionName ? { name: body.institutionName } : {}),
            ...(body.address ? { address: body.address } : {}),
            ...(body.contactEmail ? { email: body.contactEmail } : {}),
            ...(body.phone ? { phone: body.phone } : {}),
          },
        });
        return {
          institutionName: updated.name,
          address: updated.address,
          contactEmail: updated.email,
          phone: updated.phone,
          accreditationNo: body.accreditationNo || 'CBSE-AFF-2024-RJ092',
          currency: body.currency || 'INR',
          currencySymbol: '₹',
          academicYear: '2026-2027',
          schoolCode: updated.code,
        };
      }
    }
    return this.settingsService.updateAll(body);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  saveSettings(@Body() body: Partial<GlobalSettingsData>) {
    return this.settingsService.updateAll(body);
  }

  @Post('test-email')
  @Roles(Role.SUPER_ADMIN)
  sendTestEmail(@Body('email') email: string) {
    return this.settingsService.sendTestEmail(email);
  }

  @Post('backup-db')
  @Roles(Role.SUPER_ADMIN)
  backupDb() {
    return this.settingsService.backupDb();
  }

  @Post('clear-cache')
  @Roles(Role.SUPER_ADMIN)
  clearCache() {
    return this.settingsService.clearCache();
  }

  @Get(':key')
  @Roles(Role.SUPER_ADMIN)
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Patch(':key')
  @Roles(Role.SUPER_ADMIN)
  update(@Param('key') key: string, @Body() body: any) {
    return this.settingsService.update(key, body);
  }
}

