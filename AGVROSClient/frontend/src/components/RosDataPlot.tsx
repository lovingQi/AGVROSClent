import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography } from 'antd';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

const { Text } = Typography;

// 定义ROS消息接口
interface RosMessage {
  topic: string;
  type?: string;
  data?: any;
  timestamp?: number;
  message?: any; // 添加message字段
}

// 定义数据点接口
interface DataPoint {
  x: number; // 时间戳
  y: number; // 值
}

// 定义图表数据集接口
interface DataSet {
  label: string;
  data: DataPoint[];
  borderColor: string;
  backgroundColor: string;
  tension: number;
  pointRadius: number;
}

// 定义组件属性接口
interface RosDataPlotProps {
  topic: string;
  messageType: string;
  latestMessage?: RosMessage;
  fieldPaths?: string[]; // 可选的字段路径列表，用于从消息中提取数据
}

// 颜色列表，用于不同数据集
const COLORS = [
  'rgb(255, 99, 132)',
  'rgb(54, 162, 235)',
  'rgb(255, 206, 86)',
  'rgb(75, 192, 192)',
  'rgb(153, 102, 255)',
  'rgb(255, 159, 64)'
];

// 最大数据点数量
const MAX_DATA_POINTS = 100;

const RosDataPlot: React.FC<RosDataPlotProps> = ({ 
  topic, 
  messageType, 
  latestMessage, 
  fieldPaths 
}: RosDataPlotProps) => {
  // 状态
  const [dataSets, setDataSets] = useState<DataSet[]>([]);
  const [paused, setPaused] = useState<boolean>(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  
  // 从对象中提取所有可能的字段路径
  const extractFieldPaths = (obj: any, prefix: string = ''): string[] => {
    if (!obj || typeof obj !== 'object') return [];
    
    return Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'number') {
        return [path];
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return extractFieldPaths(value, path);
      } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'number') {
        // 处理数字数组，为每个索引创建一个路径
        return value.map((_val, i) => `${path}[${i}]`);
      }
      
      return [];
    });
  };
  
  // 当消息类型改变时，更新可用字段
  useEffect(() => {
    if (latestMessage && latestMessage.data) {
      console.log(`[RosDataPlot] 话题 ${topic} 收到消息，开始提取字段:`, latestMessage);
      
      const fields = extractFieldPaths(latestMessage.data);
      console.log(`[RosDataPlot] 提取的字段:`, fields);
      setAvailableFields(fields);
      
      // 如果提供了字段路径，则使用它们
      if (fieldPaths && fieldPaths.length > 0) {
        const validFields = fieldPaths.filter((path: string) => fields.includes(path));
        console.log(`[RosDataPlot] 使用提供的字段路径:`, validFields);
        setSelectedFields(validFields);
      } else if (fields.length > 0) {
        // 否则默认选择第一个字段
        console.log(`[RosDataPlot] 默认选择第一个字段:`, fields[0]);
        setSelectedFields([fields[0]]);
      }
    }
  }, [messageType, latestMessage, fieldPaths, topic]);
  
  // 当选择的字段改变时，更新数据集
  useEffect(() => {
    console.log(`[RosDataPlot] 字段选择变化，创建新的数据集:`, selectedFields);
    
    const newDataSets: DataSet[] = selectedFields.map((field, index) => {
      const colorIndex = index % COLORS.length;
      return {
        label: field,
        data: [],
        borderColor: COLORS[colorIndex],
        backgroundColor: COLORS[colorIndex].replace('rgb', 'rgba').replace(')', ', 0.5)'),
        tension: 0.2,
        pointRadius: 1
      };
    });
    
    console.log(`[RosDataPlot] 创建的新数据集:`, newDataSets);
    setDataSets(newDataSets);
    setStartTime(Date.now());
  }, [selectedFields]);
  
  // 根据路径从对象中获取嵌套值
  const getNestedValue = (obj: any, path: string): any => {
    // 处理数组索引，例如 "linear.x[0]"
    const arrayIndexMatch = path.match(/(.+)\[(\d+)\]$/);
    if (arrayIndexMatch) {
      const [_, basePath, indexStr] = arrayIndexMatch;
      const index = parseInt(indexStr, 10);
      const array = basePath.split('.').reduce((o, key) => (o && o[key] !== undefined) ? o[key] : undefined, obj);
      return array && Array.isArray(array) && index < array.length ? array[index] : undefined;
    }
    
    // 处理普通嵌套路径
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined) ? o[key] : undefined, obj);
  };
  
  // 当收到新消息时，更新数据集
  useEffect(() => {
    if (!latestMessage) {
      console.log(`[RosDataPlot] 话题 ${topic} 没有收到消息`);
      return;
    }
    
    if (paused) {
      console.log(`[RosDataPlot] 话题 ${topic} 的图表已暂停更新`);
      return;
    }
    
    // 确保消息有data字段
    const messageData = latestMessage.data || latestMessage.message;
    if (!messageData) {
      console.log(`[RosDataPlot] 话题 ${topic} 的消息没有data或message字段:`, latestMessage);
      return;
    }
    
    const timestamp = latestMessage.timestamp || Date.now();
    const elapsedTime = (timestamp - startTime) / 1000; // 转换为秒
    
    console.log(`[RosDataPlot] 收到话题 ${topic} 的新消息:`, latestMessage);
    console.log(`[RosDataPlot] 当前选择的字段:`, selectedFields);
    
    setDataSets(prevDataSets => {
      const updatedDataSets = prevDataSets.map((dataSet, index) => {
        const field = selectedFields[index];
        if (!field) return dataSet;
        
        const value = getNestedValue(messageData, field);
        console.log(`[RosDataPlot] 字段 ${field} 的值:`, value);
        
        // 只有当值是数字时才添加
        if (typeof value === 'number' && !isNaN(value)) {
          const newData = [...dataSet.data, { x: elapsedTime, y: value }];
          
          // 限制数据点数量
          if (newData.length > MAX_DATA_POINTS) {
            newData.shift();
          }
          
          console.log(`[RosDataPlot] 更新数据集 ${field}，添加点 (${elapsedTime}, ${value})`);
          return { ...dataSet, data: newData };
        }
        
        return dataSet;
      });
      
      return updatedDataSets;
    });
  }, [latestMessage, paused, selectedFields, startTime, topic]);
  
  // 清除所有数据
  const handleClearData = () => {
    setDataSets(prevDataSets => {
      return prevDataSets.map(dataSet => ({ ...dataSet, data: [] }));
    });
    setStartTime(Date.now());
  };
  
  // 暂停/继续数据更新
  const handleTogglePause = () => {
    setPaused(!paused);
  };
  
  // 处理字段选择变化
  const handleFieldChange = (values: string[]) => {
    setSelectedFields(values);
  };
  
  // 图表选项
  const options = {
    responsive: true,
    animation: {
      duration: 0 // 禁用动画以提高性能
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: {
          display: true,
          text: '时间 (秒)'
        }
      },
      y: {
        beginAtZero: false
      }
    },
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: `话题: ${topic}`
      }
    }
  };
  
  // 图表数据
  const data = {
    datasets: dataSets
  };
  
  return (
    <Card
      title={
        <Space>
          <Text strong>{topic}</Text>
          <Text type="secondary">({messageType})</Text>
        </Space>
      }
      extra={
        <Space>
          <select
            style={{ width: 300, padding: '4px', borderRadius: '2px' }}
            multiple
            value={selectedFields}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value);
              handleFieldChange(values);
            }}
          >
            {availableFields.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
          <Button 
            onClick={handleTogglePause}
          >
            {paused ? "继续" : "暂停"}
          </Button>
          <Button 
            onClick={handleClearData}
          >
            清除
          </Button>
        </Space>
      }
      bodyStyle={{ height: 300 }}
    >
      <Line options={options} data={data} />
    </Card>
  );
};

export default RosDataPlot; 