import express from 'express';
import http from 'http';
import cors from 'cors';
import agvRoutes from './routes/agvRoutes';
import socketService from './services/SocketService';
import logger from './config/logger';
import config from './config/config';

// 创建Express应用
const app = express();

// 中间件
app.use(cors({
  origin: config.server.corsOrigin
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

// 路由
app.use('/api', agvRoutes);

// 健康检查端点
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 错误处理中间件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('服务器错误', { error: err.message, stack: err.stack });
  res.status(500).json({ error: '服务器内部错误' });
});

// 创建HTTP服务器
const server = http.createServer(app);

// 初始化Socket.IO
socketService.initialize(server);

// 启动服务器
const PORT = config.server.port;
server.listen(PORT, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
}); 