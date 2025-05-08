import * as http from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../config/logger';
import agvManager from './AgvManager';
import rosProxyService from './RosProxyService';

class SocketService {
  private io: Server | null = null;

  initialize(server: http.Server): void {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // 初始化ROS代理服务
    rosProxyService.initialize(this.io);

    // 监听连接事件
    this.io.on('connection', (socket: Socket) => {
      logger.info(`客户端连接: ${socket.id}`);

      // 加入默认房间
      socket.join('all');

      // 监听断开连接事件
      socket.on('disconnect', () => {
        logger.info(`客户端断开连接: ${socket.id}`);
      });

      // 监听加入AGV房间事件
      socket.on('join:agv', (agvId: number) => {
        const roomName = `agv:${agvId}`;
        socket.join(roomName);
        logger.info(`客户端加入房间: ${roomName}`, { socketId: socket.id });
      });

      // 监听离开AGV房间事件
      socket.on('leave:agv', (agvId: number) => {
        const roomName = `agv:${agvId}`;
        socket.leave(roomName);
        logger.info(`客户端离开房间: ${roomName}`, { socketId: socket.id });
      });
    });

    // 监听AGV状态更新事件
    agvManager.on('status_update', (status) => {
      if (this.io) {
        this.io.to(`agv:${status.id}`).emit('agv:status_update', status);
        this.io.to('all').emit('agv:status_update', status);
      }
    });

    // 监听AGV消息事件
    agvManager.on('message', (agvId, message) => {
      if (this.io) {
        this.io.to(`agv:${agvId}`).emit('agv:message', { agvId, message });
      }
    });

    logger.info('Socket.IO服务已初始化');
  }

  // 广播消息给所有客户端
  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // 广播消息给特定房间
  broadcastToRoom(room: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }
}

export default new SocketService(); 