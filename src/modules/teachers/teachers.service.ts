import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TeacherOnboardingDto } from './dto/onboarding.dto';
import { ListTeachersQuery } from './dto/list-teachers.query';
import { TeacherProfile, TeacherProfileDocument } from './schemas/teacher-profile.schema';

export interface TeacherView {
  id: string;
  name: string;
  qualification: string;
  rating: number;
  studentsCount: number;
  specializations: string[];
  languages: string[];
  pricePerHour: number;
}

@Injectable()
export class TeachersService {
  constructor(
    @InjectModel(TeacherProfile.name) private readonly profileModel: Model<TeacherProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async onboard(userId: string, dto: TeacherOnboardingDto): Promise<TeacherProfileDocument> {
    const uid = new Types.ObjectId(userId);
    const updated = await this.profileModel.findOneAndUpdate(
      { userId: uid },
      { $set: { ...dto, userId: uid, isOnboarded: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return updated!;
  }

  async getMyProfile(userId: string): Promise<TeacherProfileDocument | null> {
    return this.profileModel.findOne({ userId: new Types.ObjectId(userId) });
  }

  async list(query: ListTeachersQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = { isOnboarded: true };
    if (query.specialization) filter.specializations = query.specialization;
    if (query.language) filter.languages = query.language;

    const [profiles, total] = await Promise.all([
      this.profileModel
        .find(filter)
        .sort({ avgRating: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.profileModel.countDocuments(filter),
    ]);

    const users = await this.userModel
      .find({ _id: { $in: profiles.map((p) => p.userId) }, role: UserRole.TEACHER })
      .lean();

    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    let items: TeacherView[] = profiles
      .map((p) => {
        const user = userById.get(p.userId.toString());
        if (!user) return null;
        return {
          id: p.userId.toString(),
          name: `${user.firstName} ${user.lastName}`,
          qualification: p.qualification ?? '',
          rating: p.avgRating,
          studentsCount: p.studentsCount,
          specializations: p.specializations,
          languages: p.languages,
          pricePerHour: p.hourlyRate,
        };
      })
      .filter((v): v is TeacherView => v !== null);

    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.qualification.toLowerCase().includes(q) ||
          t.specializations.some((s) => s.toLowerCase().includes(q)),
      );
    }

    return { items, total, page, limit };
  }

  async getById(id: string): Promise<TeacherView> {
    const uid = new Types.ObjectId(id);
    const [profile, user] = await Promise.all([
      this.profileModel.findOne({ userId: uid }).lean(),
      this.userModel.findOne({ _id: uid, role: UserRole.TEACHER }).lean(),
    ]);
    if (!profile || !user) throw new NotFoundException('Teacher not found');
    return {
      id: user._id.toString(),
      name: `${user.firstName} ${user.lastName}`,
      qualification: profile.qualification ?? '',
      rating: profile.avgRating,
      studentsCount: profile.studentsCount,
      specializations: profile.specializations,
      languages: profile.languages,
      pricePerHour: profile.hourlyRate,
    };
  }
}
