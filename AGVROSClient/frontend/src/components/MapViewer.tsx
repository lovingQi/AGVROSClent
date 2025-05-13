import React, { useEffect, useState } from 'react';
import { Card, Button, Spin } from 'antd';
import message from 'antd/lib/message';
import axios from 'axios';

// 定义点的结构
interface MapPoint {
  x: number;
  y: number;
}

// 定义线的结构
interface MapLine {
  start: MapPoint;
  end: MapPoint;
}

// 定义对象的基本结构
interface MapObject {
  type: string;
  position: MapPoint;
  [key: string]: any; // 允许对象有额外属性
}

// 定义地图数据结构，参考reference中的格式
interface MapData {
  points?: MapPoint[];  // 地图上的点
  lines?: MapLine[];    // 地图上的线
  objects?: MapObject[]; // 地图上的对象，如路径点、充电点等
  resolution?: number;   // 地图分辨率
  width?: number;        // 地图宽度
  height?: number;       // 地图高度
  name?: string;         // 地图名称
}

interface MapViewerProps {
  hostname?: string;
}

const MapViewer: React.FC<MapViewerProps> = ({ hostname }: MapViewerProps) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // 获取地图数据
  const fetchMapData = async () => {
    if (!hostname) {
      message.error('缺少主机地址，无法获取地图数据');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/api/params/map?hostname=${encodeURIComponent(hostname)}`);
      if (response.data.success && response.data.data) {
        console.log('获取地图数据成功：', response.data.data);
        
        // 解析和转换地图数据
        const rawData = response.data.data;
        const processedData: MapData = {};

        // 检查原始数据格式
        const hasStandardFormat = Array.isArray(rawData.points) || Array.isArray(rawData.lines) || Array.isArray(rawData.objects);
        const hasSpecialFormat = Array.isArray(rawData.ObsPoints) || (rawData.Objs && Array.isArray(rawData.Objs));

        if (hasStandardFormat) {
          // 处理标准格式
          if (Array.isArray(rawData.points)) {
            processedData.points = rawData.points.map((point: any) => ({
              x: Number(point.x),
              y: Number(point.y)
            }));
          }

          // 处理线数据
          if (Array.isArray(rawData.lines)) {
            processedData.lines = rawData.lines.map((line: any) => ({
              start: { x: Number(line.start.x), y: Number(line.start.y) },
              end: { x: Number(line.end.x), y: Number(line.end.y) }
            }));
          }

          // 处理对象数据
          if (Array.isArray(rawData.objects)) {
            processedData.objects = rawData.objects;
          }

          // 处理其他元数据
          if (rawData.resolution) processedData.resolution = Number(rawData.resolution);
          if (rawData.width) processedData.width = Number(rawData.width);
          if (rawData.height) processedData.height = Number(rawData.height);
          if (rawData.name) processedData.name = rawData.name;
        } 
        // 检查特殊格式
        else if (hasSpecialFormat) {
          console.log('检测到特殊格式地图数据，尝试解析');
          
          // 处理障碍点数据
          if (Array.isArray(rawData.ObsPoints)) {
            processedData.points = [];
            for (const point of rawData.ObsPoints) {
              if (Array.isArray(point) && point.length >= 2) {
                processedData.points.push({
                  x: Number(point[0]),
                  y: Number(point[1])
                });
              } else if (point && typeof point === 'object') {
                processedData.points.push({
                  x: Number(point.x || 0),
                  y: Number(point.y || 0)
                });
              }
            }
          }
          
          // 处理对象数据
          if (rawData.Objs && Array.isArray(rawData.Objs)) {
            const lines: MapLine[] = [];
            const objects: MapObject[] = [];
            
            for (const obj of rawData.Objs) {
              // 线段对象处理
              if (obj.type === 'line' || obj.type === 'Line' || obj.type === 'PATH_LINE') {
                if (obj.start && obj.end) {
                  lines.push({
                    start: {
                      x: Number(obj.start.x || 0),
                      y: Number(obj.start.y || 0)
                    },
                    end: {
                      x: Number(obj.end.x || 0),
                      y: Number(obj.end.y || 0)
                    }
                  });
                }
              } else {
                // 其他对象处理
                const processedObj: MapObject = {
                  type: obj.type || 'unknown',
                  position: { x: 0, y: 0 }
                };
                
                // 复制其他属性
                Object.keys(obj).forEach(key => {
                  if (key !== 'position' && key !== 'pose' && key !== 'Point' && key !== 'point') {
                    (processedObj as any)[key] = obj[key];
                  }
                });
                
                // 处理位置信息
                const posInfo = obj.position || obj.pose || obj.Point || obj.point;
                if (posInfo) {
                  if (Array.isArray(posInfo) && posInfo.length >= 2) {
                    processedObj.position = {
                      x: Number(posInfo[0]),
                      y: Number(posInfo[1])
                    };
                  } else if (typeof posInfo === 'object' && posInfo !== null) {
                    processedObj.position = {
                      x: Number(posInfo.x || 0),
                      y: Number(posInfo.y || 0)
                    };
                  }
                  
                  objects.push(processedObj);
                }
              }
            }
            
            if (lines.length > 0) {
              processedData.lines = lines;
            }
            
            if (objects.length > 0) {
              processedData.objects = objects;
            }
          }
          
          // 处理元数据
          if (rawData.MapRes) {
            processedData.resolution = Number(rawData.MapRes);
          }
          
          // 处理地图尺寸
          if (rawData.MaxPose && rawData.MinPose) {
            const maxPose = rawData.MaxPose;
            const minPose = rawData.MinPose;
            
            if (Array.isArray(maxPose) && maxPose.length >= 2 && 
                Array.isArray(minPose) && minPose.length >= 2) {
              processedData.width = Number(maxPose[0]) - Number(minPose[0]);
              processedData.height = Number(maxPose[1]) - Number(minPose[1]);
            } else if (maxPose && minPose && typeof maxPose === 'object' && typeof minPose === 'object') {
              processedData.width = Number(maxPose.x || 0) - Number(minPose.x || 0);
              processedData.height = Number(maxPose.y || 0) - Number(minPose.y || 0);
            }
          }
          
          // 处理名称
          if (rawData.Header && rawData.Header.Name) {
            processedData.name = rawData.Header.Name;
          }
        }
        
        // 数据处理完成后设置状态
        console.log('处理后的地图数据:', {
          points: processedData.points?.length || 0,
          lines: processedData.lines?.length || 0,
          objects: processedData.objects?.length || 0
        });
        setMapData(processedData);
        message.success('地图数据加载成功');
      } else {
        message.error('获取地图数据失败');
      }
    } catch (error) {
      console.error('获取地图数据出错：', error);
      message.error('获取地图数据时发生错误');
    } finally {
      setLoading(false);
    }
  };

  // 渲染地图
  const renderMap = () => {
    if (!canvasRef.current || !mapData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 找出地图边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // 处理点
    if (mapData.points && mapData.points.length > 0) {
      mapData.points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    }
    
    // 处理线
    if (mapData.lines && mapData.lines.length > 0) {
      mapData.lines.forEach(line => {
        minX = Math.min(minX, line.start.x, line.end.x);
        minY = Math.min(minY, line.start.y, line.end.y);
        maxX = Math.max(maxX, line.start.x, line.end.x);
        maxY = Math.max(maxY, line.start.y, line.end.y);
      });
    }
    
    // 处理对象
    if (mapData.objects && mapData.objects.length > 0) {
      mapData.objects.forEach(obj => {
        if (obj.position) {
          minX = Math.min(minX, obj.position.x);
          minY = Math.min(minY, obj.position.y);
          maxX = Math.max(maxX, obj.position.x);
          maxY = Math.max(maxY, obj.position.y);
        }
      });
    }

    // 如果没有有效数据，则返回
    if (minX === Infinity || minY === Infinity) return;

    // 计算缩放比例，留出10%的边距
    const padding = 0.1;
    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;
    
    // 确保地图宽度和高度不为0
    const effectiveMapWidth = mapWidth || 1;
    const effectiveMapHeight = mapHeight || 1;
    
    const scaleX = canvas.width * (1 - 2 * padding) / effectiveMapWidth;
    const scaleY = canvas.height * (1 - 2 * padding) / effectiveMapHeight;
    const scale = Math.min(scaleX, scaleY);

    // 计算偏移，使地图居中
    const offsetX = (canvas.width - effectiveMapWidth * scale) / 2;
    const offsetY = (canvas.height - effectiveMapHeight * scale) / 2;

    // 坐标变换函数
    const transformX = (x: number) => offsetX + (x - minX) * scale;
    const transformY = (y: number) => canvas.height - (offsetY + (y - minY) * scale); // Y轴向下为正

    // 绘制点
    if (mapData.points && mapData.points.length > 0) {
      ctx.fillStyle = '#2196F3'; // 蓝色点
      mapData.points.forEach(point => {
        ctx.beginPath();
        ctx.arc(transformX(point.x), transformY(point.y), 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 绘制线
    if (mapData.lines && mapData.lines.length > 0) {
      ctx.strokeStyle = '#4CAF50'; // 绿色线
      ctx.lineWidth = 1;
      
      mapData.lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(transformX(line.start.x), transformY(line.start.y));
        ctx.lineTo(transformX(line.end.x), transformY(line.end.y));
        ctx.stroke();
      });
    }

    // 绘制对象
    if (mapData.objects && mapData.objects.length > 0) {
      mapData.objects.forEach(obj => {
        if (obj.position) {
          // 根据对象类型使用不同的颜色和形状
          switch (obj.type) {
            case 'PathPoint': // 路径点
              ctx.fillStyle = '#FF9800'; // 橙色
              ctx.beginPath();
              ctx.arc(transformX(obj.position.x), transformY(obj.position.y), 4, 0, Math.PI * 2);
              ctx.fill();
              
              // 如果有名称，绘制名称
              if (obj.name) {
                ctx.fillStyle = '#333333';
                ctx.font = '10px Arial';
                ctx.fillText(obj.name, transformX(obj.position.x) + 6, transformY(obj.position.y) - 6);
              }
              break;
              
            case 'ChargePoint': // 充电点
              ctx.fillStyle = '#F44336'; // 红色
              ctx.beginPath();
              ctx.rect(transformX(obj.position.x) - 5, transformY(obj.position.y) - 5, 10, 10);
              ctx.fill();
              break;
              
            default: // 其他对象
              ctx.fillStyle = '#9C27B0'; // 紫色
              ctx.beginPath();
              ctx.arc(transformX(obj.position.x), transformY(obj.position.y), 3, 0, Math.PI * 2);
              ctx.fill();
              break;
          }
        }
      });
    }

    // 添加比例尺
    const scaleBarLength = 100; // 像素
    const realDistance = scaleBarLength / scale; // 实际距离
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 20);
    ctx.lineTo(20 + scaleBarLength, canvas.height - 20);
    ctx.stroke();
    
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.fillText(`${realDistance.toFixed(2)} 单位`, 20, canvas.height - 8);
  };

  // 当地图数据更新时重新渲染
  useEffect(() => {
    renderMap();
  }, [mapData]);

  // 调整地图大小
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        // 获取父容器宽度
        const container = canvasRef.current.parentElement;
        if (container) {
          canvasRef.current.width = container.clientWidth * 0.95;
          canvasRef.current.height = 500; // 固定高度或者根据比例计算
          renderMap();
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <Card 
      title="机器人地图" 
      extra={
        <Button
          type="primary"
          onClick={fetchMapData}
          loading={loading}
          disabled={!hostname}
        >
          加载地图
        </Button>
      }
    >
      <div style={{ position: 'relative', width: '100%', height: '500px' }}>
        <Spin spinning={loading} tip="加载地图中...">
          <canvas 
            ref={canvasRef} 
            style={{ 
              width: '100%', 
              height: '500px', 
              border: '1px solid #d9d9d9',
              borderRadius: '2px' 
            }}
          />
        </Spin>
        {!mapData && !loading && (
          <div 
            style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              color: '#00000073',
              fontSize: '16px'
            }}
          >
            {hostname 
              ? '点击"加载地图"按钮来获取地图数据' 
              : '请先连接到AGV，才能加载地图数据'
            }
          </div>
        )}
      </div>
    </Card>
  );
};

export default MapViewer; 