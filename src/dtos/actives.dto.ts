export type ActiveKind = 'blitz' | 'turbo' | 'binary' | 'digital' | 'margin-forex' | 'margin-cfd' | 'margin-crypto';

export class ActiveSummaryDto {
  id!: number;
  ticker!: string;
  isSuspended!: boolean;
  expirationTimes?: number[];
  profitCommissionPercent?: number;
  schedule?: { from: string; to: string }[];
}

export class ListActivesQuery {
  kind!: ActiveKind; // blitz|turbo|binary|digital|margin-forex|margin-cfd|margin-crypto
  at?: string;       // ISO; optional
}
