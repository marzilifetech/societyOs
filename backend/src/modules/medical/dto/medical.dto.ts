import { IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  doctorId: string;

  @ApiProperty({ example: '2025-06-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  timeSlot: string;
}

export class CancelAppointmentDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
