import React from 'react';
import { useState, useEffect } from 'react';
import { Card, Button, Table, Space, Typography } from 'antd';
import Input from 'antd/lib/input';
import Modal from 'antd/lib/modal';
import type { TableProps } from 'antd/lib/table';
import message from 'antd/lib/message';
import axios from 'axios';

const { Text } = Typography;

interface ParamsViewerProps {
  className?: string;
}

interface TableDataItem {
  key: string;
  value: string;
  isFile?: boolean;
  filePath?: string;
}

interface FileContent {
  path: string;
  content: any;
  isLoading: boolean;
}

const ParamsViewer: React.FC<ParamsViewerProps> = (props: ParamsViewerProps) => {
  const [hostname, setHostname] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [tableData, setTableData] = useState<TableDataItem[]>([]);
  const [fileModalVisible, setFileModalVisible] = useState<boolean>(false);
  const [currentFile, setCurrentFile] = useState<FileContent>({ path: '', content: null, isLoading: false });

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
      render: (text: string, record: TableDataItem) => (
        record.isFile ? 
          <Button type="link" onClick={() => handleViewFile(record.filePath || '')}>
            查看文件内容
          </Button> : 
          <span className="text-success">{text}</span>
      ),
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

  const isFileParam = (value: any): { isFile: boolean, path?: string } => {
    try {
      if (typeof value === 'string') {
        const parsedValue = JSON.parse(value);
        if (parsedValue.params_type === 'file' && parsedValue.params_path) {
          return { isFile: true, path: parsedValue.params_path };
        }
      }
    } catch (e) {
      // Not a valid JSON or not a file param
    }
    return { isFile: false };
  };

  const handleViewFile = async (filePath: string) => {
    setCurrentFile({ path: filePath, content: null, isLoading: true });
    setFileModalVisible(true);
    
    try {
      const fullPath = `/usr/local/urobot/params/${filePath}`;
      const response = await axios.post('/api/params/readFile', { filePath: fullPath });
      
      if (response.data.success) {
        setCurrentFile({
          path: filePath,
          content: response.data.data,
          isLoading: false
        });
      } else {
        message.error(`读取文件失败: ${response.data.message || '未知错误'}`);
        setCurrentFile({
          path: filePath,
          content: `读取失败: ${response.data.message || '未知错误'}`,
          isLoading: false
        });
      }
    } catch (error) {
      message.error('读取文件失败');
      setCurrentFile({
        path: filePath,
        content: '读取失败: 网络错误',
        isLoading: false
      });
    }
  };

  const refreshParams = async () => {
    if (!isConnected) return;

    try {
      setLoading(true);
      const response = await axios.get('/api/params/params');
      if (response.data.success) {
        const params = response.data.data;
        const formattedData = Object.entries(params).map(([key, value]) => {
          const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          const fileCheck = isFileParam(stringValue);
          
          return {
            key,
            value: stringValue,
            isFile: fileCheck.isFile,
            filePath: fileCheck.path
          };
        });
        
        setTableData(formattedData);
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
    <>
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

      <Modal 
        title={`文件内容: ${currentFile.path}`}
        open={fileModalVisible}
        onCancel={() => setFileModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setFileModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {currentFile.isLoading ? (
          <div>加载中...</div>
        ) : (
          <pre style={{ maxHeight: '500px', overflow: 'auto' }}>
            {typeof currentFile.content === 'object' 
              ? JSON.stringify(currentFile.content, null, 2) 
              : currentFile.content}
          </pre>
        )}
      </Modal>
    </>
  );
};

export default ParamsViewer; 