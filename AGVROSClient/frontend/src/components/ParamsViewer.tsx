import React from 'react';
import { useState, useEffect } from 'react';
import { Card, Button, Table, Space } from 'antd';
import Input from 'antd/lib/input';
import type { TableProps } from 'antd/lib/table';
import message from 'antd/lib/message';
import axios from 'axios';

interface ParamsViewerProps {
  className?: string;
}

interface TableDataItem {
  key: string;
  value: string;
}

const ParamsViewer: React.FC<ParamsViewerProps> = (props: ParamsViewerProps) => {
  const [hostname, setHostname] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [tableData, setTableData] = useState<TableDataItem[]>([]);

  const columns: TableProps<TableDataItem>['columns'] = [
    {
      title: '参数名',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: '参数值',
      dataIndex: 'value',
      key: 'value',
      render: (text: string) => <span className="text-success">{text}</span>,
    },
  ];

  const handleConnect = async () => {
    if (isConnected) {
      try {
        setConnecting(true);
        await axios.post('/api/params/disconnect');
        setIsConnected(false);
        setTableData([]);
        message.success('已断开连接');
      } catch (error) {
        message.error('断开连接失败');
      } finally {
        setConnecting(false);
      }
      return;
    }

    if (!hostname) {
      message.warning('请输入机器人IP地址');
      return;
    }

    try {
      setConnecting(true);
      const response = await axios.post('/api/params/connect', { hostname });
      if (response.data.success) {
        setIsConnected(true);
        message.success('连接成功');
        await refreshParams();
      } else {
        message.error(response.data.message || '连接失败');
      }
    } catch (error) {
      message.error('连接失败');
    } finally {
      setConnecting(false);
    }
  };

  const refreshParams = async () => {
    if (!isConnected) return;

    try {
      setLoading(true);
      const response = await axios.get('/api/params/params');
      if (response.data.success) {
        const params = response.data.data;
        setTableData(
          Object.entries(params).map(([key, value]) => ({
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          }))
        );
      } else {
        message.error('获取参数失败');
      }
    } catch (error) {
      message.error('获取参数失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (isConnected) {
        axios.post('/api/params/disconnect').catch(console.error);
      }
    };
  }, [isConnected]);

  return (
    <Card
      title="机器人参数配置"
      className={props.className}
      extra={
        <Space>
          <Input
            value={hostname}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHostname(e.target.value)}
            placeholder="请输入机器人IP地址"
          />
          <Button type="primary" loading={connecting} onClick={handleConnect}>
            {isConnected ? '断开连接' : '连接'}
          </Button>
          <Button disabled={!isConnected} onClick={refreshParams}>
            刷新参数
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={tableData}
        loading={loading}
        pagination={false}
      />
    </Card>
  );
};

export default ParamsViewer; 