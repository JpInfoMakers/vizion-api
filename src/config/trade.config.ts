export const tradeEnv = () => ({
  WS_URL: process.env.TRADE_WS_URL,
  API_URL: process.env.TRADE_API_URL,
  APP_ID: Number(process.env.TRADE_APP_ID),
  LOGIN: process.env.TRADE_LOGIN,
  PASSWORD: process.env.TRADE_PASSWORD,
});
