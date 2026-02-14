import { IsString, IsNotEmpty } from "class-validator";

export class AuthFinalizeDto {
  @IsString()
  @IsNotEmpty()
  authToken: string;
}

export class AuthFinalizeResponseDto {
  accessToken: string;
  expiresIn: number; // seconds
  user: {
    id: string;
    telegramUserId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    role: string;
  };
}
