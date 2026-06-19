import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace } from 'socket.io';

/**
 * Real-time channel for the verified-teacher list.
 *
 * Students connect to the `/teachers` socket.io namespace; simply being
 * connected makes them a subscriber. Whenever a teacher's visibility changes
 * (completes onboarding, edits their profile, or verifies their email), the
 * server emits a `changed` event so clients can refetch GET /teachers.
 */
@WebSocketGateway({ namespace: '/teachers', cors: { origin: '*' } })
export class TeachersGateway {
  private readonly logger = new Logger(TeachersGateway.name);

  @WebSocketServer() server!: Namespace;

  /** Notify every connected student that the verified-teacher list changed. */
  broadcastChanged(): void {
    this.server.emit('changed');
    this.logger.log('broadcast: teachers list changed');
  }
}
