import { Request, Response } from 'express';
import agvManager from '../services/AgvManager';
import logger from '../config/logger';

// 获取所有AGV状态
export const getAllAgvs = (req: Request, res: Response) => {
  try {
    const agvs = agvManager.getAllAgvStatuses();
    res.json(agvs);
  } catch (error) {
    logger.error('获取所有AGV状态失败', { error });
    res.status(500).json({ error: '获取AGV状态失败' });
  }
};

// 获取单个AGV状态
export const getAgvById = (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const agv = agvManager.getAgvStatus(id);
    
    if (!agv) {
      return res.status(404).json({ error: `未找到ID为${id}的AGV` });
    }
    
    res.json(agv);
  } catch (error) {
    logger.error('获取AGV状态失败', { error, id: req.params.id });
    res.status(500).json({ error: '获取AGV状态失败' });
  }
};

// 连接到AGV的ROS
export const connectToAgv = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    await agvManager.connectAgv(id);
    res.json({ success: true, message: `已连接到AGV ${id}` });
  } catch (error) {
    logger.error('连接到AGV失败', { error, id: req.params.id });
    res.status(500).json({ error: `连接失败: ${error}` });
  }
};

// 断开与AGV的ROS连接
export const disconnectFromAgv = (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const result = agvManager.disconnectAgv(id);
    if (!result) {
      return res.status(404).json({ error: `未找到ID为${id}的AGV` });
    }
    
    res.json({ success: true, message: `已断开与AGV ${id}的连接` });
  } catch (error) {
    logger.error('断开AGV连接失败', { error, id: req.params.id });
    res.status(500).json({ error: '断开连接失败' });
  }
};

// 获取AGV的ROS话题列表
export const getAgvTopics = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const topics = await agvManager.getAgvTopics(id);
    res.json(topics);
  } catch (error) {
    logger.error('获取AGV话题列表失败', { error, id: req.params.id });
    res.status(500).json({ error: `获取话题列表失败: ${error}` });
  }
};

// 订阅AGV的ROS话题
export const subscribeToTopic = (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { topicName, messageType } = req.body;
    
    if (!topicName || !messageType) {
      return res.status(400).json({ error: '缺少必要参数: topicName, messageType' });
    }
    
    const result = agvManager.subscribeToTopic(id, topicName, messageType);
    if (!result) {
      return res.status(404).json({ error: `未找到ID为${id}的AGV或AGV未连接` });
    }
    
    res.json({ success: true, message: `已订阅话题: ${topicName}` });
  } catch (error) {
    logger.error('订阅话题失败', { error, id: req.params.id });
    res.status(500).json({ error: '订阅话题失败' });
  }
};

// 取消订阅AGV的ROS话题
export const unsubscribeFromTopic = (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { topicName } = req.body;
    
    if (!topicName) {
      return res.status(400).json({ error: '缺少必要参数: topicName' });
    }
    
    const result = agvManager.unsubscribeFromTopic(id, topicName);
    if (!result) {
      return res.status(404).json({ error: `未找到ID为${id}的AGV` });
    }
    
    res.json({ success: true, message: `已取消订阅话题: ${topicName}` });
  } catch (error) {
    logger.error('取消订阅话题失败', { error, id: req.params.id });
    res.status(500).json({ error: '取消订阅话题失败' });
  }
}; 