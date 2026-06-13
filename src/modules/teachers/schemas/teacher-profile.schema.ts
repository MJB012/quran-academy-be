import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TeacherProfileDocument = HydratedDocument<TeacherProfile>;

@Schema({ timestamps: true })
export class TeacherProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  specializations!: string[];

  @Prop({ type: [String], default: [] })
  languages!: string[];

  @Prop({ trim: true })
  qualification?: string;

  @Prop({ default: 0 })
  hourlyRate!: number;

  @Prop({ trim: true, maxlength: 500 })
  bio?: string;

  @Prop({ default: 0, min: 0, max: 5 })
  avgRating!: number;

  @Prop({ default: 0 })
  studentsCount!: number;

  @Prop({ default: false })
  isOnboarded!: boolean;
}

export const TeacherProfileSchema = SchemaFactory.createForClass(TeacherProfile);

TeacherProfileSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = r._id;
    delete r._id;
    return r;
  },
});
