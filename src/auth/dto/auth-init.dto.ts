export class AuthInitResponseDto {
  authToken: string;
  deepLink: string;
  expiresIn: number; // seconds
}
