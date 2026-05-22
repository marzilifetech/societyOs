import { IsString, IsEnum, IsOptional, IsISO8601 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VoteChoice {
  FOR = 'FOR',
  AGAINST = 'AGAINST',
  ABSTAIN = 'ABSTAIN',
}

export class VoteDto {
  @ApiProperty()
  @IsString()
  resolutionId: string;

  @ApiProperty({ enum: VoteChoice })
  @IsEnum(VoteChoice)
  vote: VoteChoice;
}

export class CastResolutionVoteDto {
  @ApiProperty({ enum: VoteChoice })
  @IsEnum(VoteChoice)
  vote: VoteChoice;
}

export class AssignProxyDto {
  @ApiProperty({ description: 'Resident ID of the proxy voter' })
  @IsString()
  residentId: string;
}

export class CreateResolutionDto {
  @ApiProperty()
  @IsString()
  meetingId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Voting deadline (ISO-8601)' })
  @IsISO8601()
  votingDeadline: string;
}
