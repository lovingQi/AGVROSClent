import { Router } from 'express';
import * as agvController from '../controllers/agvController';

const router = Router();

// AGV状态相关路由
router.get('/agvs', agvController.getAllAgvs);
router.get('/agvs/:id', agvController.getAgvById);
router.post('/agvs/:id/connect', agvController.connectToAgv);
router.post('/agvs/:id/disconnect', agvController.disconnectFromAgv);

// ROS话题相关路由
router.get('/agvs/:id/topics', agvController.getAgvTopics);
router.post('/agvs/:id/subscribe', agvController.subscribeToTopic);
router.post('/agvs/:id/unsubscribe', agvController.unsubscribeFromTopic);

export default router; 