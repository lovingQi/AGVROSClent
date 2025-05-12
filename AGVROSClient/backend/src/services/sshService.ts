import { Client } from 'ssh2';
import { promisify } from 'util';

export class SSHService {
  private client: Client | null = null;
  private readonly username = 'ucore';
  private readonly password = '133233';

  async connect(hostname: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.client = new Client();
        
        this.client.on('ready', () => {
          resolve(true);
        });

        this.client.on('error', (err) => {
          console.error('SSH连接错误:', err);
          resolve(false);
        });

        this.client.connect({
          host: hostname,
          username: this.username,
          password: this.password
        });
      } catch (error) {
        console.error('SSH连接错误:', error);
        resolve(false);
      }
    });
  }

  async readParamsFile(): Promise<any> {
    if (!this.client) {
      throw new Error('SSH未连接');
    }

    return new Promise((resolve, reject) => {
      this.client!.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        const readStream = sftp.createReadStream('/usr/local/urobot/params/params.json');
        let data = '';

        readStream.on('data', (chunk) => {
          data += chunk;
        });

        readStream.on('end', () => {
          try {
            const params = JSON.parse(data);
            resolve(params);
          } catch (error) {
            reject(error);
          }
        });

        readStream.on('error', (error) => {
          reject(error);
        });
      });
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
} 