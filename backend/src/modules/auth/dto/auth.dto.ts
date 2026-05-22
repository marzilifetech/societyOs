import { IsString, IsPhoneNumber, IsUUID, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsPhoneNumber('IN')
  phone: string;

  @ApiProperty({ example: 'society-uuid' })
  @IsUUID('loose' as any)
  societyId: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsPhoneNumber('IN')
  phone: string;

  @ApiProperty({ example: 'society-uuid' })
  @IsUUID('loose' as any)
  societyId: string;

  // 4 digits from the external Marzi backend; 6 from in-house local OTP.
  @ApiProperty({ example: '1234' })
  @IsString()
  @Length(4, 6)
  otp: string;
}
