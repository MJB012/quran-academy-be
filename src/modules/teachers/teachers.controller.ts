import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ListTeachersQuery } from './dto/list-teachers.query';
import { TeacherOnboardingDto } from './dto/onboarding.dto';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  list(@Query() query: ListTeachersQuery) {
    return this.teachers.list(query);
  }

  @Roles(UserRole.TEACHER)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.teachers.getMyProfile(user.userId);
  }

  @Roles(UserRole.TEACHER)
  @Post('onboarding')
  onboarding(@CurrentUser() user: AuthUser, @Body() dto: TeacherOnboardingDto) {
    return this.teachers.onboard(user.userId, dto);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.teachers.getById(id);
  }
}
