import {
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFeeDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  amount: number;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
