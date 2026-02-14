import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class AuthConfirmDto {
  @IsString()
  @IsNotEmpty()
  authToken: string;

  @IsString()
  @IsNotEmpty()
  telegramUserId: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
