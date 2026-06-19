import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { TeacherProfile, TeacherProfileSchema } from './schemas/teacher-profile.schema';
import { TeachersController } from './teachers.controller';
import { TeachersGateway } from './teachers.gateway';
import { TeachersService } from './teachers.service';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: TeacherProfile.name, schema: TeacherProfileSchema }]),
  ],
  controllers: [TeachersController],
  providers: [TeachersService, TeachersGateway],
  exports: [TeachersService],
})
export class TeachersModule {}
