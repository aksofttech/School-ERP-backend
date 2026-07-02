import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get recent notifications for the logged-in user
   */
  @Get()
  async findAll(@Request() req, @Query('limit') limit?: number) {
    return this.notificationsService.findAll(req.user.userId, limit || 20);
  }

  /**
   * Get unread notifications for the bell icon
   */
  @Get('unread')
  async findAllUnread(@Request() req) {
    return this.notificationsService.findAllUnread(req.user.userId);
  }

  /**
   * Mark a notification as read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  /**
   * Mark all notifications as read
   */
  @Patch('read-all')
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }
}
