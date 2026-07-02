import { IsNotEmpty, IsUUID, IsString, Matches } from 'class-validator';

export class MonthlyReportDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Month must be in format YYYY-MM (e.g., 2024-01)',
  })
  month: string; // Format: YYYY-MM
}
