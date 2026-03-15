import { IsOptional, IsString, IsEnum } from "class-validator";
import { OrderStatus } from "../../generated/prisma/enums";

export class OrderQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
