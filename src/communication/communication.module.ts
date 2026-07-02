import { Module } from '@nestjs/common';
import { NoticesModule } from './notices/notices.module';
import { AnnouncementsModule } from './announcements/announcements.module';

@Module({
  imports: [NoticesModule, AnnouncementsModule],
})
export class CommunicationModule {}
