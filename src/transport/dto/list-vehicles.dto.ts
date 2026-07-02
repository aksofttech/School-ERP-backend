import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/utils/pagination.dto';

export class ListVehiclesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @Type(() => String)
  route?: string;
}
