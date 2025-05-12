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