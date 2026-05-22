import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PropertyService } from './property.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateListingDto {
  @ApiProperty() @IsNumber() areaSqft: number;
  @ApiProperty() @IsNumber() price: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() furnished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() photos?: string[];
}

class ContactSellerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() message?: string;
}

@ApiTags('property')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Controller('property')
export class PropertyController {
  constructor(private propertyService: PropertyService) {}

  @Get()
  @Roles(UserRole.RESIDENT)
  getListings(@SocietyId() societyId: string) {
    return this.propertyService.getListings(societyId);
  }

  @Get('my')
  @Roles(UserRole.RESIDENT)
  getMyListings(@CurrentUser() user: JwtPayload) {
    return this.propertyService.getMyListings(user.sub);
  }

  @Get('my-rental')
  @Roles(UserRole.RESIDENT)
  getMyRental(@CurrentUser() user: JwtPayload) {
    return this.propertyService.getMyRental(user.sub);
  }

  @Get(':id')
  @Roles(UserRole.RESIDENT)
  getListing(@Param('id') id: string) {
    return this.propertyService.getListing(id);
  }

  @Post()
  @Roles(UserRole.RESIDENT)
  createListing(
    @CurrentUser() user: JwtPayload,
    @SocietyId() societyId: string,
    @Body() dto: CreateListingDto,
  ) {
    return this.propertyService.createListing(user.sub, societyId, dto);
  }

  @Post(':id/contact')
  @Roles(UserRole.RESIDENT)
  contactSeller(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ContactSellerDto,
  ) {
    return this.propertyService.contactSeller(id, user.sub, dto.message);
  }

  @Patch(':id/close')
  @Roles(UserRole.RESIDENT)
  closeListing(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.propertyService.closeListing(id, user.sub);
  }
}
