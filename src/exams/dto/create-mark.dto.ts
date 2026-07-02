import { IsNotEmpty, IsUUID, IsNumber, Min, Max } from 'class-validator';

export class CreateMarkDto {
  @IsUUID()
  @IsNotEmpty()
  examId: string;

  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  marks: number;
}
