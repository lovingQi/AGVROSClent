# AGV ROS监控系统 - 安装和运行指南

本文档详细介绍了项目的安装和运行步骤，以及可能遇到的问题和解决方案。

## 先决条件

确保您的系统已安装以下软件：

- Node.js (v16.x 或更高版本)
- npm (v8.x 或更高版本)
- ROS1（在AGV端）
- rosbridge_suite（在AGV端）

## 安装步骤

### 自动安装（推荐）

使用提供的安装脚本：

```bash
chmod +x setup.sh
./setup.sh
```

该脚本将自动安装前端和后端所需的所有依赖。

### 手动安装

如果自动脚本不适合您的环境，可以按照以下步骤手动安装：

1. **安装后端依赖**

```bash
cd backend
npm install
cp .env.example .env
```

2. **安装前端依赖**

```bash
cd frontend
npm install
```

## 配置

### 后端配置

编辑 `backend/.env` 文件，根据您的环境设置以下参数：

```env
# 服务器配置
PORT=3001
CORS_ORIGIN=http://localhost:3000

# 日志级别
LOG_LEVEL=info

# AGV配置
AGV_1_IP=192.168.1.101
AGV_1_ROS_PORT=9090

AGV_2_IP=192.168.1.102
AGV_2_ROS_PORT=9090
```

根据您的实际AGV IP地址和rosbridge端口进行调整。

### 前端配置

前端默认连接到 `http://localhost:3001` 的后端API。如果需要修改，请编辑 `frontend/.env` 文件：

```
REACT_APP_API_URL=http://localhost:3001
```

## 运行应用

### 开发模式

1. **启动后端**

```bash
cd backend
npm run dev
```

2. **启动前端**

```bash
cd frontend
npm start
```

### 生产模式

1. **构建并启动后端**

```bash
cd backend
npm run build
npm start
```

2. **构建前端**

```bash
cd frontend
npm run build
```

构建后的前端文件位于 `frontend/build` 目录，可以使用任何HTTP服务器进行部署。

## 常见问题解决

### 类型定义错误

如果您遇到类型定义相关的错误，可能是因为某些依赖的类型定义未正确安装。解决方法：

```bash
npm install --save-dev @types/node @types/express @types/cors @types/react @types/react-dom @types/roslib
```

### 连接到ROS的问题

确保：

1. AGV上的rosbridge_server正在运行
2. 端口已开放（默认9090）
3. 在`.env`文件中正确配置了AGV的IP地址

### 网络连接问题

如果前端无法连接到后端API：

1. 检查后端是否正在运行
2. 验证CORS_ORIGIN设置是否正确
3. 检查是否有防火墙阻止连接

## AGV上的ROS配置

在每台AGV上：

1. 安装rosbridge_suite：

```bash
sudo apt-get install ros-<发行版>-rosbridge-suite
```

2. 启动rosbridge_server：

```bash
roslaunch rosbridge_server rosbridge_websocket.launch
```

## 其他提示

- 可以在`backend/src/config/config.ts`文件中添加或修改更多AGV配置
- 若要扩展系统功能，可以在`backend/src/controllers`和`frontend/src/pages`中添加新的控制器和页面 