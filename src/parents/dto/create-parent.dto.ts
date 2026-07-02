import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsUUID,
  IsOptional,
  MinLength,
  IsArray,
} from 'class-validator';

export class CreateParentDto {
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

  // Student mapping (optional - can be added later)
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  studentIds?: string[];
}
