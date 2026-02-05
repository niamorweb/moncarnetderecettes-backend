import {
  IsString,
  IsNumber,
  IsObject,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  line1: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateOrderDto {
  @IsNumber()
  @Min(1)
  amountTotal: number;

  @IsString()
  @IsOptional()
  currency: string = 'eur';

  @IsNumber()
  @IsOptional()
  @Min(1)
  quantity: number = 1;

  @IsObject()
  @IsNotEmpty()
  printOptions: Record<string, any>;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}
