import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsInt,
  IsUUID,
  IsOptional,
  MinLength,
  Min,
  IsArray,
} from 'class-validator';

export class CreateTeacherDto {
  // User fields
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  // Teacher profile fields
  @IsString()
  @IsNotEmpty()
  qualification: string;

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  experience: number;

  // Subject assignment (optional - can be assigned later)
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  subjectIds?: string[];
}
