import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class GenerateResultDto {
  @IsString()
  @IsNotEmpty()
  examId: string;

  @IsString()
  @IsOptional()
  classId?: string;
}
