export interface Position {
  x: number;
  y: number;
  theta: number;
}

export interface AgvStatus {
  id: number;
  name: string;
  status: 'online' | 'offline' | 'error';
  ipAddress: string;
  batteryLevel: number;
  speed: number;
  position?: Position;
  lastUpdated?: Date;
}

export interface RosTopicInfo {
  name: string;
  type: string;
}

export interface RosMessage {
  topic: string;
  type: string;
  data: any;
  timestamp: Date;
}

export interface AgvConfig {
  id: number;
  name: string;
  ipAddress: string;
  rosPort: string;
} 