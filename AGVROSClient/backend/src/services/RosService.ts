import * as ROSLIB from 'roslib';
import { EventEmitter } from 'events';
import { AgvStatus, RosTopicInfo, RosMessage, Position } from '../models/agv';
import logger from '../config/logger';

class RosService extends EventEmitter {
  private ros: ROSLIB.Ros | null = null;
  private agvId: number;
  private agvName: string;
  private ipAddress: string;
  private rosPort: string;
  private connected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscribers: Map<string, ROSLIB.Topic> = new Map();
  private agvStatus: AgvStatus;

  constructor(agvId: number, agvName: string, ipAddress: string, rosPort: string) {
    super();
    this.agvId = agvId;
    this.agvName = agvName;
    this.ipAddress = ipAddress;
    this.rosPort = rosPort;

    // 初始化AGV状态
    this.agvStatus = {
      id: agvId,
      name: agvName,
      status: 'offline',
      ipAddress: ipAddress,
      batteryLevel: 0,
      speed: 0,
      lastUpdated: new Date()
    };
  }

  connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.connected && this.ros) {
        resolve(true);
        return;
      }

      // 清除之前的重连定时器
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      const url = `ws://${this.ipAddress}:${this.rosPort}`;
      logger.info(`尝试连接到ROS: ${url}`, { agvId: this.agvId });

      this.ros = new ROSLIB.Ros({ url });

      this.ros.on('connection', () => {
        logger.info(`已连接到ROS: ${url}`, { agvId: this.agvId });
        this.connected = true;
        this.agvStatus.status = 'online';
        this.agvStatus.lastUpdated = new Date();
        this.emit('status_update', this.agvStatus);

        // 连接成功后订阅基本话题
        this.subscribeToBasicTopics();
        resolve(true);
      });

      this.ros.on('error', (error) => {
        logger.error(`ROS连接错误: ${error}`, { agvId: this.agvId });
        this.connected = false;
        this.agvStatus.status = 'error';
        this.agvStatus.lastUpdated = new Date();
        this.emit('status_update', this.agvStatus);
        reject(error);

        // 尝试重连
        this.scheduleReconnect();
      });

      this.ros.on('close', () => {
        logger.info(`ROS连接关闭`, { agvId: this.agvId });
        this.connected = false;
        this.agvStatus.status = 'offline';
        this.agvStatus.lastUpdated = new Date();
        this.emit('status_update', this.agvStatus);

        // 连接关闭后尝试重连
        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect(): void {
    if (!this.reconnectTimer) {
      logger.info(`计划在5秒后重新连接`, { agvId: this.agvId });
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(() => {
          // 错误已在connect方法中处理
        });
      }, 5000);
    }
  }

  private subscribeToBasicTopics(): void {
    if (!this.connected || !this.ros) {
      return;
    }

    // 订阅电池状态
    this.subscribeTopic('/battery_state', 'sensor_msgs/BatteryState', (message) => {
      if (message.data && typeof message.data.percentage === 'number') {
        this.agvStatus.batteryLevel = message.data.percentage;
        this.agvStatus.lastUpdated = new Date();
        this.emit('status_update', this.agvStatus);
      }
    });

    // 订阅速度
    this.subscribeTopic('/cmd_vel', 'geometry_msgs/Twist', (message) => {
      if (message.data && typeof message.data.linear?.x === 'number') {
        this.agvStatus.speed = Math.abs(message.data.linear.x);
        this.agvStatus.lastUpdated = new Date();
        this.emit('status_update', this.agvStatus);
      }
    });

    // 订阅位置 (AMCL)
    this.subscribeTopic('/amcl_pose', 'geometry_msgs/PoseWithCovarianceStamped', (message) => {
      if (message.data && message.data.pose?.pose) {
        const pose = message.data.pose.pose;
        const position: Position = {
          x: pose.position?.x || 0,
          y: pose.position?.y || 0,
          theta: this.getYawFromQuaternion(
            pose.orientation?.x || 0,
            pose.orientation?.y || 0,
            pose.orientation?.z || 0,
            pose.orientation?.w || 1
          )
        };
        
        this.agvStatus.position = position;
        this.agvStatus.lastUpdated = new Date();
        this.emit('status_update', this.agvStatus);
      }
    });

    // 订阅机器人位置 (jloc_result)
    this.subscribeTopic('/jloc_result', 'jarvis_msgs/LocResult', (message) => {
      if (message.data) {
        console.log('收到jloc_result原始消息:', JSON.stringify(message.data));
        // 根据需求，x和y要乘以1000，t(theta)需要从弧度值转为角度值
        const position: Position = {
          x: (message.data.x || 0) * 1000,
          y: (message.data.y || 0) * 1000,
          theta: (message.data.t || 0) * (180 / Math.PI) // 弧度转角度
        };
        
        console.log(`处理后的位置数据: x=${position.x}, y=${position.y}, theta=${position.theta}`);
        
        this.agvStatus.position = position;
        this.agvStatus.lastUpdated = new Date();
        this.emit('status_update', this.agvStatus);
        logger.info(`接收到机器人位置: x=${position.x}, y=${position.y}, theta=${position.theta}`, { agvId: this.agvId });
      } else {
        console.log('收到jloc_result消息但数据为空');
      }
    });
  }

  getTopics(): Promise<RosTopicInfo[]> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ros) {
        reject(new Error('未连接到ROS'));
        return;
      }

      this.ros.getTopics((result) => {
        const topics: RosTopicInfo[] = [];
        for (let i = 0; i < result.topics.length; i++) {
          topics.push({
            name: result.topics[i],
            type: result.types[i]
          });
        }
        resolve(topics);
      }, (error) => {
        logger.error(`获取话题列表失败: ${error}`, { agvId: this.agvId });
        reject(error);
      });
    });
  }

  subscribeTopic(topicName: string, messageType: string, callback: (message: RosMessage) => void): void {
    if (!this.connected || !this.ros) {
      console.log(`AGV ${this.agvId} 无法订阅话题${topicName}，未连接到ROS`);
      logger.error(`无法订阅话题，未连接到ROS`, { agvId: this.agvId, topic: topicName });
      return;
    }

    // 如果已经订阅了该话题，先取消订阅
    if (this.subscribers.has(topicName)) {
      console.log(`AGV ${this.agvId} 已存在对话题${topicName}的订阅，先取消订阅`);
      this.unsubscribeTopic(topicName);
    }

    try {
      console.log(`AGV ${this.agvId} 开始订阅话题: ${topicName}, 类型: ${messageType}`);
      const topic = new ROSLIB.Topic({
        ros: this.ros,
        name: topicName,
        messageType: messageType
      });

      topic.subscribe((data) => {
        console.log(`AGV ${this.agvId} 接收到话题 ${topicName} 的消息`);
        const message: RosMessage = {
          topic: topicName,
          type: messageType,
          data: data,
          timestamp: new Date()
        };
        
        callback(message);
        this.emit('message', message);
      });

      this.subscribers.set(topicName, topic);
      console.log(`AGV ${this.agvId} 已成功订阅话题: ${topicName}`);
      logger.info(`已订阅话题: ${topicName}`, { agvId: this.agvId });
    } catch (error) {
      console.error(`AGV ${this.agvId} 订阅话题${topicName}失败:`, error);
      logger.error(`订阅话题失败: ${error}`, { agvId: this.agvId, topic: topicName });
    }
  }

  unsubscribeTopic(topicName: string): void {
    const topic = this.subscribers.get(topicName);
    if (topic) {
      topic.unsubscribe();
      this.subscribers.delete(topicName);
      logger.info(`已取消订阅话题: ${topicName}`, { agvId: this.agvId });
    }
  }

  getStatus(): AgvStatus {
    return { ...this.agvStatus };
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    // 取消所有订阅
    this.subscribers.forEach((topic) => {
      topic.unsubscribe();
    });
    this.subscribers.clear();

    // 关闭ROS连接
    if (this.ros) {
      this.ros.close();
      this.ros = null;
    }

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connected = false;
    this.agvStatus.status = 'offline';
    this.agvStatus.lastUpdated = new Date();
    this.emit('status_update', this.agvStatus);
    
    logger.info(`已断开ROS连接`, { agvId: this.agvId });
  }

  private getYawFromQuaternion(x: number, y: number, z: number, w: number): number {
    // 从四元数计算偏航角
    return Math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z));
  }
}

export default RosService; 