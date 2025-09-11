import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateUserDto {
  
  @IsOptional() @IsString()
  firstName?: string;

  @IsOptional() @IsString()
  lastName?: string;

  @IsOptional() @IsString() @IsIn(['pt-BR', 'en-US'])
  language?: string;

  @IsOptional() @IsString() @IsIn(['BRL', 'USD'])
  baseCurrency?: string;

}
