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

@Controller(['settings', 'super-admin/settings'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Put()
  updateAll(@Body() body: Partial<GlobalSettingsData>) {
    return this.settingsService.updateAll(body);
  }

  @Post()
  saveSettings(@Body() body: Partial<GlobalSettingsData>) {
    return this.settingsService.updateAll(body);
  }

  @Post('test-email')
  sendTestEmail(@Body('email') email: string) {
    return this.settingsService.sendTestEmail(email);
  }

  @Post('backup-db')
  backupDb() {
    return this.settingsService.backupDb();
  }

  @Post('clear-cache')
  clearCache() {
    return this.settingsService.clearCache();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() body: any) {
    return this.settingsService.update(key, body);
  }
}
