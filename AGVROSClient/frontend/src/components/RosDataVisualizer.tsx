import React, { useState, useEffect } from 'react';
import { Button, Space, Row, Col, Empty, Card, Spin, Alert } from 'antd';
import RosDataPlot from './RosDataPlot';

// 定义ROS话题信息接口
interface RosTopicInfo {
  name: string;
  type: string;
}

// 定义ROS消息接口
interface RosMessage {
  topic: string;
  type?: string;
  data?: any;
  timestamp?: number;
  message?: any; // 添加message字段
}

// 定义可视化配置接口
interface PlotConfig {
  id: string;
  topic: string;
  messageType: string;
  fieldPaths?: string[];
}

interface RosDataVisualizerProps {
  availableTopics: RosTopicInfo[];
  latestMessages: Record<string, RosMessage>;
  rosConnection: any; // RosConnection实例
  connected: boolean; // 连接状态
  onSubscribe?: (topic: string, message: RosMessage) => void; // 可选的订阅回调
}

const RosDataVisualizer: React.FC<RosDataVisualizerProps> = ({ 
  availableTopics, 
  latestMessages,
  rosConnection,
  connected,
  onSubscribe
}: RosDataVisualizerProps) => {
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [subscribedTopic, setSubscribedTopic] = useState<string>('');
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // 订阅选定的话题
  const handleSubscribeTopic = () => {
    if (!selectedTopic || !rosConnection || !connected) {
      setError('ROS连接未建立或未选择话题');
      return;
    }
    
    try {
      console.log(`[RosDataVisualizer] 正在订阅话题: ${selectedTopic}`);
      
      // 查找选中话题的类型
      const topicInfo = availableTopics.find(t => t.name === selectedTopic);
      const topicType = topicInfo?.type;
      
      // 检查话题类型是否有效
      if (!topicType || topicType === '未知') {
        console.error(`[RosDataVisualizer] 无法订阅话题 ${selectedTopic}，因为无法获取有效的话题类型`);
        setError(`无法获取话题 ${selectedTopic} 的有效类型，无法订阅`);
        return;
      }
      
      // 设置状态
      setSubscribedTopic(selectedTopic);
      setLoading(true);
      setError('');
      setAvailableFields([]);
      setSelectedFields([]);
      
      // 设置消息处理函数
      const handleMessage = (message: RosMessage) => {
        console.log(`[RosDataVisualizer] 收到话题 ${selectedTopic} 的消息:`, message);
        
        // 确保消息有data字段
        if (!message.data && message.message) {
          message.data = message.message;
        }
        
        // 如果提供了回调函数，调用它
        if (onSubscribe) {
          onSubscribe(selectedTopic, message);
        }
        
        // 提取字段
        if (message.data && loading) {
          extractAndSetFields(message.data);
          setLoading(false);
        }
      };
      
      // 订阅话题
      rosConnection.subscribe(selectedTopic, topicType, handleMessage);
      console.log(`[RosDataVisualizer] 已订阅话题: ${selectedTopic} (类型: ${topicType})`);
      
    } catch (error) {
      console.error('[RosDataVisualizer] 订阅话题失败:', error);
      setError(`订阅话题失败: ${error}`);
      setLoading(false);
      setSubscribedTopic('');
    }
  };
  
  // 提取字段并设置状态
  const extractAndSetFields = (data: any) => {
    const fields = extractFieldPaths(data);
    setAvailableFields(fields);
    console.log('提取的字段:', fields);
  };
  
  // 当订阅的话题收到消息时，提取可用字段
  useEffect(() => {
    if (!subscribedTopic) return;
    
    const message = latestMessages[subscribedTopic];
    console.log(`[RosDataVisualizer] 检查话题 ${subscribedTopic} 的最新消息:`, message);
    
    if (!message || !message.data) {
      if (loading && Object.keys(latestMessages).length > 0) {
        // 如果已经加载了一段时间但没有收到消息，显示错误
        setError('未收到消息，请确认话题是否活跃');
        setLoading(false);
      }
      return;
    }
    
    // 收到消息，提取字段
    if (loading) {
      extractAndSetFields(message.data);
      setLoading(false);
    }
  }, [subscribedTopic, latestMessages, loading]);
  
  // 提取所有可能的字段路径
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
  
  // 添加选定字段到图表
  const handleAddFieldsToPlot = () => {
    if (!subscribedTopic || selectedFields.length === 0) return;
    
    const topicInfo = availableTopics.find((t: RosTopicInfo) => t.name === subscribedTopic);
    if (!topicInfo) return;
    
    const newPlot: PlotConfig = {
      id: `plot-${Date.now()}`,
      topic: subscribedTopic,
      messageType: topicInfo.type,
      fieldPaths: [...selectedFields]
    };
    
    console.log(`[RosDataVisualizer] 添加新图表:`, newPlot);
    console.log(`[RosDataVisualizer] 当前最新消息:`, latestMessages[subscribedTopic]);
    
    setPlots([...plots, newPlot]);
    
    // 清除选择，准备下一次操作
    setSelectedFields([]);
  };
  
  // 取消订阅
  const handleUnsubscribe = () => {
    if (!rosConnection || !subscribedTopic) {
      return;
    }

    try {
      console.log(`取消订阅话题: ${subscribedTopic}`);
      rosConnection.unsubscribe(subscribedTopic);
      setSubscribedTopic('');
      setAvailableFields([]);
      setSelectedFields([]);
      setError('');
      console.log(`已取消订阅话题: ${subscribedTopic}`);
    } catch (error) {
      console.error('取消订阅话题失败:', error);
      setError(`取消订阅失败: ${error}`);
    }
  };
  
  // 处理字段选择变化
  const handleFieldSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
    setSelectedFields(values);
  };
  
  // 移除图表
  const handleRemovePlot = (id: string) => {
    setPlots(plots.filter(plot => plot.id !== id));
  };
  
  return (
    <div>
      <Card title="ROS数据可视化">
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 话题选择和订阅 */}
          <Card size="small" title="步骤1: 选择并订阅话题">
            <Row gutter={[16, 16]} align="middle">
              <Col span={16}>
                <select
                  style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  disabled={!!subscribedTopic || !connected}
                >
                  <option value="">选择要可视化的话题</option>
                  {availableTopics.map((topic: RosTopicInfo) => (
                    <option key={topic.name} value={topic.name}>
                      {topic.name} ({topic.type})
                    </option>
                  ))}
                </select>
              </Col>
              <Col span={8}>
                {subscribedTopic ? (
                  <Button 
                    danger
                    onClick={handleUnsubscribe}
                  >
                    取消订阅
                  </Button>
                ) : (
                  <Button 
                    type="primary" 
                    onClick={handleSubscribeTopic}
                    disabled={!selectedTopic || !connected}
                  >
                    订阅话题
                  </Button>
                )}
              </Col>
            </Row>
            {!connected && (
              <Alert
                message="未连接到ROS"
                description="请先连接到ROS服务器"
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
          
          {/* 字段选择和添加到图表 */}
          {subscribedTopic && (
            <Card size="small" title="步骤2: 选择字段添加到图表">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin />
                  <p>等待消息数据...</p>
                </div>
              ) : error ? (
                <Alert
                  message="错误"
                  description={error}
                  type="error"
                  showIcon
                />
              ) : (
                <Row gutter={[16, 16]}>
                  <Col span={16}>
                    <div>
                      <p>已订阅话题: <strong>{subscribedTopic}</strong></p>
                      <p>可用字段: {availableFields.length > 0 ? `(${availableFields.length}个)` : '(暂无)'}</p>
                      <select
                        multiple
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', height: '150px' }}
                        value={selectedFields}
                        onChange={handleFieldSelectionChange}
                      >
                        {availableFields.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                      <p style={{ marginTop: '8px' }}>
                        <small>提示: 按住Ctrl键可选择多个字段</small>
                      </p>
                    </div>
                  </Col>
                  <Col span={8}>
                    <Button 
                      type="primary" 
                      onClick={handleAddFieldsToPlot}
                      disabled={selectedFields.length === 0}
                      style={{ marginTop: '50px' }}
                    >
                      添加到图表
                    </Button>
                  </Col>
                </Row>
              )}
            </Card>
          )}
          
          {/* 图表显示区域 */}
          <Card size="small" title="步骤3: 数据可视化图表">
            {plots.length === 0 ? (
              <Empty description="暂无图表，请选择话题和字段后添加" />
            ) : (
              <Row gutter={[16, 16]}>
                {plots.map(plot => (
                  <Col span={24} key={plot.id}>
                    <div style={{ position: 'relative' }}>
                      <Button 
                        danger 
                        size="small"
                        onClick={() => handleRemovePlot(plot.id)}
                        style={{ 
                          position: 'absolute', 
                          top: '10px', 
                          right: '10px',
                          zIndex: 1
                        }}
                      >
                        移除图表
                      </Button>
                      <RosDataPlot
                        topic={plot.topic}
                        messageType={plot.messageType}
                        latestMessage={latestMessages[plot.topic]}
                        fieldPaths={plot.fieldPaths}
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </Space>
      </Card>
    </div>
  );
};

export default RosDataVisualizer; 