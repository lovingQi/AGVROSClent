import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout, Card, Badge, Spin, Empty, Tabs, Button, Table, Typography, Space, Alert, Tag } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import RosConnection from '../utils/RosConnection';
import RosDataVisualizer from '../components/RosDataVisualizer';
import MapViewer from '../components/MapViewer';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 定义ROS话题信息接口
interface RosTopicInfo {
  name: string;
  type: string;
}

// 定义ROS消息接口
interface RosMessage {
  id?: string;
  topic: string;
  timestamp?: number;
  message?: any;
  type?: string;
  data?: any;
}

// 定义AGV详情接口
interface AgvDetail {
  id: number;
  name: string;
  status: string;
  ipAddress: string;
  batteryLevel: number;
  speed: number;
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
  lastUpdated: string;
  availableTopics?: RosTopicInfo[];
}

// 模拟AGV详情数据 - 实际项目中会从API获取
const mockAgvDetail: AgvDetail = {
  id: 1,
  name: 'AGV-001',
  status: 'online',
  ipAddress: '172.10.25.121', // 使用实际AGV的IP地址
  batteryLevel: 85,
  speed: 1.2,
  position: { x: 10.5, y: 20.3, z: 0.0 },
  orientation: { x: 0.0, y: 0.0, z: 0.1, w: 0.99 },
  lastUpdated: new Date().toISOString(),
  availableTopics: [
    { name: '/battery_status', type: 'std_msgs/Float32' },
    { name: '/velocity', type: 'geometry_msgs/Twist' },
    { name: '/position', type: 'geometry_msgs/Pose' },
    { name: '/cmd_vel', type: 'geometry_msgs/Twist' },
    { name: '/scan', type: 'sensor_msgs/LaserScan' },
    { name: '/diagnostics', type: 'diagnostic_msgs/DiagnosticArray' }
  ]
};

// 添加AGV-002的模拟数据
const mockAgvs = [
  mockAgvDetail,
  {
    id: 2,
    name: 'AGV-002',
    status: 'online',
    ipAddress: '172.10.25.126', // 更新后的AGV-002 IP地址
    batteryLevel: 65,
    speed: 0.8,
    position: { x: 15.2, y: 8.7, z: 0.0 },
    orientation: { x: 0.0, y: 0.0, z: 0.5, w: 0.87 },
    lastUpdated: new Date().toISOString(),
    availableTopics: []
  }
];

const messageColumns = [
  {
    title: '时间戳',
    dataIndex: ['data', 'timestamp'],
    key: 'timestamp',
    render: (text: string) => {
      const date = new Date(text);
      return date.toLocaleTimeString();
    }
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
  },
  {
    title: '数据',
    dataIndex: ['data', 'value'],
    key: 'value',
    render: (value: any) => {
      return typeof value === 'object' ? JSON.stringify(value) : value?.toString() || '';
    }
  }
];

const AGVDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const agvId = id ? parseInt(id, 10) : 0;
  
  const [loading, setLoading] = useState(true);
  const [agvDetail, setAgvDetail] = useState<AgvDetail | null>(null);
  const [connected, setConnected] = useState(false);
  const [rosConnection, setRosConnection] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [topicMessages, setTopicMessages] = useState<RosMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string>('');
  const [availableTopics, setAvailableTopics] = useState<RosTopicInfo[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [subscribedTopic, setSubscribedTopic] = useState<string>('');
  const [messages, setMessages] = useState<RosMessage[]>([]);
  const [latestMessages, setLatestMessages] = useState<Record<string, RosMessage>>({});

  useEffect(() => {
    // 模拟API请求
    const fetchAgvDetail = async () => {
      try {
        // 在实际应用中，这里会调用API获取AGV详情
        setTimeout(() => {
          // 根据agvId选择对应的模拟数据
          const selectedAgv = mockAgvs.find(agv => agv.id === agvId) || mockAgvs[0];
          setAgvDetail(selectedAgv);
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('获取AGV详情失败', error);
        setLoading(false);
      }
    };

    fetchAgvDetail();
  }, [agvId]);

  const connectToRos = async () => {
    if (!agvDetail) return;
    
    setConnecting(true);
    setConnectionError('');
    
    try {
      console.log(`尝试连接到ROS: ${agvDetail.ipAddress}:${9090}`);
      
      // 使用单例模式获取ROS连接实例
      const ros = RosConnection.getInstance(agvId.toString());
      await ros.connect();
      
      setRosConnection(ros);
      setConnected(true);
      
      // 获取可用话题
      try {
        console.log('连接成功，正在获取话题列表...');
        const topics = await ros.getTopics();
        console.log('获取到的话题:', topics);
        
        // 处理获取到的话题列表
        if (topics && topics.length > 0) {
          // 获取话题类型
          const topicInfos = await getTopicTypes(topics);
          setAvailableTopics(topicInfos);
          setConnectionError('');
          
          // 保存AGV ID和IP地址到localStorage，以便摄像头页面使用
          localStorage.setItem('lastConnectedAgvId', agvId.toString());
          localStorage.setItem('lastConnectedAgvIp', agvDetail.ipAddress);
        } else {
          console.warn('获取到的话题列表为空');
          setConnectionError('未获取到任何话题，请检查ROS系统是否正常运行');
        }
      } catch (error) {
        console.error('获取话题失败:', error);
        setConnectionError(`获取话题失败: ${error}`);
      }
    } catch (error) {
      console.error('连接ROS失败:', error);
      setConnectionError(`无法连接到ROS服务器: ${error}`);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    return () => {
      // 组件卸载时不断开连接，因为摄像头页面可能会使用
    };
  }, [rosConnection]);

  const handleTopicSelect = (topicName: string) => {
    setSelectedTopic(topicName);
    setTopicMessages([]);

    if (!topicName || !rosConnection || !connected) return;

    try {
      // 找到选择的话题信息
      const topicInfo = availableTopics.find(t => t.name === topicName);
      if (!topicInfo) return;

      // 订阅话题
      rosConnection.subscribe(topicName, topicInfo.type, (message: RosMessage) => {
        setTopicMessages(prev => [...prev.slice(-9), message]);
      });
    } catch (error) {
      console.error(`订阅话题 ${topicName} 失败:`, error);
    }

    return () => {
      if (rosConnection && connected) {
        rosConnection.unsubscribe(topicName);
      }
    };
  };

  const handleRefresh = () => {
    setLoading(true);
    // 模拟刷新
    setTimeout(() => {
      // 找到当前AGV的索引
      const agvIndex = mockAgvs.findIndex(agv => agv.id === agvId);
      if (agvIndex !== -1) {
        // 更新对应AGV的数据
        mockAgvs[agvIndex] = { 
          ...mockAgvs[agvIndex],
          batteryLevel: Math.floor(Math.random() * 100),
          speed: Math.random() * 2,
          lastUpdated: new Date().toISOString()
        };
        setAgvDetail(mockAgvs[agvIndex]);
      } else {
        // 如果找不到，使用第一个AGV的数据
        setAgvDetail(mockAgvs[0]);
      }
      setLoading(false);
    }, 1000);
  };

  // 获取话题类型
  const getTopicTypes = async (topics: string[]) => {
    if (!rosConnection || !connected || topics.length === 0) {
      return [];
    }
    
    try {
      console.log('正在获取话题类型...');
      
      // 调用/rosapi/topic_type服务获取每个话题的类型
      const topicInfos: RosTopicInfo[] = [];
      
      for (const topic of topics) {
        try {
          // 创建一个Promise来获取话题类型
          const topicType = await new Promise<string>((resolve, reject) => {
            const serviceCallId = `topic_type_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            
            // 发送服务调用请求
            rosConnection.sendToRos({
              op: 'call_service',
              id: serviceCallId,
              service: '/rosapi/topic_type',
              args: { topic }
            });
            
            // 设置超时
            const timeoutId = setTimeout(() => {
              reject(new Error(`获取话题 ${topic} 类型超时`));
            }, 2000);
            
            // 创建一次性事件监听器
            const messageHandler = (data: { agvId: number, message: string }) => {
              try {
                const rosMsg = JSON.parse(data.message);
                if (rosMsg.op === 'service_response' && rosMsg.id === serviceCallId) {
                  clearTimeout(timeoutId);
                  rosConnection.socket?.off('ros:message', messageHandler);
                  
                  if (rosMsg.values && rosMsg.values.type) {
                    resolve(rosMsg.values.type);
                  } else {
                    resolve('未知');
                  }
                }
              } catch (error) {
                console.error(`解析话题 ${topic} 类型失败:`, error);
                resolve('未知');
              }
            };
            
            rosConnection.socket?.on('ros:message', messageHandler);
          });
          
          topicInfos.push({
            name: topic,
            type: topicType
          });
          
        } catch (error) {
          console.error(`获取话题 ${topic} 类型失败:`, error);
          topicInfos.push({
            name: topic,
            type: '未知'
          });
        }
      }
      
      console.log('获取到的话题类型:', topicInfos);
      return topicInfos;
    } catch (error) {
      console.error('获取话题类型失败:', error);
      return topics.map(topic => ({
        name: topic,
        type: '未知'
      }));
    }
  };

  const refreshTopics = async () => {
    if (!rosConnection || !connected) {
      setConnectionError('未连接到ROS');
      return;
    }
    
    try {
      console.log('手动刷新话题列表...');
      setLoading(true);
      const topics = await rosConnection.getTopics();
      console.log('手动获取到的话题:', topics);
      
      if (topics && topics.length > 0) {
        // 获取话题类型
        const topicInfos = await getTopicTypes(topics);
        setAvailableTopics(topicInfos);
        setConnectionError('');
      } else {
        console.warn('手动获取到的话题列表为空');
        setConnectionError('未获取到任何话题，请检查ROS系统是否正常运行');
      }
    } catch (error) {
      console.error('手动获取话题失败:', error);
      setConnectionError(`获取话题失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge status="success" text="在线" />;
      case 'offline':
        return <Badge status="error" text="离线" />;
      case 'warning':
        return <Badge status="warning" text="警告" />;
      default:
        return <Badge status="default" text="未知" />;
    }
  };

  // 订阅选中的话题
  const subscribeToTopic = () => {
    if (!rosConnection || !connected || !selectedTopic) {
      return;
    }

    try {
      console.log(`正在订阅话题: ${selectedTopic}`);
      
      // 查找选中话题的类型
      const topicInfo = availableTopics.find(t => t.name === selectedTopic);
      const topicType = topicInfo?.type;
      
      // 检查话题类型是否有效
      if (!topicType || topicType === '未知') {
        console.error(`无法订阅话题 ${selectedTopic}，因为无法获取有效的话题类型`);
        // 尝试重新获取话题类型
        refreshTopicType(selectedTopic).then(validType => {
          if (validType && validType !== '未知') {
            console.log(`成功获取到话题 ${selectedTopic} 的类型: ${validType}，开始订阅`);
            doSubscribe(selectedTopic, validType);
          } else {
            console.error(`无法获取话题 ${selectedTopic} 的有效类型，无法订阅`);
          }
        });
        return;
      }
      
      console.log(`话题 ${selectedTopic} 的类型: ${topicType}`);
      doSubscribe(selectedTopic, topicType);
      
    } catch (error) {
      console.error('订阅话题失败:', error);
      setSubscribedTopic('');
    }
  };
  
  // 执行订阅操作
  const doSubscribe = (topic: string, type: string) => {
    // 清除之前的消息
    setMessages([]);
    setSubscribedTopic(topic);
    
    // 设置消息处理函数
    const handleMessage = (message: RosMessage) => {
      console.log(`[AGVDetailPage] 收到话题 ${topic} 的消息:`, message);
      
      const newMessage: RosMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        topic: topic,
        timestamp: Date.now(),
        message: message.data,
        data: message.data,
        type: type
      };
      
      // 更新消息列表
      setMessages(prev => {
        const updatedMessages = [newMessage, ...prev];
        // 限制消息数量，避免内存溢出
        if (updatedMessages.length > 100) {
          return updatedMessages.slice(0, 100);
        }
        return updatedMessages;
      });
      
      // 更新最新消息记录，用于数据可视化
      console.log(`[AGVDetailPage] 更新话题 ${topic} 的最新消息:`, newMessage);
      setLatestMessages(prev => {
        const updated = {
          ...prev,
          [topic]: newMessage
        };
        console.log(`[AGVDetailPage] 更新后的最新消息集合:`, updated);
        return updated;
      });
    };
    
    // 订阅话题
    rosConnection.subscribe(topic, type, handleMessage);
    console.log(`[AGVDetailPage] 已订阅话题: ${topic} (类型: ${type})`);
  };
  
  // 重新获取单个话题的类型
  const refreshTopicType = async (topic: string): Promise<string> => {
    if (!rosConnection || !connected) {
      return '未知';
    }
    
    try {
      console.log(`正在重新获取话题 ${topic} 的类型...`);
      
      // 创建一个Promise来获取话题类型
      const topicType = await new Promise<string>((resolve, reject) => {
        const serviceCallId = `topic_type_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // 发送服务调用请求
        rosConnection.sendToRos({
          op: 'call_service',
          id: serviceCallId,
          service: '/rosapi/topic_type',
          args: { topic }
        });
        
        // 设置超时
        const timeoutId = setTimeout(() => {
          reject(new Error(`获取话题 ${topic} 类型超时`));
        }, 2000);
        
        // 创建一次性事件监听器
        const messageHandler = (data: { agvId: number, message: string }) => {
          try {
            const rosMsg = JSON.parse(data.message);
            if (rosMsg.op === 'service_response' && rosMsg.id === serviceCallId) {
              clearTimeout(timeoutId);
              rosConnection.socket?.off('ros:message', messageHandler);
              
              if (rosMsg.values && rosMsg.values.type) {
                resolve(rosMsg.values.type);
              } else {
                resolve('未知');
              }
            }
          } catch (error) {
            console.error(`解析话题 ${topic} 类型失败:`, error);
            resolve('未知');
          }
        };
        
        rosConnection.socket?.on('ros:message', messageHandler);
      });
      
      // 更新话题类型
      if (topicType && topicType !== '未知') {
        // 更新availableTopics中的类型
        setAvailableTopics(prev => 
          prev.map(t => t.name === topic ? { ...t, type: topicType } : t)
        );
        console.log(`更新话题 ${topic} 的类型为: ${topicType}`);
      }
      
      return topicType;
    } catch (error) {
      console.error(`获取话题 ${topic} 类型失败:`, error);
      return '未知';
    }
  };

  // 取消订阅话题
  const unsubscribeFromTopic = () => {
    if (!rosConnection || !subscribedTopic) {
      return;
    }

    try {
      console.log(`取消订阅话题: ${subscribedTopic}`);
      rosConnection.unsubscribe(subscribedTopic);
      setSubscribedTopic('');
      console.log(`已取消订阅话题: ${subscribedTopic}`);
    } catch (error) {
      console.error('取消订阅话题失败:', error);
    }
  };

  // 处理可视化组件的订阅回调
  const handleVisualizerSubscribe = (topic: string, message: RosMessage) => {
    console.log(`[AGVDetailPage] 可视化组件订阅了话题 ${topic}，收到消息:`, message);
    
    // 确保消息有正确的格式
    const newMessage: RosMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      topic: topic,
      timestamp: Date.now(),
      message: message.data || message.message,
      data: message.data || message.message,
      type: message.type
    };
    
    // 更新最新消息记录
    setLatestMessages(prev => {
      const updated = {
        ...prev,
        [topic]: newMessage
      };
      console.log(`[AGVDetailPage] 可视化组件更新了话题 ${topic} 的最新消息:`, updated);
      return updated;
    });
  };

  // 在组件中添加刷新话题按钮
  const renderRosConnection = () => (
    <Card title="ROS连接" className="detail-card">
      <div>
        <p>
          <strong>连接状态:</strong> {connected ? 
            <Tag color="green">已连接</Tag> : 
            <Tag color="red">未连接</Tag>
          }
        </p>
        
        {!connected && (
          <Button 
            type="primary" 
            onClick={connectToRos}
            loading={connecting}
            style={{ marginBottom: 16 }}
          >
            连接到ROS
          </Button>
        )}

        {connectionError && (
          <Alert
            message="连接错误"
            description={connectionError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {connected && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: 16 }}>
            <Link to={`/agv/${agvId}/camera`}>
              <Button type="primary">
                查看摄像头图像
              </Button>
            </Link>
          </div>
        )}
        
        {connected && (
          <Tabs defaultActiveKey="topics">
            <TabPane tab="话题列表" key="topics">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <strong>可用话题:</strong>
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={refreshTopics}
                    loading={loading}
                  >
                    刷新话题列表
                  </Button>
                </div>
                
                {availableTopics.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <strong>选择话题:</strong>
                      <select 
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                        style={{ marginLeft: '10px', padding: '5px', width: '60%' }}
                      >
                        <option value="">-- 选择话题 --</option>
                        {availableTopics.map(topic => (
                          <option key={topic.name} value={topic.name}>
                            {topic.name} ({topic.type})
                          </option>
                        ))}
                      </select>
                      
                      <div style={{ marginTop: 16 }}>
                        {subscribedTopic ? (
                          <Button 
                            type="primary" 
                            danger 
                            onClick={unsubscribeFromTopic}
                          >
                            取消订阅 {subscribedTopic}
                          </Button>
                        ) : (
                          <Button 
                            type="primary" 
                            onClick={subscribeToTopic}
                            disabled={!selectedTopic}
                          >
                            订阅选中话题
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {subscribedTopic && (
                      <div>
                        <h4>订阅的话题: {subscribedTopic}</h4>
                        <div style={{ marginBottom: 16 }}>
                          <strong>接收到的消息:</strong> {messages.length}
                        </div>
                        
                        {messages.length > 0 ? (
                          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                            {messages.map((msg) => (
                              <Card 
                                key={msg.id} 
                                size="small" 
                                style={{ marginBottom: 8 }}
                                title={`${new Date(msg.timestamp || Date.now()).toLocaleTimeString()}`}
                              >
                                <pre style={{ maxHeight: '200px', overflow: 'auto' }}>
                                  {JSON.stringify(msg.message, null, 2)}
                                </pre>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <Empty description="等待消息..." />
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Empty description="未找到可用话题" />
                )}
              </Space>
            </TabPane>
            
            <TabPane tab="地图" key="map">
              <MapViewer hostname={agvDetail?.ipAddress} />
            </TabPane>
            
            <TabPane tab="数据可视化" key="visualization">
              <RosDataVisualizer 
                availableTopics={availableTopics}
                latestMessages={latestMessages}
                rosConnection={rosConnection}
                connected={connected}
                onSubscribe={handleVisualizerSubscribe}
              />
            </TabPane>
          </Tabs>
        )}
      </div>
    </Card>
  );

  return (
    <Layout className="agv-detail-layout">
      <Content className="agv-detail-content">
        <div className="page-header">
          <Link to="/">
            <Button icon={<ArrowLeftOutlined />}>返回列表</Button>
          </Link>
          <Title level={2}>AGV详情: {agvDetail?.name || `AGV-${agvId}`}</Title>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        {loading ? (
          <div className="loading-container">
            <Spin size="large" />
            <p>加载中...</p>
          </div>
        ) : agvDetail ? (
          <div className="agv-detail-container">
            <Card title="基本信息" className="detail-card">
              <p><strong>状态:</strong> {renderStatusBadge(agvDetail.status)}</p>
              <p><strong>IP地址:</strong> {agvDetail.ipAddress}</p>
              <p><strong>电池电量:</strong> {agvDetail.batteryLevel}%</p>
              <p><strong>当前速度:</strong> {agvDetail.speed} m/s</p>
              <p><strong>最后更新:</strong> {new Date(agvDetail.lastUpdated).toLocaleString()}</p>
            </Card>

            <Card title="位置信息" className="detail-card">
              <p><strong>位置 (x, y, z):</strong> ({agvDetail.position.x}, {agvDetail.position.y}, {agvDetail.position.z})</p>
              <p><strong>方向 (x, y, z, w):</strong> ({agvDetail.orientation.x}, {agvDetail.orientation.y}, {agvDetail.orientation.z}, {agvDetail.orientation.w})</p>
              {/* 这里可以添加一个3D可视化组件来显示AGV的位置 */}
            </Card>

            {renderRosConnection()}
          </div>
        ) : (
          <Empty description="未找到AGV信息" />
        )}
      </Content>
    </Layout>
  );
};

export default AGVDetailPage; 