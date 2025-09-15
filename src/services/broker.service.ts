import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

export interface BrokerRegisterData {
  identifier: string;
  password: string;
  accepted: string[];
  country_id: number;
  first_name: string;
  timezone: string;
}

export interface BrokerLoginData {
  identifier: string;
  password: string;
}

@Injectable()
export class BrokerService {
  private readonly logger = new Logger(BrokerService.name);
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY_MS = 2000;

  async register(data: BrokerRegisterData) {
    const affiliateCode = '791568';
    try {
      const res = await axios.post(process.env.BROKER_REGISTER_URL!, data, {
        headers: {
          'Content-Type': 'application/json',
          ...(affiliateCode ? { Cookie: `aff=${affiliateCode}; aff_model=revenue; afftrack=` } : {}),
        },
        timeout: 10000,
      });
      return res.data;
    } catch (e) {
      const err = e as AxiosError;
      this.logger.error('Broker register failed', err.response?.data || err.message);
      return err.response?.data || { code: 'error', message: 'register failed' };
    }
  }

  async login(data: BrokerLoginData): Promise<{ code: string; ssid?: string; user_id?: number; message?: string }> {
    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        const res = await axios.post(process.env.BROKER_LOGIN_URL!, data, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        });
        return res.data;
      } catch (e) {
        attempt++;
        const err = e as AxiosError;
        const isTemporary = !err.response || err.response.status >= 500;
        if (attempt < this.MAX_RETRIES && isTemporary) {
          await new Promise(r => setTimeout(r, this.RETRY_DELAY_MS));
        } else {
          this.logger.error('Broker login failed', err.message);
          return { code: 'error', message: err.message || 'login failed' };
        }
      }
    }
    return { code: 'error', message: 'Max retries reached' };
  }
}
