import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { CreatePostDto, CreateCommentDto } from './dto/community.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SocietyId } from '../../common/decorators/society.decorator';

@ApiTags('community')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('community')
export class CommunityController {
  constructor(private communityService: CommunityService) {}

  @Get('posts')
  getPosts(
    @SocietyId() societyId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.communityService.getPosts(societyId, +page, +limit, user.sub);
  }

  @Post('posts')
  createPost(@CurrentUser() user: JwtPayload, @SocietyId() societyId: string, @Body() dto: CreatePostDto) {
    return this.communityService.createPost(user.sub, societyId, dto);
  }

  @Post('posts/:id/like')
  likePost(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.communityService.toggleLike(id, user.sub);
  }

  @Post('posts/:id/react')
  reactToPost(@Param('id') id: string) {
    return this.communityService.reactToPost(id);
  }

  @Get('posts/:id/comments')
  getComments(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.communityService.getComments(id, +page, +limit);
  }

  @Post('posts/:id/comments')
  addComment(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateCommentDto) {
    return this.communityService.addComment(id, user.sub, dto);
  }

  @Patch('posts/:id/pin')
  pinPost(
    @Param('id') id: string,
    @SocietyId() societyId: string,
    @Body() body: { isPinned: boolean },
  ) {
    return this.communityService.pinPost(id, societyId, body.isPinned);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.communityService.deletePost(id, user.sub, user.role);
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.communityService.getPost(id);
  }
}
