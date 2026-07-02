import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { MarksService } from './marks.service';
import { MarksController } from './marks.controller';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExamsController, MarksController, ResultsController],
  providers: [ExamsService, MarksService, ResultsService, AnalyticsService],
  exports: [ExamsService, MarksService, ResultsService, AnalyticsService],
})
export class ExamsModule {}
