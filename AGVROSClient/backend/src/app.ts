import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import paramsRouter from './routes/paramsRouter';

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/params', paramsRouter);

// 错误处理
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('未处理的错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

export default app; 