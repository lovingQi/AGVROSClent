import { RosMessage } from '../types/agv';
import io, { Socket } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// 全局存储所有ROS连接实例
const globalConnectionInstances: Record<string, RosConnection> = {};

class RosConnection {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private agvId: number = 0;
  private ipAddress: string = '';
  private port: string = '9090';
  private messageHandlers: Map<string, ((message: RosMessage) => void)[]> = new Map();
  private topicSubscriptions: Set<string> = new Set();
  private static globalSocket: Socket | null = null;

  // 获取单例实例
  static getInstance(ipAddressOrAgvId: string, port: string = '9090'): RosConnection {
    // 将AGV ID转换为字符串以用作键
    const key = ipAddressOrAgvId;
    
    if (!globalConnectionInstances[key]) {
      console.log(`创建新的RosConnection实例: ${key}`);
      globalConnectionInstances[key] = new RosConnection(ipAddressOrAgvId, port);
    } else {
      console.log(`使用现有的RosConnection实例: ${key}`);
    }
    
    return globalConnectionInstances[key];
  }

  constructor(ipAddressOrAgvId: string, port: string = '9090') {
    // 判断输入是IP地址还是AGV ID
    if (/^\d+$/.test(ipAddressOrAgvId)) {
      // 如果是纯数字，视为AGV ID
      this.agvId = parseInt(ipAddressOrAgvId, 10);
      // 根据AGV ID映射IP地址
      if (this.agvId === 1) {
        this.ipAddress = '172.10.25.121'; // AGV-001
      } else if (this.agvId === 2) {
        this.ipAddress = '172.10.25.126'; // AGV-002
      } else {
        this.ipAddress = `1.1.1.${this.agvId}`; // 其他ID暂用1.1.1.x表示
      }
    } else {
      // 否则视为IP地址
      this.ipAddress = ipAddressOrAgvId;
      // 根据IP地址映射AGV ID
      if (this.ipAddress === '172.10.25.121') {
        this.agvId = 1; // AGV-001
      } else if (this.ipAddress === '172.10.25.126') {
        this.agvId = 2; // AGV-002
      } else {
        this.agvId = 2; // 其他IP地址暂用ID 2
      }
    }
    
    this.port = port;
  }

  connect(): Promise<boolean> {
    // 如果已经连接，直接返回成功
    if (this.connected && this.socket) {
      console.log(`已经连接到AGV-${this.agvId}的ROS系统`);
      return Promise.resolve(true);
    }
    
    return new Promise((resolve, reject) => {
      try {
        // 尝试使用全局Socket.IO连接
        if (RosConnection.globalSocket && RosConnection.globalSocket.connected) {
          console.log('使用现有的全局Socket.IO连接');
          this.socket = RosConnection.globalSocket;
          this.setupSocketEventHandlers(resolve, reject);
        } else {
          console.log('创建新的Socket.IO连接');
          // 连接到Socket.IO服务器
          this.socket = io(API_URL, {
            transports: ['websocket'],
            forceNew: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
          });
          
          RosConnection.globalSocket = this.socket;
          this.setupSocketEventHandlers(resolve, reject);
        }
      } catch (error) {
        console.error('创建Socket.IO连接失败:', error);
        reject(error);
      }
    });
  }
  
  private setupSocketEventHandlers(resolve: (value: boolean) => void, reject: (reason?: any) => void): void {
    if (!this.socket) return;
    const socket = this.socket;
    
    // 检查是否已连接到Socket.IO
    if (socket.connected) {
      console.log('Socket.IO已连接，直接加入AGV房间');
      this.joinAgvRoom(socket, resolve, reject);
    } else {
      // 设置连接事件处理
      socket.on('connect', () => {
        console.log('已连接到Socket.IO服务器');
        this.joinAgvRoom(socket, resolve, reject);
      });
    }
    
    // 处理Socket.IO错误
    socket.on('connect_error', (error) => {
      console.error('Socket.IO连接错误:', error);
      reject(error);
    });
    
    // 处理Socket.IO断开连接
    socket.on('disconnect', () => {
      console.log('已断开与Socket.IO服务器的连接');
      this.connected = false;
    });
  }
  
