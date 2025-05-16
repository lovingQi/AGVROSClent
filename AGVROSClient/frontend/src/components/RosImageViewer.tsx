import React, { useEffect, useState } from 'react';
import { Card, Spin, Alert } from 'antd';

// 定义ROS图像消息接口
interface RosImageMessage {
  topic: string;
  type?: string;
  data?: any;  // 修改为更通用的类型，以便处理不同格式的数据
  timestamp?: number;
}

// 定义组件属性接口
interface RosImageViewerProps {
  topic: string;
  latestMessage?: RosImageMessage;
  width?: number | string;
  height?: number | string;
}

const RosImageViewer: React.FC<RosImageViewerProps> = ({ 
  topic, 
  latestMessage,
  width = '100%',
  height = 400
}: RosImageViewerProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [debugInfo, setDebugInfo] = useState<string>('等待图像数据...');

  useEffect(() => {
    if (!latestMessage) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 记录收到的消息结构，方便调试
      const receivedDataInfo = JSON.stringify({
        topic: latestMessage.topic,
        type: latestMessage.type,
        hasData: !!latestMessage.data,
        dataType: latestMessage.data ? typeof latestMessage.data : 'undefined',
        isDataObject: latestMessage.data ? typeof latestMessage.data === 'object' : false,
        dataKeys: latestMessage.data && typeof latestMessage.data === 'object' ? Object.keys(latestMessage.data) : []
      }, null, 2);
      
      console.log('收到的图像消息信息:', receivedDataInfo);
      setDebugInfo(receivedDataInfo);

      // 获取图像数据
      const imageData = latestMessage.data;
      
      if (!imageData) {
        console.error('图像消息没有data字段', latestMessage);
        setError('图像消息格式不正确：缺少数据');
        setLoading(false);
        return;
      }

      // 处理不同的数据结构
      const extractImageData = () => {
        // 直接使用data字段
        if (imageData.data && imageData.width && imageData.height && imageData.encoding) {
          return imageData;
        }
        
        // 嵌套在msg字段中
        if (imageData.msg && imageData.msg.data && imageData.msg.width && imageData.msg.height) {
          return imageData.msg;
        }
        
        // 对于一些ROS桥接器，数据可能包装在多层对象中
        for (const key in imageData) {
          const nestedData = imageData[key];
          if (nestedData && typeof nestedData === 'object' && 
              nestedData.data && nestedData.width && nestedData.height) {
            return nestedData;
          }
        }
        
        // 如果找不到标准结构，尝试从顶层对象提取需要的字段
        if (imageData.data) {
          const width = imageData.width || 640; // 假设默认尺寸
          const height = imageData.height || 480;
          const encoding = imageData.encoding || 'rgb8';
          return { data: imageData.data, width, height, encoding };
        }
        
        return null;
      };
      
      const extractedData = extractImageData();
      
      if (!extractedData) {
        console.error('无法提取有效的图像数据', imageData);
        setError('图像消息格式不支持：无法提取有效数据');
        setLoading(false);
        return;
      }
      
      console.log('提取的图像数据:', {
        width: extractedData.width,
        height: extractedData.height,
        encoding: extractedData.encoding,
        dataLength: extractedData.data ? extractedData.data.length : 0
      });

      // 处理bgr8/rgb8格式图像
      const encoding = extractedData.encoding?.toLowerCase() || '';
      
      if (encoding === 'bgr8' || encoding === 'rgb8') {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 设置画布尺寸
        canvas.width = extractedData.width;
        canvas.height = extractedData.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 创建ImageData对象
        const imgData = ctx.createImageData(extractedData.width, extractedData.height);
        const data = imgData.data;
        
        // 确保数据是Uint8Array或标准数组
        let pixelData = extractedData.data;
        if (!(pixelData instanceof Uint8Array) && Array.isArray(pixelData)) {
          pixelData = new Uint8Array(pixelData);
        }
        
        try {
          // 填充图像数据
          if (encoding === 'bgr8') {
            // BGR8转RGBA
            for (let i = 0; i < pixelData.length; i += 3) {
              const pos = (i / 3) * 4;
              data[pos] = pixelData[i + 2];     // R
              data[pos + 1] = pixelData[i + 1]; // G
              data[pos + 2] = pixelData[i];     // B
              data[pos + 3] = 255;              // A
            }
          } else {
            // RGB8转RGBA
            for (let i = 0; i < pixelData.length; i += 3) {
              const pos = (i / 3) * 4;
              data[pos] = pixelData[i];         // R
              data[pos + 1] = pixelData[i + 1]; // G
              data[pos + 2] = pixelData[i + 2]; // B
              data[pos + 3] = 255;              // A
            }
          }
          
          // 将图像数据绘制到画布
          ctx.putImageData(imgData, 0, 0);
          setImageUrl(null); // 清除之前的URL
        } catch (err) {
          console.error('处理图像像素数据时出错:', err);
          setError(`处理图像像素数据时出错: ${err}`);
        }
      } 
      // 处理compressed图像格式
      else if (encoding.includes('compressed') || encoding.includes('jpeg') || encoding.includes('png')) {
        try {
          // 确保数据是Uint8Array
          let compressedData = extractedData.data;
          if (!(compressedData instanceof Uint8Array) && Array.isArray(compressedData)) {
            compressedData = new Uint8Array(compressedData);
          }
          
          // 创建Blob对象
          const mimeType = encoding.includes('jpeg') ? 'image/jpeg' : 'image/png';
          const blob = new Blob([compressedData], { type: mimeType });
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
          
          // 清理Canvas
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        } catch (err) {
          console.error('处理压缩图像数据时出错:', err);
          setError(`处理压缩图像数据时出错: ${err}`);
        }
      } else {
        setError(`不支持的图像编码: ${encoding}`);
      }
    } catch (err) {
      console.error('处理图像数据出错:', err);
      setError(`处理图像数据时出错: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [latestMessage]);

  // 清理URL
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  return (
    <Card
      title={`图像: ${topic}`}
      bodyStyle={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    >
      <Spin spinning={loading} tip="加载图像中...">
        {error ? (
          <div>
            <Alert type="error" message={error} />
            <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              <p>调试信息:</p>
              <pre>{debugInfo}</pre>
            </div>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`ROS图像: ${topic}`}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '90%', 
              objectFit: 'contain' 
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <canvas
              ref={canvasRef}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '90%', 
                objectFit: 'contain' 
              }}
            />
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              {!latestMessage && <p>等待图像数据...</p>}
            </div>
            <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap', fontSize: '10px', maxHeight: '100px', overflow: 'auto' }}>
              <pre>{debugInfo}</pre>
            </div>
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default RosImageViewer; 