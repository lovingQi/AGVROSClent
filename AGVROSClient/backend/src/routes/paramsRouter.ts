import { Router, Request, Response } from 'express';
import { SSHService } from '../services/sshService';
import { logger } from '../utils/logger';

const router = Router();
const sshService = new SSHService();

interface ConnectRequest extends Request {
  body: {
    hostname: string;
  };
}

interface ReadFileRequest extends Request {
  body: {
    filePath: string;
  };
}

interface MapRequest extends Request {
  query: {
    hostname?: string;
  };
}

router.post('/connect', async (req: ConnectRequest, res: Response) => {
  try {
    const { hostname } = req.body;
    logger.info(`收到连接请求，主机地址: ${hostname}`);
    
    if (!hostname) {
      logger.warn('未提供主机地址');
      return res.status(400).json({ success: false, message: '请提供主机地址' });
    }
    
    const success = await sshService.connect(hostname);
    logger.info(`连接${success ? '成功' : '失败'}: ${hostname}`);
    res.json({ success, message: success ? '连接成功' : '连接失败' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`连接异常: ${errorMessage}`);
    res.status(500).json({ success: false, message: '连接失败' });
  }
});

router.get('/params', async (_req: Request, res: Response) => {
  try {
    logger.info('正在获取参数');
    const params = await sshService.readParamsFile();
    logger.info('成功获取参数');
    res.json({ success: true, data: params });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`获取参数失败: ${errorMessage}`);
    res.status(500).json({ success: false, message: '获取参数失败' });
  }
});

router.get('/map', async (req: MapRequest, res: Response) => {
  try {
    const { hostname } = req.query;
    
    if (!hostname || typeof hostname !== 'string') {
      logger.warn('未提供主机地址');
      return res.status(400).json({ success: false, message: '请提供主机地址参数' });
    }
    
    logger.info(`正在连接到主机 ${hostname} 获取地图数据`);
    
    // 先建立SSH连接
    const connected = await sshService.connect(hostname);
    if (!connected) {
      logger.error(`连接到主机 ${hostname} 失败`);
      return res.status(500).json({ success: false, message: '连接主机失败，无法获取地图数据' });
    }
    
    logger.info('正在获取地图数据');
    const mapData = await sshService.readMapFile();
    logger.info('成功获取地图数据');
    res.json({ success: true, data: mapData });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`获取地图数据失败: ${errorMessage}`);
    res.status(500).json({ success: false, message: '获取地图数据失败' });
  }
});

router.post('/disconnect', (_req: Request, res: Response) => {
  try {
    logger.info('正在断开连接');
    sshService.disconnect();
    logger.info('成功断开连接');
    res.json({ success: true, message: '断开连接成功' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`断开连接失败: ${errorMessage}`);
    res.status(500).json({ success: false, message: '断开连接失败' });
  }
});

router.post('/readFile', async (req: ReadFileRequest, res: Response) => {
  try {
    const { filePath } = req.body;
    logger.info(`请求读取文件: ${filePath}`);
    
    if (!filePath) {
      logger.warn('未提供文件路径');
      return res.status(400).json({ success: false, message: '请提供文件路径' });
    }
    
    const fileContent = await sshService.readSpecificFile(filePath);
    logger.info(`成功读取文件: ${filePath}`);
    res.json({ success: true, data: fileContent });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`读取文件失败: ${errorMessage}`);
    res.status(500).json({ success: false, message: `读取文件失败: ${errorMessage}` });
  }
});

export default router; 