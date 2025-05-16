import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout, Card, Row, Col, Badge, Spin, Empty } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import { AgvStatus } from '../types/agv';
import axios from 'axios';
import message from 'antd/lib/message';

const { Content } = Layout;

// 模拟AGV数据
const mockAgvs: AgvStatus[] = [
  {
    id: 1,
    name: 'AGV-001',
    status: 'online',
    ipAddress: '172.10.25.121', // 使用实际AGV的IP地址
    batteryLevel: 85,
    speed: 1.2,
    lastUpdated: new Date().toISOString()
  },
  {
    id: 2,
    name: 'AGV-002',
    status: 'online',
    ipAddress: '172.10.25.126',
    batteryLevel: 20,
    speed: 0,
    lastUpdated: new Date().toISOString()
  }
];

const HomePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [agvs, setAgvs] = useState<AgvStatus[]>([]);

  useEffect(() => {
    // 模拟API请求延迟
    const fetchAgvs = async () => {
      try {
        // 在实际应用中，这里会调用API获取AGV列表
        setTimeout(() => {
          setAgvs(mockAgvs);
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('获取AGV列表失败', error);
        setLoading(false);
      }
    };

    fetchAgvs();
  }, []);

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

  return (
    <Layout className="home-layout">
      <Content className="home-content">
        <h2>AGV设备列表</h2>
        <Row gutter={[16, 16]}>
          {agvs.map((agv: AgvStatus) => (
            <Col xs={24} sm={12} md={8} lg={6} key={agv.id}>
              <Link to={`/agv/${agv.id}`}>
                <Card
                  hoverable
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <CarOutlined style={{ marginRight: 8 }} />
                      {agv.name}
                    </div>
                  }
                  extra={renderStatusBadge(agv.status)}
                >
                  <p><strong>IP地址:</strong> {agv.ipAddress}</p>
                  <p><strong>电池电量:</strong> {agv.batteryLevel}%</p>
                  <p><strong>当前速度:</strong> {agv.speed} m/s</p>
                  <p><strong>最后更新:</strong> {new Date(agv.lastUpdated).toLocaleString()}</p>
                </Card>
              </Link>
            </Col>
          ))}

          {agvs.length === 0 && !loading && (
            <Col span={24}>
              <Empty description="未找到AGV设备" />
            </Col>
          )}
        </Row>

        {loading && (
          <div className="loading-container">
            <Spin size="large" />
            <p>加载中...</p>
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default HomePage; 