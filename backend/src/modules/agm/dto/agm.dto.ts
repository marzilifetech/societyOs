import { IsArray, IsString, IsEnum, IsOptional, IsISO8601, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgmMeetingStatus } from '@prisma/client';

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

/**
 * Create an AGM / general-body meeting.
 *
 * There was no create endpoint at all before — the admin screen POSTed
 * /agm/meetings and got a 404, so no meeting could ever be scheduled.
 */
export class CreateAgmMeetingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Meeting date/time (ISO-8601)' })
  @IsISO8601()
  date: string;

  @ApiPropertyOptional({ type: [String], description: 'Agenda items, in order' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agenda?: string[];

  @ApiPropertyOptional({ enum: AgmMeetingStatus })
  @IsOptional()
  @IsEnum(AgmMeetingStatus)
  status?: AgmMeetingStatus;
}

export class UpdateAgmMeetingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Meeting date/time (ISO-8601)' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agenda?: string[];

  @ApiPropertyOptional({ enum: AgmMeetingStatus })
  @IsOptional()
  @IsEnum(AgmMeetingStatus)
  status?: AgmMeetingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minutesUrl?: string;
}
