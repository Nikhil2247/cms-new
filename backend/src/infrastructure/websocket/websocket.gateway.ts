import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TokenService } from '../../core/auth/services/token.service';
import {
  WebSocketEvent,
  AdminChannel,
  AdminRoles,
  RoomPatterns,
  SocketUserData,
  WebSocketSubscriber,
  MarkAsReadPayload,
} from './dto';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class UnifiedWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UnifiedWebSocketGateway.name);

  // Track all connected users: userId -> Set of socketIds
  private userSockets: Map<string, Set<string>> = new Map();

  // Track all subscribers with detailed info
  private subscribers: Map<string, WebSocketSubscriber> = new Map();

  constructor(private readonly tokenService: TokenService) {}

  afterInit(): void {
    this.logger.log('Unified WebSocket Gateway initialized');
  }

  /**
   * Handle new WebSocket connection
   * Validates JWT and joins user to appropriate rooms
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Connection rejected: No token - ${client.id}`);
        client.emit(WebSocketEvent.ERROR, { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.tokenService.validateAccessToken(token);

      if (!payload || !payload.sub) {
        this.logger.warn(`Connection rejected: Invalid token - ${client.id}`);
        client.emit(WebSocketEvent.ERROR, { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      // Token stores roles as array, get first role
      const role = (payload.roles?.[0] || payload.role) as Role;
      const institutionId = payload.institutionId;

      // Store user data in socket
      const userData: SocketUserData = {
        userId,
        email: payload.email,
        role,
        institutionId,
      };
      client.data = userData;

      // Join user-specific room (for personal notifications)
      await client.join(RoomPatterns.USER(userId));

      // Join role-specific room
      await client.join(RoomPatterns.ROLE(role));

      // Join institution room if applicable
      if (institutionId) {
        await client.join(RoomPatterns.INSTITUTION(institutionId));
      }

      // Join admin rooms if user has admin role
      if (AdminRoles.includes(role)) {
        await client.join(AdminChannel.METRICS);
        await client.join(AdminChannel.SESSIONS);

        // Only SYSTEM_ADMIN can access backup channel
        if (role === Role.SYSTEM_ADMIN) {
          await client.join(AdminChannel.BACKUP);
          await client.join(AdminChannel.USERS);
        }
      }

      // Track socket for this user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Track subscriber info
      this.subscribers.set(client.id, {
        socketId: client.id,
        userId,
        role,
        institutionId,
        connectedAt: new Date(),
      });

      this.logger.log(`Client connected: ${client.id} (User: ${userId}, Role: ${role})`);

      // Emit connection success
      client.emit(WebSocketEvent.CONNECTED, {
        userId,
        role,
        message: 'Connected to WebSocket',
        rooms: Array.from(client.rooms),
      });
    } catch (error) {
      // Log token expiration as warn (expected behavior) vs other errors
      if (error.message?.includes('expired')) {
        this.logger.warn(`Connection rejected: Token expired - ${client.id}`);
      } else {
        this.logger.error(`Connection error: ${error.message}`, error.stack);
      }
      client.emit(WebSocketEvent.ERROR, { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: Socket): void {
    const userData = client.data as SocketUserData;
    const userId = userData?.userId;

    if (userId) {
      // Remove socket from user tracking
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    // Remove from subscribers
    this.subscribers.delete(client.id);

    this.logger.log(`Client disconnected: ${client.id} (User: ${userId || 'unknown'})`);
  }

  /**
   * Handle mark as read event from client
   */
  @SubscribeMessage(WebSocketEvent.MARK_AS_READ)
  handleMarkAsRead(
    @MessageBody() data: MarkAsReadPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const userData = client.data as SocketUserData;
    if (!userData?.userId) {
      client.emit(WebSocketEvent.ERROR, { message: 'Not authenticated' });
      return;
    }

    this.logger.debug(`User ${userData.userId} marking notification ${data.notificationId} as read`);
    client.emit(WebSocketEvent.MARK_AS_READ_ACK, { notificationId: data.notificationId });
  }

  /**
   * Handle client requesting metrics refresh (admin only)
   */
  @SubscribeMessage('refreshMetrics')
  handleRefreshMetrics(@ConnectedSocket() client: Socket): void {
    const userData = client.data as SocketUserData;
    if (!userData?.userId || !AdminRoles.includes(userData.role)) {
      client.emit(WebSocketEvent.ERROR, { message: 'Not authorized' });
      return;
    }
    // The actual metrics will be emitted by MetricsService
    client.emit('metricsRefreshRequested', { timestamp: new Date() });
  }

  /**
   * Handle client requesting session refresh (admin only)
   */
  @SubscribeMessage('refreshSessions')
  handleRefreshSessions(@ConnectedSocket() client: Socket): void {
    const userData = client.data as SocketUserData;
    if (!userData?.userId || !AdminRoles.includes(userData.role)) {
      client.emit(WebSocketEvent.ERROR, { message: 'Not authorized' });
      return;
    }
    client.emit('sessionsRefreshRequested', { timestamp: new Date() });
  }

  // ============ Public Methods for WebSocketService ============

  /**
   * Get the Socket.io server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Emit to a specific room
   */
  emitToRoom(room: string, event: string, data: any): void {
    const roomSockets = this.server.sockets.adapter.rooms.get(room);
    const socketCount = roomSockets ? roomSockets.size : 0;

    // Only log important events or when there are subscribers
    if (socketCount > 0 || event.includes('Progress') || event.includes('Alert')) {
      this.logger.debug(`Emitting '${event}' to room '${room}' (${socketCount} subscribers)`);
    }

    this.server.to(room).emit(event, data);
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  /**
   * Get count of connected users
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get total socket count
   */
  getTotalSocketsCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get all subscribers in a specific room
   */
  getSubscribersInRoom(room: string): WebSocketSubscriber[] {
    const result: WebSocketSubscriber[] = [];
    for (const [socketId, subscriber] of this.subscribers) {
      // Check if this socket is in the room
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket && socket.rooms.has(room)) {
        result.push(subscriber);
      }
    }
    return result;
  }

  /**
   * Get admin subscribers count
   */
  getAdminSubscribersCount(): number {
    let count = 0;
    for (const subscriber of this.subscribers.values()) {
      if (AdminRoles.includes(subscriber.role)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Extract JWT token from socket handshake
   */
  private extractToken(client: Socket): string | null {
    // Try query parameter first (for browser compatibility)
    const queryToken = client.handshake.query.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Try auth object
    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    // Try Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
