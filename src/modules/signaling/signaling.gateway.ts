import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { SignalingMessage, SocketData } from './signaling.types';

/**
 * WebRTC signaling relay.
 *
 * Clients connect over socket.io and exchange a single `signal` event whose
 * body is a {@link SignalingMessage}. The server keeps no media — it only
 * relays SDP/ICE between the two peers sharing a `roomId` and announces
 * peer presence so the existing peer knows when to create the offer.
 *
 * Flow for a 1-on-1 call (peer A joins first, then B):
 *   B emits  {type:'join'}  -> server emits {type:'peer-joined', from:B} to A
 *   A creates offer         -> {type:'offer'}  relayed to B
 *   B creates answer        -> {type:'answer'} relayed to A
 *   both                    -> {type:'ice-candidate'} relayed to each other
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SignalingGateway.name);

  @WebSocketServer() server!: Server;

  handleConnection(client: Socket): void {
    this.logger.log(`socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const { roomId, userId } = (client.data ?? {}) as SocketData;
    if (roomId) {
      client.to(roomId).emit('signal', {
        type: 'peer-left',
        roomId,
        from: userId,
      } satisfies SignalingMessage);
      this.logger.log(`socket ${client.id} (${userId}) left room ${roomId}`);
    }
  }

  @SubscribeMessage('signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: SignalingMessage,
  ): void {
    if (!message?.roomId || !message?.type) return;
    const { roomId, type, from } = message;

    switch (type) {
      case 'join': {
        (client.data as SocketData) = { roomId, userId: from };
        void client.join(roomId);
        // Tell peers already in the room; the existing peer makes the offer.
        client.to(roomId).emit('signal', {
          type: 'peer-joined',
          roomId,
          from,
        } satisfies SignalingMessage);
        this.logger.log(`${from} joined room ${roomId}`);
        break;
      }
      case 'leave': {
        client.to(roomId).emit('signal', {
          type: 'peer-left',
          roomId,
          from,
        } satisfies SignalingMessage);
        void client.leave(roomId);
        break;
      }
      default: {
        // offer / answer / ice-candidate -> relay to the rest of the room.
        client.to(roomId).emit('signal', message);
        break;
      }
    }
  }
}
