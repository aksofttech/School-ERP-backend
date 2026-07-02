import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateFeeDto } from './create-fee.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { FeeStatus } from '@prisma/client';

export class UpdateFeeDto extends PartialType(
  OmitType(CreateFeeDto, ['studentId'] as const),
) {
  @IsEnum(FeeStatus)
  @IsOptional()
  status?: FeeStatus;
}
