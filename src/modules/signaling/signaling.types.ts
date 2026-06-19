/**
 * Wire format for WebRTC signaling messages relayed between peers.
 * Mirrors the mobile app's SignalingMessage so the same JSON flows end-to-end.
 */
export type SignalingMessageType =
  | 'join'
  | 'leave'
  | 'peer-joined'
  | 'peer-left'
  | 'offer'
  | 'answer'
  | 'ice-candidate';

export interface SignalingMessage {
  type: SignalingMessageType;
  roomId: string;
  /** ID of the user sending the message */
  from?: string;
  /** Optional target user ID (for direct addressing) */
  to?: string;
  /** Free-form payload — SDP, ICE candidate, etc. */
  payload?: unknown;
}

/** Per-socket state we track so we can notify the room on disconnect. */
export interface SocketData {
  roomId?: string;
  userId?: string;
}
