import { IsNumber, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class ClickPrepareDto {
  @Transform(({ value }) => String(value))
  @IsString()
  click_trans_id: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  service_id: number;

  @Transform(({ value }) => String(value))
  @IsString()
  click_paydoc_id: string;

  @IsString()
  merchant_trans_id: string; // orderId

  @Transform(({ value }) => Number(value))
  @IsNumber()
  amount: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  action: number; // 0 for prepare

  @Transform(({ value }) => Number(value))
  @IsNumber()
  error: number;

  @IsString()
  error_note: string;

  @IsString()
  sign_time: string;

  @IsString()
  sign_string: string;
}
