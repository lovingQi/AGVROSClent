export interface AgvStatus {
  id: number;
  name: string;
  status: string;
  ipAddress: string;
  batteryLevel: number;
  speed: number;
  lastUpdated: string;
}

export interface RosMessage {
  topic: string;
  type: string;
  data: any;
}

export interface RosTopicInfo {
  name: string;
  type: string;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Orientation {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface AgvDetail extends AgvStatus {
  position: Position;
  orientation: Orientation;
  availableTopics: RosTopicInfo[];
} 