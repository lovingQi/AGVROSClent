import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout, Card, Typography, Spin, Button } from 'antd';
import message from 'antd/lib/message';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import RosConnection from '../utils/RosConnection';
import RosImageViewer from '../components/RosImageViewer';

const { Content } = Layout;
const { Title } = Typography;

// 定义ROS图像消息接口
interface RosImageMessage {
  topic: string;
  type?: string;
  data?: any;
  timestamp?: number;
}

const CameraImagePage: React.FC = () => {
  const { agvId } = useParams<{ agvId: string }>();
  const [loading, setLoading] = useState<boolean>(true);
  const [rosConnection, setRosConnection] = useState<any>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [latestMessage, setLatestMessage] = useState<RosImageMessage | null>(null);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [agvIp, setAgvIp] = useState<string>('');

  // 话题名称（带和不带斜杠的版本都尝试）
  const possibleTopicNames = ['/rviz_pallet_camera_image', 'rviz_pallet_camera_image'];
  const messageType = 'sensor_msgs/Image';

  // 初始化ROS连接
  useEffect(() => {
    const initRosConnection = async () => {
      setLoading(true);
      setError('');
      
      // 从localStorage获取最近连接的AGV信息
      const savedAgvId = localStorage.getItem('lastConnectedAgvId');
      const savedAgvIp = localStorage.getItem('lastConnectedAgvIp');
      
      console.log('从localStorage获取的AGV信息:', { savedAgvId, savedAgvIp });
      
      // 优先使用URL中的agvId，如果没有则使用localStorage中的
      const targetAgvId = agvId || savedAgvId || '1';
      
      try {
        // 使用单例模式获取ROS连接实例
        console.log(`尝试获取AGV-${targetAgvId}的ROS连接实例`);
        const ros = RosConnection.getInstance(targetAgvId);
        setRosConnection(ros);
        
        // 尝试连接（如果已连接，这会立即返回true）
        const success = await ros.connect();
        setConnected(success);
        
        if (success) {
          message.success(`已连接到AGV-${targetAgvId}的ROS系统`);
          // 订阅摄像头话题
          subscribeToImageTopic(ros);
        } else {
          setError(`连接到AGV-${targetAgvId}的ROS系统失败`);
          message.error(`连接到AGV的ROS系统失败`);
        }
      } catch (error) {
        console.error('初始化ROS连接时发生错误:', error);
        setError(`连接ROS系统时发生错误: ${error}`);
        message.error('连接ROS系统时发生错误');
      } finally {
        setLoading(false);
      }
    };
    
    initRosConnection();
    
    return () => {
      // 组件卸载时不断开连接，但要取消订阅
      if (rosConnection) {
        console.log('取消订阅摄像头话题');
        possibleTopicNames.forEach(topic => {
          try {
            rosConnection.unsubscribe(topic);
          } catch (e) {
            // 忽略错误
          }
        });
      }
    };
  }, [agvId]);

  // 订阅摄像头话题 - 尝试多个可能的话题名称
  const subscribeToImageTopic = (ros: any) => {
    if (!ros || !ros.isConnected()) {
      setError('ROS连接未建立，无法订阅话题');
      return;
    }
    
    // 先查询可用的话题列表
    ros.getTopics().then((topics: string[]) => {
      console.log('获取到的话题列表:', topics);
      
      // 检查是否存在摄像头话题
      const foundTopic = possibleTopicNames.find(topic => topics.includes(topic));
      
      if (foundTopic) {
        console.log(`找到摄像头话题: ${foundTopic}`);
        
        // 获取并验证话题类型
        ros.getTopicType(foundTopic).then((type: string) => {
          if (type && type !== '未知') {
            console.log(`话题 ${foundTopic} 的类型为: ${type}`);
            
            // 需要确认这是图像类型话题
            if (type === 'sensor_msgs/Image' || type === 'sensor_msgs/CompressedImage') {
              try {
                console.log(`订阅话题: ${foundTopic}, 类型: ${type}`);
                ros.subscribe(foundTopic, type, (message: RosImageMessage) => {
                  console.log(`收到图像消息, 大小: ${message.data?.data?.length || '未知'} bytes`);
                  setLatestMessage(message);
                });
                
                message.success(`成功订阅话题: ${foundTopic}`);
              } catch (error) {
                console.error('订阅话题失败:', error);
                setError(`订阅话题 ${foundTopic} 失败: ${error}`);
              }
            } else {
              setError(`话题 ${foundTopic} 不是图像类型 (${type})`);
            }
          } else {
            setError(`无法获取话题 ${foundTopic} 的类型`);
          }
        }).catch((error: any) => {
          console.error(`获取话题 ${foundTopic} 类型失败:`, error);
          setError(`获取话题类型失败: ${error}`);
        });
      } else {
        console.error('在话题列表中未找到摄像头话题');
        setError(`未找到摄像头话题，可用话题: ${topics.join(', ').substring(0, 200)}...`);
      }
    }).catch((error: any) => {
      console.error('获取话题列表失败:', error);
      setError(`获取话题列表失败: ${error}`);
    });
  };

  // 重新订阅
  const handleReconnect = async () => {
    setReconnecting(true);
    setError('');
    
    try {
      if (rosConnection) {
        // 重新订阅话题，而不是重新连接
        subscribeToImageTopic(rosConnection);
        message.success('已重新订阅话题');
      }
    } catch (error) {
      console.error('重新订阅失败:', error);
      setError(`重新订阅时发生错误: ${error}`);
      message.error('重新订阅时发生错误');
    } finally {
      setReconnecting(false);
    }
  };

  // 返回上一页
  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <Layout className="layout-content">
      <Content style={{ padding: '20px' }}>
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button type="link" onClick={handleGoBack} icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0 }}>
                返回
              </Button>
              <Title level={4} style={{ margin: 0 }}>AGV-{agvId || localStorage.getItem('lastConnectedAgvId')} 摄像头图像</Title>
            </div>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReconnect}
              loading={reconnecting}
              disabled={loading}
            >
              重新订阅
            </Button>
          }
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <Spin tip="正在连接ROS系统..." />
            </div>
          ) : !connected ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <p>未连接到ROS系统，请点击"重新订阅"按钮尝试连接。</p>
              <p style={{ color: 'red' }}>{error}</p>
              <Button type="primary" onClick={handleReconnect}>
                重新连接
              </Button>
            </div>
          ) : (
            <div>
              {error && (
                <div style={{ marginBottom: '15px', color: 'red' }}>
                  <p>{error}</p>
                </div>
              )}
              <p>话题: {possibleTopicNames.join(' 或 ')}</p>
              <p>类型: {messageType}</p>
              <RosImageViewer 
                topic={latestMessage?.topic || possibleTopicNames[0]}
                latestMessage={latestMessage || undefined}
                height={600}
              />
            </div>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default CameraImagePage; 