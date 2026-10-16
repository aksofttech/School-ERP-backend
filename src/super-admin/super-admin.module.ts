import { Module } from '@nestjs/common';
import { SchoolsModule } from './schools/schools.module';
import { PlansModule } from './plans/plans.module';
import { SystemLogsModule } from './system-logs/system-logs.module';
import { LicensesModule } from './licenses/licenses.module';

@Module({
  imports: [SchoolsModule, PlansModule, SystemLogsModule, LicensesModule],
})
export class SuperAdminModule {}
