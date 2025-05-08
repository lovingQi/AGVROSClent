// 后端类型声明文件

// Node.js内置模块声明
declare module 'events' {
  export class EventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }
}

declare module 'http' {
  export interface Server {}
  export class Server {}
}

// Express声明
declare module 'express' {
  export interface Request {}
  export interface Response {
    status(code: number): Response;
    json(body: any): Response;
  }
  export interface NextFunction {}
  export function Router(): any;
  export default function express(): any;
}

// 其他库声明
declare module 'cors' {
  export default function cors(options?: any): any;
}

declare module 'dotenv' {
  export function config(): void;
}

declare module 'winston' {
  export const format: any;
  export const transports: any;
  export function createLogger(options: any): any;
}

declare module 'socket.io' {
  export class Server {
    constructor(httpServer: any, options?: any);
    on(event: string, listener: (socket: Socket) => void): this;
    emit(event: string, ...args: any[]): boolean;
    to(room: string): { emit: (event: string, ...args: any[]) => boolean };
  }
  
  export class Socket {
    id: string;
    join(room: string): void;
    leave(room: string): void;
    on(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }
}

declare module 'roslib' {
  export interface Ros {
    on(event: string, handler: any): void;
    close(): void;
    getTopics(callback: any, errorCallback: any): void;
  }
  
  export interface Topic {
    subscribe(callback: any): void;
    unsubscribe(): void;
  }
}

// 全局声明
declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  
  interface Process {
    env: ProcessEnv;
  }
  
  interface Global {
    process: Process;
  }
  
  type Timeout = number;
}

declare var process: NodeJS.Process; 