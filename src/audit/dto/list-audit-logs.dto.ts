import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ListAuditLogsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string; // Filter by action (e.g., 'CREATE', 'UPDATE', 'DELETE')

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
