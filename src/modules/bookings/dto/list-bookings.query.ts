import { IsEnum, IsOptional } from 'class-validator';
import { BookingStatus } from '../schemas/booking.schema';

export class ListBookingsQuery {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
