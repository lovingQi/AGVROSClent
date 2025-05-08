import { EventEmitter } from 'events';
import { AgvStatus, AgvConfig, RosTopicInfo, RosMessage } from '../models/agv';
import RosService from './RosService';
import logger from '../config/logger';
import config from '../config/config';

// 添加必要的事件类型定义
interface AgvManagerEvents {
  on(event: 'status_update', listener: (status: AgvStatus) => void): this;
  on(event: 'message', listener: (agvId: number, message: RosMessage) => void): this;
  emit(event: 'status_update', status: AgvStatus): boolean;
  emit(event: 'message', agvId: number, message: RosMessage): boolean;
}

class AgvManager extends EventEmitter implements AgvManagerEvents {
  private agvServices: Map<number, RosService> = new Map();
  private agvStatuses: Map<number, AgvStatus> = new Map();

  constructor() {
    super();
    this.initializeAgvs();
  }

  private initializeAgvs(): void {
    // 从配置中加载AGV
    config.agvs.forEach((agvConfig) => {
      this.addAgv(agvConfig);
    });
  }

  addAgv(agvConfig: AgvConfig): void {
    const { id, name, ipAddress, rosPort } = agvConfig;
    
    // 检查是否已存在
    if (this.agvServices.has(id)) {
      logger.warn(`AGV ${id} 已存在，将被替换`, { agvId: id });
      const existingService = this.agvServices.get(id);
      if (existingService) {
        existingService.disconnect();
      }
      this.agvServices.delete(id);
    }

    // 创建新的ROS服务
    const rosService = new RosService(id, name, ipAddress, rosPort);
    
    // 监听状态更新
    rosService.on('status_update', (status: AgvStatus) => {
      this.agvStatuses.set(id, status);
      this.emit('status_update', status);
    });

    // 监听消息
    rosService.on('message', (message: RosMessage) => {
      this.emit('message', id, message);
    });

    // 保存服务和初始状态
    this.agvServices.set(id, rosService);
    this.agvStatuses.set(id, rosService.getStatus());

    logger.info(`已添加AGV: ${name} (ID: ${id})`, { agvId: id });
  }

  removeAgv(id: number): boolean {
    const rosService = this.agvServices.get(id);
    if (!rosService) {
      return false;
    }

    // 断开连接并移除
    rosService.disconnect();
    this.agvServices.delete(id);
    this.agvStatuses.delete(id);

    logger.info(`已移除AGV (ID: ${id})`, { agvId: id });
    return true;
  }

  connectAgv(id: number): Promise<boolean> {
    const rosService = this.agvServices.get(id);
    if (!rosService) {
      return Promise.reject(new Error(`AGV ${id} 不存在`));
    }

    return rosService.connect();
  }

  disconnectAgv(id: number): boolean {
    const rosService = this.agvServices.get(id);
    if (!rosService) {
      return false;
    }

    rosService.disconnect();
    return true;
  }

  getAgvStatus(id: number): AgvStatus | undefined {
    return this.agvStatuses.get(id);
  }

  getAllAgvStatuses(): AgvStatus[] {
    return Array.from(this.agvStatuses.values());
  }

  getAgvTopics(id: number): Promise<RosTopicInfo[]> {
    const rosService = this.agvServices.get(id);
    if (!rosService) {
      return Promise.reject(new Error(`AGV ${id} 不存在`));
    }

    if (!rosService.isConnected()) {
      return Promise.reject(new Error(`AGV ${id} 未连接`));
    }

    return rosService.getTopics();
  }

  subscribeToTopic(agvId: number, topicName: string, messageType: string): boolean {
    const rosService = this.agvServices.get(agvId);
    if (!rosService || !rosService.isConnected()) {
      return false;
    }

    rosService.subscribeTopic(topicName, messageType, (message) => {
      // 消息处理已在RosService的'message'事件中处理
    });
    return true;
  }

  unsubscribeFromTopic(agvId: number, topicName: string): boolean {
    const rosService = this.agvServices.get(agvId);
    if (!rosService) {
      return false;
    }

    rosService.unsubscribeTopic(topicName);
    return true;
  }
}

export default new AgvManager(); 