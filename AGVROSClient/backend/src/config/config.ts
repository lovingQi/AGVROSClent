import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const config = {
  server: {
    port: process.env.PORT || 3001,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  agvs: [
    {
      id: 1,
      name: 'AGV-001',
      ipAddress: process.env.AGV_1_IP || '172.10.25.121',
      rosPort: process.env.AGV_1_ROS_PORT || '9090'
    },
    {
      id: 2,
      name: 'AGV-002',
      ipAddress: process.env.AGV_2_IP || '172.10.25.126',
      rosPort: process.env.AGV_2_ROS_PORT || '9090'
    }
  ]
};

export default config; 