import { IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';
import { TicketStatus } from './update-ticket.dto';

export class ListTicketsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @Type(() => String)
  priority?: string;
}
