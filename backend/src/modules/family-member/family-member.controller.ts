import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FamilyMemberService } from './family-member.service';
import { CreateFamilyMemberDto, UpdateFamilyMemberDto } from './dto/family-member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('family-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RESIDENT)
@Controller('family-members')
export class FamilyMemberController {
  constructor(private familyMemberService: FamilyMemberService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFamilyMemberDto) {
    return this.familyMemberService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.familyMemberService.findAll(user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: UpdateFamilyMemberDto) {
    return this.familyMemberService.update(id, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.familyMemberService.remove(id, user.sub);
  }
}
