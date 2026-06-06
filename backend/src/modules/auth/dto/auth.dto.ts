import { IsString, IsUUID, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Accept a real Indian mobile (10 digits, leading 6-9, optional +91/91 prefix)
// OR any reserved TEST number in the 11111 series (10 digits, leading 11111 —
// i.e. 1111100000–1111199999). No real Indian mobile starts with 1, so the test
// range can never collide with a live number. Used by QA / admin to log in.
export const PHONE_PATTERN = /^(?:\+?91)?(?:[6-9]\d{9}|11111\d{5})$/;
const PHONE_MESSAGE = 'phone must be a valid Indian mobile number';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone: string;

  @ApiProperty({ example: 'society-uuid' })
  @IsUUID('loose' as any)
  societyId: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
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
