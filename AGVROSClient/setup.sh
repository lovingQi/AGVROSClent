#!/bin/bash

# AGV ROS监控系统安装脚本

echo "===== AGV ROS监控系统安装脚本 ====="
echo "此脚本将安装前端和后端所需的所有依赖"

# 创建必要的目录
mkdir -p logs

# 安装后端依赖
echo "1. 安装后端依赖..."
cd backend
npm install
cp .env.example .env
echo "后端依赖安装完成!"
cd ..

# 安装前端依赖
echo "2. 安装前端依赖..."
cd frontend
npm install
echo "前端依赖安装完成!"
cd ..

echo "===== 所有依赖安装完成! ====="
echo "现在您可以运行以下命令启动应用:"
echo "前端: cd frontend && npm start"
echo "后端: cd backend && npm run dev"
echo "或者构建后端: cd backend && npm run build && npm start" 