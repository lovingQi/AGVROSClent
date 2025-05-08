# AGV ROS监控系统

这是一个基于Web的AGV ROS监控系统，可以在局域网内监控多台运行ROS1的AGV小车，显示它们的运动状态和ROS消息。

## 系统架构

系统由以下部分组成：

1. **前端**：React应用，提供用户界面，显示AGV状态和ROS消息
2. **后端**：Node.js服务器，处理API请求和WebSocket通信
3. **ROS Bridge**：在每台AGV上运行的rosbridge_suite，将ROS消息转换为WebSocket消息

### 技术栈

- **前端**：
  - React
  - TypeScript
  - Ant Design
  - Socket.IO客户端
  - ROSLIB.js

- **后端**：
  - Node.js
  - Express
  - Socket.IO
  - TypeScript

- **AGV**：
  - ROS1
  - rosbridge_suite

## 功能特性

- 显示所有AGV的列表和基本状态
- 详细查看单个AGV的状态信息
- 连接到AGV的ROS系统
- 查看和订阅ROS话题
- 实时显示ROS消息

## 安装和运行

### 前提条件

- Node.js 16+
- 在每台AGV上安装并运行rosbridge_suite

### 后端设置

1. 进入后端目录：
   ```
   cd backend
   ```

2. 安装依赖：
   ```
   npm install
   ```

3. 创建环境配置文件：
   ```
   cp .env.example .env
   ```
   
4. 修改`.env`文件中的配置，特别是AGV的IP地址和rosbridge端口

5. 构建和运行：
   ```
   npm run build
   npm start
   ```
   
   或者在开发模式下运行：
   ```
   npm run dev
   ```

### 前端设置

1. 进入前端目录：
   ```
   cd frontend
   ```

2. 安装依赖：
   ```
   npm install
   ```

3. 启动开发服务器：
   ```
   npm start
   ```

4. 构建生产版本：
   ```
   npm run build
   ```

## AGV配置

每台AGV需要安装和运行rosbridge_suite：

1. 安装rosbridge_suite：
   ```
   sudo apt-get install ros-<distro>-rosbridge-suite
   ```

2. 启动rosbridge服务器：
   ```
   roslaunch rosbridge_server rosbridge_websocket.launch
   ```

## 使用说明

1. 打开浏览器访问前端应用（默认为http://localhost:3000）
2. 在主页面可以看到所有AGV的列表和基本状态
3. 点击某个AGV可以进入详情页面
4. 在详情页面，点击"连接到ROS"按钮建立与AGV的连接
5. 连接成功后，可以查看可用的ROS话题并订阅感兴趣的话题
6. 订阅话题后，可以实时查看该话题的消息

## 许可证

MIT 