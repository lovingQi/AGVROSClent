import { Client } from 'ssh2';
import { logger } from '../utils/logger';

export class SSHService {
  private client: Client | null = null;
  private readonly username = 'ucore';
  private readonly password = '133233';
  private readonly defaultTimeout = 30000; // 增加超时时间到30秒

  async connect(hostname: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (this.client) {
          logger.warn(`检测到已存在的SSH连接，正在断开...`);
          this.disconnect();
        }

        logger.info(`正在尝试SSH连接，主机: ${hostname}, 用户名: ${this.username}`);
        this.client = new Client();
        
        // 设置连接超时定时器
        const timeoutTimer = setTimeout(() => {
          logger.error(`SSH连接超时，主机: ${hostname}`);
          if (this.client) {
            this.client.end();
          }
          resolve(false);
        }, this.defaultTimeout);

        this.client.on('ready', () => {
          clearTimeout(timeoutTimer);
          logger.info(`SSH连接成功，主机: ${hostname}`);
          resolve(true);
        });

        this.client.on('error', (err) => {
          clearTimeout(timeoutTimer);
          logger.error(`SSH连接错误: ${err.message}, 主机: ${hostname}`);
          if (this.client) {
            this.client.end();
          }
          resolve(false);
        });

        this.client.on('timeout', () => {
          clearTimeout(timeoutTimer);
          logger.error(`SSH连接超时，主机: ${hostname}`);
          if (this.client) {
            this.client.end();
          }
          resolve(false);
        });

        this.client.on('handshake', (negotiated) => {
          logger.info(`SSH握手成功，主机: ${hostname}, 协商的算法: ${JSON.stringify(negotiated)}`);
        });

        this.client.on('close', () => {
          clearTimeout(timeoutTimer);
          logger.info(`SSH连接已关闭，主机: ${hostname}`);
          this.client = null;
        });

        this.client.connect({
          host: hostname,
          port: 22,  // 明确指定SSH端口
          username: this.username,
          password: this.password,
          readyTimeout: this.defaultTimeout,
          keepaliveInterval: 10000,
          keepaliveCountMax: 3,
          algorithms: {
            kex: [
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group1-sha1',
              'diffie-hellman-group14-sha256',
              'diffie-hellman-group-exchange-sha1',
              'diffie-hellman-group-exchange-sha256'
            ],
            cipher: [
              'aes128-cbc',
              '3des-cbc',
              'aes192-cbc',
              'aes256-cbc',
              'aes128-ctr',
              'aes192-ctr',
              'aes256-ctr'
            ],
            serverHostKey: [
              'ssh-rsa',
              'ssh-dss',
              'ecdsa-sha2-nistp256',
              'ecdsa-sha2-nistp384',
              'ecdsa-sha2-nistp521'
            ],
            hmac: [
              'hmac-sha1',
              'hmac-sha1-96',
              'hmac-sha2-256',
              'hmac-sha2-512'
            ]
          },
          tryKeyboard: true,  // 启用键盘交互式认证
          hostVerifier: () => true,  // 禁用主机密钥验证
          debug: (debug) => {
            logger.debug(`SSH调试信息: ${debug}`);
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`SSH连接异常: ${errorMessage}, 主机: ${hostname}`);
        resolve(false);
      }
    });
  }

  async readParamsFile(): Promise<any> {
    if (!this.client) {
      const error = '尝试读取文件时SSH未连接';
      logger.error(error);
      throw new Error(error);
    }

    return new Promise((resolve, reject) => {
      logger.info('正在创建SFTP会话');
      this.client!.sftp((err, sftp) => {
        if (err) {
          logger.error(`SFTP会话创建失败: ${err.message}`);
          reject(err);
          return;
        }

        const filePath = '/usr/local/urobot/params/params.json';
        logger.info(`正在读取文件: ${filePath}`);
        const readStream = sftp.createReadStream(filePath);
        let data = '';

        readStream.on('data', (chunk: Buffer) => {
          data += chunk.toString();
          logger.debug(`读取数据块: ${chunk.length} 字节`);
        });

        readStream.on('end', () => {
          try {
            logger.info(`文件读取完成，数据长度: ${data.length} 字节`);
            const params = JSON.parse(data);
            logger.info('成功解析JSON数据');
            resolve(params);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`JSON解析错误: ${errorMessage}`);
            reject(error);
          }
        });

        readStream.on('error', (error: Error) => {
          logger.error(`文件读取错误: ${error.message}`);
          reject(error);
        });
      });
    });
  }

  async readMapFile(): Promise<any> {
    if (!this.client) {
      const error = '尝试读取地图文件时SSH未连接';
      logger.error(error);
      throw new Error(error);
    }

    return new Promise((resolve, reject) => {
      logger.info('正在创建SFTP会话用于读取地图文件');
      this.client!.sftp((err, sftp) => {
        if (err) {
          logger.error(`SFTP会话创建失败: ${err.message}`);
          reject(err);
          return;
        }

        const filePath = '/usr/local/urobot/params/map/test.json';
        logger.info(`正在读取地图文件: ${filePath}`);
        const readStream = sftp.createReadStream(filePath);
        let data = '';

        readStream.on('data', (chunk: Buffer) => {
          data += chunk.toString();
          logger.debug(`读取地图数据块: ${chunk.length} 字节`);
        });

        readStream.on('end', () => {
          try {
            logger.info(`地图文件读取完成，数据长度: ${data.length} 字节`);
            const rawMapData = JSON.parse(data);
            logger.info('成功解析地图JSON数据');
            logger.info(`原始地图数据结构: ${JSON.stringify(Object.keys(rawMapData))}`);
            
            // 处理和验证地图数据
            const processedMapData: any = {
              points: [],
              lines: [],
              objects: []
            };
            
            // 检查并处理特定格式的地图数据（根据日志发现的格式）
            if (rawMapData.ObsPoints && Array.isArray(rawMapData.ObsPoints)) {
              // 处理障碍点数据
              processedMapData.points = rawMapData.ObsPoints.map((point: any) => {
                if (Array.isArray(point) && point.length >= 2) {
                  return {
                    x: typeof point[0] === 'number' ? point[0] : parseFloat(point[0]),
                    y: typeof point[1] === 'number' ? point[1] : parseFloat(point[1])
                  };
                } else if (typeof point === 'object' && point !== null) {
                  return {
                    x: typeof point.x === 'number' ? point.x : parseFloat(point.x || '0'),
                    y: typeof point.y === 'number' ? point.y : parseFloat(point.y || '0')
                  };
                }
                return null;
              }).filter(Boolean);
            }
            
            // 处理路径线数据
            if (rawMapData.Objs && Array.isArray(rawMapData.Objs)) {
              // 提取对象
              const objectData = rawMapData.Objs;
              
              // 处理线段（可能在对象中定义）
              objectData.forEach((obj: any) => {
                // 检查是否是线段对象
                if (obj.type === 'line' || obj.type === 'Line' || obj.type === 'PATH_LINE') {
                  if (obj.start && obj.end) {
                    processedMapData.lines.push({
                      start: {
                        x: typeof obj.start.x === 'number' ? obj.start.x : parseFloat(obj.start.x || '0'),
                        y: typeof obj.start.y === 'number' ? obj.start.y : parseFloat(obj.start.y || '0')
                      },
                      end: {
                        x: typeof obj.end.x === 'number' ? obj.end.x : parseFloat(obj.end.x || '0'),
                        y: typeof obj.end.y === 'number' ? obj.end.y : parseFloat(obj.end.y || '0')
                      }
                    });
                  }
                } else {
                  // 其他类型的对象
                  const processedObj: any = { ...obj };
                  
                  // 如果对象有位置信息
                  if (obj.position || obj.pose || obj.Point || obj.point) {
                    const posInfo = obj.position || obj.pose || obj.Point || obj.point;
                    
                    if (Array.isArray(posInfo) && posInfo.length >= 2) {
                      processedObj.position = {
                        x: typeof posInfo[0] === 'number' ? posInfo[0] : parseFloat(posInfo[0]),
                        y: typeof posInfo[1] === 'number' ? posInfo[1] : parseFloat(posInfo[1])
                      };
                    } else if (typeof posInfo === 'object' && posInfo !== null) {
                      processedObj.position = {
                        x: typeof posInfo.x === 'number' ? posInfo.x : parseFloat(posInfo.x || '0'),
                        y: typeof posInfo.y === 'number' ? posInfo.y : parseFloat(posInfo.y || '0')
                      };
                    }
                    
                    processedMapData.objects.push(processedObj);
                  }
                }
              });
            }
            
            // 处理元数据
            if (rawMapData.MapRes) {
              processedMapData.resolution = typeof rawMapData.MapRes === 'number' ? 
                rawMapData.MapRes : parseFloat(rawMapData.MapRes);
            }
            
            if (rawMapData.MaxPose && rawMapData.MinPose) {
              // 计算地图尺寸
              const maxPose = rawMapData.MaxPose;
              const minPose = rawMapData.MinPose;
              
              if (Array.isArray(maxPose) && maxPose.length >= 2 && 
                  Array.isArray(minPose) && minPose.length >= 2) {
                processedMapData.width = maxPose[0] - minPose[0];
                processedMapData.height = maxPose[1] - minPose[1];
              } else if (typeof maxPose === 'object' && maxPose !== null && 
                         typeof minPose === 'object' && minPose !== null) {
                const maxX = typeof maxPose.x === 'number' ? maxPose.x : parseFloat(maxPose.x || '0');
                const maxY = typeof maxPose.y === 'number' ? maxPose.y : parseFloat(maxPose.y || '0');
                const minX = typeof minPose.x === 'number' ? minPose.x : parseFloat(minPose.x || '0');
                const minY = typeof minPose.y === 'number' ? minPose.y : parseFloat(minPose.y || '0');
                
                processedMapData.width = maxX - minX;
                processedMapData.height = maxY - minY;
              }
            }
            
            if (rawMapData.Header && rawMapData.Header.Name) {
              processedMapData.name = rawMapData.Header.Name;
            }
            
            // 如果我们仍然没有提取到点数据，尝试查找其他可能的点数据源
            if (processedMapData.points.length === 0) {
              // 尝试从NumPoints和Points字段中提取
              if (rawMapData.Points && Array.isArray(rawMapData.Points)) {
                processedMapData.points = rawMapData.Points.map((point: any) => {
                  if (Array.isArray(point) && point.length >= 2) {
                    return {
                      x: typeof point[0] === 'number' ? point[0] : parseFloat(point[0]),
                      y: typeof point[1] === 'number' ? point[1] : parseFloat(point[1])
                    };
                  } else if (typeof point === 'object' && point !== null) {
                    return {
                      x: typeof point.x === 'number' ? point.x : parseFloat(point.x || '0'),
                      y: typeof point.y === 'number' ? point.y : parseFloat(point.y || '0')
                    };
                  }
                  return null;
                }).filter(Boolean);
              }
            }
            
            logger.info(`处理后的地图数据: 点=${processedMapData.points.length}, 线=${processedMapData.lines.length}, 对象=${processedMapData.objects.length}`);
            
            // 如果依然没有提取到有效数据，则添加一些调试日志并返回原始数据
            if (processedMapData.points.length === 0 && processedMapData.lines.length === 0) {
              logger.warn('无法提取有效的地图数据，返回原始数据进行调试');
              // 转储部分原始数据作为调试信息
              if (rawMapData.ObsPoints) {
                logger.debug(`ObsPoints样本: ${JSON.stringify(rawMapData.ObsPoints.slice(0, 5))}`);
              }
              if (rawMapData.Objs) {
                logger.debug(`Objs样本: ${JSON.stringify(rawMapData.Objs.slice(0, 2))}`);
              }
              
              // 返回原始数据以供前端直接处理
              resolve(rawMapData);
            } else {
              resolve(processedMapData);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`地图JSON解析错误: ${errorMessage}`);
            reject(error);
          }
        });

        readStream.on('error', (error: Error) => {
          logger.error(`地图文件读取错误: ${error.message}`);
          reject(error);
        });
      });
    });
  }

  async readSpecificFile(filePath: string): Promise<any> {
    if (!this.client) {
      const error = '尝试读取文件时SSH未连接';
      logger.error(error);
      throw new Error(error);
    }

    return new Promise((resolve, reject) => {
      logger.info(`正在创建SFTP会话来读取指定文件: ${filePath}`);
      this.client!.sftp((err, sftp) => {
        if (err) {
          logger.error(`SFTP会话创建失败: ${err.message}`);
          reject(err);
          return;
        }

        logger.info(`正在读取文件: ${filePath}`);
        const readStream = sftp.createReadStream(filePath);
        let data = '';

        readStream.on('data', (chunk: Buffer) => {
          data += chunk.toString();
          logger.debug(`读取数据块: ${chunk.length} 字节`);
        });

        readStream.on('end', () => {
          try {
            logger.info(`文件读取完成，数据长度: ${data.length} 字节`);
            
            // 根据文件扩展名判断是否解析JSON
            if (filePath.toLowerCase().endsWith('.json')) {
              const parsedData = JSON.parse(data);
              logger.info('成功解析JSON数据');
              resolve(parsedData);
            } else {
              // 非JSON文件直接返回文本内容
              resolve(data);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`JSON解析错误: ${errorMessage}`);
            reject(error);
          }
        });

        readStream.on('error', (error: Error) => {
          logger.error(`文件读取错误: ${error.message}`);
          reject(error);
        });
      });
    });
  }

  disconnect(): void {
    if (this.client) {
      logger.info('正在断开SSH连接');
      this.client.end();
      this.client = null;
      logger.info('SSH连接已断开');
    } else {
      logger.warn('尝试断开未连接的SSH会话');
    }
  }
}