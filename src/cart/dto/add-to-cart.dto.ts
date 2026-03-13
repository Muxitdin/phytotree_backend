import { IsUUID, IsInt, Min, IsOptional } from "class-validator";

export class AddToCartDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number = 1;
}
