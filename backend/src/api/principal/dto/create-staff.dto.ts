import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ description: 'Staff full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Staff email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Staff phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNo?: string;

  @ApiProperty({ description: 'Staff role', enum: ['FACULTY', 'MENTOR', 'ADMIN'] })
  @IsEnum(['FACULTY', 'MENTOR', 'ADMIN'])
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'Department', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ description: 'Designation', required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ description: 'Employee ID', required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;
}
