import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 获取项目根目录的绝对路径
const rootDir = path.resolve(__dirname, '../../');
const logsDir = path.join(rootDir, 'logs');

// 确保日志目录存在
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      level: 'debug'
    }),
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        // @ts-ignore - 忽略类型检查
        winston.format.printf((info: any) => {
          const { timestamp, level, message } = info;
          return `${timestamp || new Date().toISOString()} ${level}: ${message}`;
        })
      )
    })
  ]
}); 