  private joinAgvRoom(socket: Socket, resolve: (value: boolean) => void, reject: (reason?: any) => void): void {
    // 加入AGV房间
    socket.emit('join:agv', this.agvId);
    
    // 请求连接到ROS
    socket.emit('ros:connect', {
      agvId: this.agvId,
      ipAddress: this.ipAddress,
      port: this.port
    });
    
    // 移除之前的监听器，避免重复
    socket.off('ros:connected');
    socket.off('ros:error');
    socket.off('ros:disconnected');
    socket.off('ros:message');
    
    // 处理ROS连接成功
    socket.on('ros:connected', (data: { agvId: number, success: boolean }) => {
      if (data.agvId === this.agvId && data.success) {
        this.connected = true;
        console.log(`已成功连接到AGV-${this.agvId}的ROS系统`);
        resolve(true);
        
        // 如果有之前的话题订阅，需要重新订阅
        if (this.topicSubscriptions.size > 0) {
          console.log('重新订阅之前的话题...');
          // 先清除之前的订阅
          const topics = Array.from(this.topicSubscriptions);
          this.topicSubscriptions.clear();
          
          // 对每个话题重新获取类型并订阅
          topics.forEach(async (topic) => {
            try {
              // 获取话题类型
              const type = await this.getTopicType(topic);
              if (type && type !== '未知') {
                // 找到对应的回调函数
                const handlers = this.messageHandlers.get(topic);
                if (handlers && handlers.length > 0) {
                  // 重新订阅
                  console.log(`重新订阅话题 ${topic}，类型: ${type}`);
                  this.doSubscribe(topic, type, handlers[0]);
                }
              } else {
                console.warn(`无法获取话题 ${topic} 的类型，跳过重新订阅`);
              }
            } catch (error) {
              console.error(`重新订阅话题 ${topic} 失败:`, error);
            }
          });
        }
      }
    });
    
    // 处理ROS连接错误
    socket.on('ros:error', (data: { agvId: number, error: string }) => {
      if (data.agvId === this.agvId) {
        this.connected = false;
        console.error(`ROS连接错误: ${data.error}`);
        reject(new Error(data.error));
      }
    });
    
    // 处理ROS断开连接
    socket.on('ros:disconnected', (data: { agvId: number }) => {
      if (data.agvId === this.agvId) {
        this.connected = false;
        console.log(`已断开与AGV-${this.agvId}的ROS连接`);
      }
    });
    
    // 处理ROS消息
    socket.on('ros:message', (data: { agvId: number, message: string }) => {
      if (data.agvId === this.agvId) {
        try {
          console.log(`收到ROS消息(${this.agvId}):`, data.message.substring(0, 100) + (data.message.length > 100 ? '...' : ''));
          const rosMsg = JSON.parse(data.message);
          
          // 检查是否是服务响应
          if (rosMsg.op === 'service_response') {
            console.log('收到服务响应:', rosMsg);
            // 这里可以处理服务响应
            return;
          }
          
          // 检查是否是话题消息（publish操作）
          if (rosMsg.op === 'publish') {
            const topic = rosMsg.topic;
            
            if (topic && this.messageHandlers.has(topic)) {
              const handlers = this.messageHandlers.get(topic)!;
              handlers.forEach(handler => {
                handler({
                  topic: topic,
                  type: rosMsg.type || 'unknown',
                  data: rosMsg.msg || rosMsg
                });
              });
            }
            return;
          }
          
          // 检查旧格式的话题消息
          const topic = rosMsg.topic;
          if (topic && this.messageHandlers.has(topic)) {
            const handlers = this.messageHandlers.get(topic)!;
            handlers.forEach(handler => {
              handler({
                topic: topic,
                type: rosMsg.type || 'unknown',
                data: rosMsg.msg || rosMsg
              });
            });
          }
        } catch (error) {
          console.error('解析ROS消息失败:', error);
        }
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      console.log(`断开连接: AGV-${this.agvId}`);
      
      // 取消所有订阅
      this.topicSubscriptions.forEach(topic => {
        this.unsubscribe(topic);
      });
      
      // 仅离开房间，不断开Socket.IO连接
      this.socket.emit('leave:agv', this.agvId);
      
      this.connected = false;
      this.messageHandlers.clear();
      this.topicSubscriptions.clear();
    }
  }

  close(): void {
    this.disconnect();
    
    // 移除全局实例
    delete globalConnectionInstances[this.ipAddress];
    delete globalConnectionInstances[this.agvId.toString()];
    
    // 如果这是最后一个实例，也关闭全局Socket.IO连接
    if (Object.keys(globalConnectionInstances).length === 0 && RosConnection.globalSocket) {
      console.log('关闭全局Socket.IO连接');
      RosConnection.globalSocket.disconnect();
      RosConnection.globalSocket = null;
    }
  }

  getTopics(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        console.error('Socket连接未建立');
        reject('Socket连接未建立');
        return;
      }

      console.log('正在获取话题列表...');
      
      // 创建唯一的服务调用ID
      const serviceCallId = `get_topics_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 向ROS发送获取话题的请求
      this.sendToRos({
        op: 'call_service',
        id: serviceCallId,
        service: '/rosapi/topics',
        args: {}
      });

      // 设置超时
      const timeoutId = setTimeout(() => {
        console.error('获取话题列表超时');
        reject('获取话题列表超时');
      }, 5000);

      // 处理响应消息
      const messageHandler = (data: { agvId: number, message: string }) => {
        try {
          const rosMsg = JSON.parse(data.message);
          
          // 检查是否是我们的服务调用响应
          if (rosMsg.op === 'service_response' && rosMsg.id === serviceCallId) {
            clearTimeout(timeoutId);
            this.socket?.off('ros:message', messageHandler);
            
            console.log('收到话题列表响应:', rosMsg);
            
            // 解析话题列表
            let topics: string[] = [];
            
            if (rosMsg.values && rosMsg.values.topics) {
              topics = rosMsg.values.topics;
            } else if (rosMsg.result && rosMsg.result.topics) {
              topics = rosMsg.result.topics;
            } else if (Array.isArray(rosMsg.values)) {
              topics = rosMsg.values;
            } else if (Array.isArray(rosMsg.result)) {
              topics = rosMsg.result;
            }
            
            console.log('解析后的话题列表:', topics);
            resolve(topics);
          }
        } catch (error) {
          console.error('解析话题列表响应失败:', error);
        }
      };

      this.socket.on('ros:message', messageHandler);
    });
  }

  subscribe(topicName: string, messageType: string, callback: (message: RosMessage) => void): void {
    if (!this.socket || !this.connected) {
      throw new Error('未连接到ROS');
    }

    // 检查消息类型是否有效
    if (!messageType || messageType === '未知' || messageType === 'unknown') {
      console.warn(`警告: 订阅话题 ${topicName} 时使用了无效的消息类型: "${messageType}"`);
      console.warn('尝试先获取话题类型再订阅');
      
      // 尝试获取话题类型
      this.getTopicType(topicName)
        .then(validType => {
          if (validType && validType !== '未知') {
            console.log(`成功获取到话题 ${topicName} 的类型: ${validType}，重新订阅`);
            this.doSubscribe(topicName, validType, callback);
          } else {
            console.error(`无法获取话题 ${topicName} 的有效类型，无法订阅`);
            throw new Error(`无法获取话题 ${topicName} 的有效类型`);
          }
        })
        .catch(error => {
          console.error(`获取话题 ${topicName} 类型失败:`, error);
          throw error;
        });
      
      return;
    }
    
    // 执行订阅
    this.doSubscribe(topicName, messageType, callback);
  }
  
  // 实际执行订阅的方法
  private doSubscribe(topicName: string, messageType: string, callback: (message: RosMessage) => void): void {
    // 记录订阅
    this.topicSubscriptions.add(topicName);
    
    // 添加消息处理器
    if (!this.messageHandlers.has(topicName)) {
      this.messageHandlers.set(topicName, []);
    }
    this.messageHandlers.get(topicName)!.push(callback);
    
    // 发送订阅请求
    this.sendToRos({
      op: 'subscribe',
      topic: topicName,
      type: messageType,
      throttle_rate: 100,  // 限制消息速率，每100毫秒最多一条消息
      queue_length: 10     // 队列长度，超过时丢弃旧消息
    });
    
    console.log(`已订阅话题: ${topicName} (类型: ${messageType})`);
  }
  
  // 获取话题类型
  getTopicType(topic: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('未连接到ROS'));
        return;
      }
      
      console.log(`正在获取话题 ${topic} 的类型...`);
      
      // 创建唯一的服务调用ID
      const serviceCallId = `topic_type_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 发送服务调用请求
      this.sendToRos({
        op: 'call_service',
        id: serviceCallId,
        service: '/rosapi/topic_type',
        args: { topic }
      });
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        console.error(`获取话题 ${topic} 类型超时`);
        reject(new Error(`获取话题 ${topic} 类型超时`));
      }, 3000);
      
