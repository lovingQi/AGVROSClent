import express from 'express';
import { SSHService } from '../services/sshService';

const router = express.Router();
const sshService = new SSHService();

router.post('/connect', async (req, res) => {
  const { hostname } = req.body;
  if (!hostname) {
    return res.status(400).json({ success: false, message: '请提供主机地址' });
  }

  const success = await sshService.connect(hostname);
  res.json({ success, message: success ? '连接成功' : '连接失败' });
});

router.get('/params', async (req, res) => {
  try {
    const params = await sshService.readParamsFile();
    res.json({ success: true, data: params });
  } catch (error) {
    console.error('获取参数失败:', error);
    res.status(500).json({ success: false, message: '获取参数失败' });
  }
});

router.post('/disconnect', (req, res) => {
  sshService.disconnect();
  res.json({ success: true, message: '断开连接成功' });
});

export default router; 