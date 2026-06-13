import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UserRole } from '../../common/enums/user-role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dob?: Date;
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: input.email.toLowerCase() }).lean();
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    return this.userModel.create(input);
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password');
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByIdWithPassword(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('+password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateProfileDto): Promise<UserDocument> {
    if (dto.email) {
      const existing = await this.userModel
        .findOne({ email: dto.email.toLowerCase(), _id: { $ne: new Types.ObjectId(id) } })
        .lean();
      if (existing) throw new ConflictException('Email is already in use');
    }
    const user = await this.userModel.findByIdAndUpdate(id, dto, { new: true });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { password });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { emailVerified: true });
  }
}
