import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class BuyDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsEnum(['call', 'put'])
  direction!: 'call' | 'put';

  @IsOptional()
  @IsNumber()
  fromBalanceId?: number;
}
