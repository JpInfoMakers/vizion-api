import { ClientSdk, LoginPasswordAuthMethod, SsidAuthMethod } from '@tradecodehub/client-sdk-js';
import { TRADE_SDK } from './trade.constants';
import { tradeEnv } from '../config/trade.config';

export const tradeProviders = [
  {
    provide: TRADE_SDK,
    useFactory: async () => {
      const env = tradeEnv();
      const sdk = await ClientSdk.create(
        env.WS_URL,
        env.APP_ID,
        new SsidAuthMethod("ad90cf8fd840d14fa478c926b34914da")
      );
      console.log('✅ Trade SDK conectado');
      return sdk;
    },
  },
];
