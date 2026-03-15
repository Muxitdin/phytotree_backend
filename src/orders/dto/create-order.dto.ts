import {
  IsString,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from "class-validator";

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName: string;

  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: "Phone number must be in format +998XXXXXXXXX",
  })
  customerPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shippingNote?: string;
}
