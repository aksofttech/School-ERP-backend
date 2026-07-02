import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StudentsModule } from './students/students.module';
import { ParentsModule } from './parents/parents.module';
import { TeachersModule } from './teachers/teachers.module';
import { ClassesModule } from './classes/classes.module';
import { SectionsModule } from './sections/sections.module';
import { SubjectsModule } from './subjects/subjects.module';
import { AttendanceModule } from './attendance/attendance.module';
import { TimetableModule } from './timetable/timetable.module';
import { ExamsModule } from './exams/exams.module';
import { HomeworkModule } from './homework/homework.module';
import { FeesModule } from './fees/fees.module';
import { TransportModule } from './transport/transport.module';
import { CommunicationModule } from './communication/communication.module';
import { DocumentsModule } from './documents/documents.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { SupportModule } from './support/support.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';
import authConfig from './config/auth.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    StudentsModule,
    ParentsModule,
    TeachersModule,
    ClassesModule,
    SectionsModule,
    SubjectsModule,
    AttendanceModule,
    TimetableModule,
    ExamsModule,
    HomeworkModule,
    FeesModule,
    TransportModule,
    CommunicationModule,
    DocumentsModule,
    ReportsModule,
    SettingsModule,
    AuditModule,
    SupportModule,
    SuperAdminModule,
    DashboardModule,
    NotificationsModule,
    AuthModule,
    PrismaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
