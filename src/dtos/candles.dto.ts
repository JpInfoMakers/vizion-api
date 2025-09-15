export class GetCandlesQuery {
  activeId!: number;
  size!: number;
  from?: number;
  to?: number;
  count?: number;
  backoff?: number;
  onlyClosed?: boolean;
  kind?: string;
  fromId?: number;
  toId?: number;
  splitNormalization?: boolean;
}