      // 处理响应消息
      const messageHandler = (data: { agvId: number, message: string }) => {
        if (data.agvId !== this.agvId) return;
        
        try {
          const rosMsg = JSON.parse(data.message);
          
          // 检查是否是我们的服务调用响应
          if (rosMsg.op === 'service_response' && rosMsg.id === serviceCallId) {
            clearTimeout(timeoutId);
            this.socket?.off('ros:message', messageHandler);
            
            console.log(`收到话题 ${topic} 类型响应:`, rosMsg);
            
            // 解析话题类型
            let topicType = '未知';
            
            if (rosMsg.values && rosMsg.values.type) {
              topicType = rosMsg.values.type;
            } else if (rosMsg.result && rosMsg.result.type) {
              topicType = rosMsg.result.type;
            }
            
            console.log(`话题 ${topic} 的类型: ${topicType}`);
            resolve(topicType);
          }
        } catch (error) {
          console.error(`解析话题 ${topic} 类型响应失败:`, error);
        }
      };
      
      this.socket.on('ros:message', messageHandler);
    });
  }

  unsubscribe(topicName: string): void {
    if (this.socket && this.connected) {
      // 发送取消订阅请求
      this.sendToRos({
        op: 'unsubscribe',
        topic: topicName
      });
      
      console.log(`已取消订阅话题: ${topicName}`);
      
      // 移除订阅记录
      this.topicSubscriptions.delete(topicName);
      
      // 移除消息处理器
      this.messageHandlers.delete(topicName);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
  
  private sendToRos(message: any): void {
    if (this.socket && this.connected) {
      this.socket.emit('ros:send', {
        agvId: this.agvId,
        message: JSON.stringify(message)
      });
    }
  }
}

export default RosConnection; 