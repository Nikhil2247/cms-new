import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateStudentDto {
  @ApiProperty({ description: 'Student full name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Student email address', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Student contact number', required: false })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({ description: 'Batch ID', required: false })
  @IsString()
  @IsOptional()
  batchId?: string;

  @ApiProperty({ description: 'Semester ID', required: false })
  @IsString()
  @IsOptional()
  semesterId?: string;

  @ApiProperty({ description: 'Date of birth', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Gender', enum: ['MALE', 'FEMALE', 'OTHER'], required: false })
  @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  @IsOptional()
  gender?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Active status', required: false })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
