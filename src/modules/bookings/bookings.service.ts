import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';
import { TeachersService } from '../teachers/teachers.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQuery } from './dto/list-bookings.query';
import { Booking, BookingDocument, BookingStatus } from './schemas/booking.schema';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly teachers: TeachersService,
  ) {}

  async create(studentId: string, dto: CreateBookingDto): Promise<BookingDocument> {
    const teacher = await this.teachers.getById(dto.teacherId);
    const totalAmount = +((teacher.pricePerHour * dto.durationMins) / 60).toFixed(2);
    const booking = await this.bookingModel.create({
      studentId: new Types.ObjectId(studentId),
      teacherId: new Types.ObjectId(dto.teacherId),
      date: new Date(dto.date),
      timeSlot: dto.timeSlot,
      durationMins: dto.durationMins,
      subject: dto.subject,
      totalAmount,
      status: BookingStatus.PENDING,
    });
    return booking;
  }

  async listForUser(userId: string, role: UserRole, query: ListBookingsQuery) {
    const filter: Record<string, unknown> =
      role === UserRole.STUDENT
        ? { studentId: new Types.ObjectId(userId) }
        : { teacherId: new Types.ObjectId(userId) };
    if (query.status) filter.status = query.status;
    return this.bookingModel
      .find(filter)
      .sort({ date: 1 })
      .populate('studentId', 'firstName lastName')
      .populate('teacherId', 'firstName lastName')
      .lean();
  }

  async getOne(id: string, userId: string, role: UserRole): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');
    const owner = role === UserRole.STUDENT ? booking.studentId : booking.teacherId;
    if (owner.toString() !== userId) throw new ForbiddenException('Not your booking');
    return booking;
  }

  async cancel(id: string, userId: string, role: UserRole): Promise<BookingDocument> {
    const booking = await this.getOne(id, userId, role);
    if (booking.status === BookingStatus.COMPLETED) {
      throw new ForbiddenException('Cannot cancel a completed session');
    }
    booking.status = BookingStatus.CANCELLED;
    await booking.save();
    return booking;
  }

  async confirm(id: string, userId: string): Promise<BookingDocument> {
    const booking = await this.getOne(id, userId, UserRole.STUDENT);
    if (booking.status !== BookingStatus.PENDING) {
      throw new ForbiddenException('Only pending bookings can be confirmed');
    }
    booking.status = BookingStatus.CONFIRMED;
    await booking.save();
    return booking;
  }
}
