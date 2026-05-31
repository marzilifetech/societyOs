import { IsString, IsUUID, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Accept a real Indian mobile (10 digits, leading 6-9, optional +91/91 prefix)
// OR a reserved TEST number in the range 1111100001–1111100300 (300 numbers,
// suffix 00001–00300). No real Indian mobile starts with 1, so the test range
// can never collide with a live number. Used by QA to log in without a real SMS.
const TEST_SUFFIX = '(?:0000[1-9]|000[1-9]\\d|00[12]\\d\\d|00300)'; // 00001–00300
export const PHONE_PATTERN = new RegExp(
  `^(?:\\+?91)?(?:[6-9]\\d{9}|11111${TEST_SUFFIX})$`,
);
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
