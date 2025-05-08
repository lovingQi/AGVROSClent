import WebSocket from 'ws';
import { Server } from 'http';
import { Socket } from 'socket.io';
import logger from '../config/logger';

/**
 * ROS代理服务，用于转发WebSocket连接
 */
class RosProxyService {
  private proxyConnections: Map<string, { 
    rosWs: WebSocket,
    clientIds: Set<string>
  }> = new Map();
  private io: any;

  /**
   * 初始化ROS代理服务
   * @param server HTTP服务器实例
   * @param io Socket.IO实例
   */
  initialize(io: any): void {
    this.io = io;
    
    // 监听客户端连接
    io.on('connection', (socket: Socket) => {
      logger.info(`客户端连接: ${socket.id}`);
      
      // 处理ROS连接请求
      socket.on('ros:connect', (data: { agvId: number, ipAddress: string, port: string }) => {
        this.handleRosConnect(socket, data);
      });
      
      // 处理ROS消息发送
      socket.on('ros:send', (data: { agvId: number, message: string }) => {
        this.handleRosSend(socket, data);
      });
      
      // 处理断开连接
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
    
    logger.info('ROS代理服务已初始化');
  }
  
  /**
   * 处理ROS连接请求
   */
  private handleRosConnect(socket: Socket, data: { agvId: number, ipAddress: string, port: string }): void {
    const { agvId, ipAddress, port } = data;
    const rosEndpoint = `ws://${ipAddress}:${port}`;
    const connectionKey = `${agvId}:${ipAddress}:${port}`;
    
    logger.info(`尝试连接到ROS: ${rosEndpoint}`, { agvId, socketId: socket.id });
    
    // 检查是否已存在连接
    if (this.proxyConnections.has(connectionKey)) {
      const connection = this.proxyConnections.get(connectionKey)!;
      connection.clientIds.add(socket.id);
      
      // 通知客户端连接成功
      socket.emit('ros:connected', { agvId, success: true });
      logger.info(`使用现有ROS连接: ${rosEndpoint}`, { agvId, socketId: socket.id });
      return;
    }
    
    // 创建新的WebSocket连接到ROS
    try {
      const rosWs = new WebSocket(rosEndpoint);
      
      rosWs.on('open', () => {
        // 保存连接
        this.proxyConnections.set(connectionKey, {
          rosWs,
          clientIds: new Set([socket.id])
        });
        
        // 通知客户端连接成功
        socket.emit('ros:connected', { agvId, success: true });
        logger.info(`ROS连接成功: ${rosEndpoint}`, { agvId, socketId: socket.id });
      });
      
      rosWs.on('message', (data: WebSocket.Data) => {
        // 转发ROS消息给所有相关客户端
        const connection = this.proxyConnections.get(connectionKey);
        if (connection) {
          const message = data.toString();
          connection.clientIds.forEach(clientId => {
            this.io.to(clientId).emit('ros:message', { agvId, message });
          });
        }
      });
      
      rosWs.on('error', (error: Error) => {
        logger.error(`ROS连接错误: ${error.message}`, { agvId, socketId: socket.id });
        socket.emit('ros:error', { agvId, error: error.message });
        this.cleanupConnection(connectionKey, socket.id);
      });
      
      rosWs.on('close', () => {
        logger.info(`ROS连接关闭: ${rosEndpoint}`, { agvId, socketId: socket.id });
        socket.emit('ros:disconnected', { agvId });
        this.cleanupConnection(connectionKey, socket.id);
      });
      
    } catch (error: any) {
      logger.error(`创建ROS连接失败: ${error.message}`, { agvId, socketId: socket.id });
      socket.emit('ros:error', { agvId, error: error.message });
    }
  }
  
  /**
   * 处理发送消息到ROS
   */
  private handleRosSend(socket: Socket, data: { agvId: number, message: string }): void {
    const { agvId, message } = data;
    
    try {
      const parsedMessage = JSON.parse(message);
      logger.info(`收到ROS消息请求: ${parsedMessage.op || '未知操作'}`, { 
        agvId, 
        socketId: socket.id,
        messageType: parsedMessage.op
      });
      
      // 特殊处理获取话题列表的请求
      if (parsedMessage.op === 'get_topics') {
        logger.info(`处理获取话题列表请求`, { agvId, socketId: socket.id });
      }
    } catch (e) {
      logger.error(`解析ROS消息请求失败`, { agvId, socketId: socket.id, error: e });
    }
    
    // 查找对应的ROS连接
    for (const [key, connection] of this.proxyConnections.entries()) {
      if (key.startsWith(`${agvId}:`)) {
        if (connection.clientIds.has(socket.id)) {
          connection.rosWs.send(message);
          return;
        }
      }
    }
    
    // 未找到连接
    socket.emit('ros:error', { agvId, error: '未连接到ROS' });
  }
  
  /**
   * 处理客户端断开连接
   */
  private handleDisconnect(socket: Socket): void {
    logger.info(`客户端断开连接: ${socket.id}`);
    
    // 清理所有相关连接
    for (const [key, connection] of this.proxyConnections.entries()) {
      if (connection.clientIds.has(socket.id)) {
        connection.clientIds.delete(socket.id);
        
        // 如果没有客户端使用此连接，则关闭WebSocket
        if (connection.clientIds.size === 0) {
          connection.rosWs.close();
          this.proxyConnections.delete(key);
          logger.info(`关闭未使用的ROS连接: ${key}`);
        }
      }
    }
  }
  
  /**
   * 清理连接
   */
  private cleanupConnection(connectionKey: string, socketId: string): void {
    const connection = this.proxyConnections.get(connectionKey);
    if (connection) {
      connection.clientIds.delete(socketId);
      if (connection.clientIds.size === 0) {
        try {
          connection.rosWs.close();
        } catch (e) {
          // 忽略关闭错误
        }
        this.proxyConnections.delete(connectionKey);
      }
    }
  }
}

export default new RosProxyService(); 