import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { RedisService } from "../redis/redis.service";
import { UsersService } from "../users/users.service";
import { User } from "../generated/prisma/client";
import {
  AuthInitResponseDto,
  AuthConfirmDto,
  AuthFinalizeResponseDto,
} from "./dto";

export interface JwtPayload {
  sub: string; // user id
  telegramUserId: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenContext {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly AUTH_TOKEN_BYTES = 32; // 256 bits
  private readonly AUTH_SESSION_TTL = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Generate cryptographically secure auth token
   */
  private generateAuthToken(): string {
    return crypto.randomBytes(this.AUTH_TOKEN_BYTES).toString("hex");
  }

  /**
   * Initialize auth session and return deep link
   */
  async initAuth(): Promise<AuthInitResponseDto> {
    const authToken = this.generateAuthToken();
    const botUsername = this.configService.get<string>("TELEGRAM_BOT_USERNAME");

    await this.redisService.createAuthSession(authToken);

    const deepLink = `https://t.me/${botUsername}?start=${authToken}`;

    return {
      authToken,
      deepLink,
      expiresIn: this.AUTH_SESSION_TTL,
    };
  }

  /**
   * Confirm auth session (called by Telegram bot)
   */
  async confirmAuth(dto: AuthConfirmDto): Promise<{ success: boolean }> {
    const session = await this.redisService.getAuthSession(dto.authToken);

    if (!session) {
      throw new BadRequestException("Auth session not found or expired");
    }

    if (session.status !== "pending") {
      throw new BadRequestException("Auth session already processed");
    }

    const updated = await this.redisService.updateAuthSession(dto.authToken, {
      status: "confirmed",
      telegramUserId: dto.telegramUserId,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      username: dto.username ?? null,
      photoUrl: dto.photoUrl ?? null,
      phoneNumber: dto.phoneNumber ?? null,
    });

    if (!updated) {
      throw new BadRequestException("Failed to update auth session");
    }

    return { success: true };
  }

  /**
   * Finalize auth and issue JWT tokens
   */
  async finalizeAuth(
    authToken: string,
    context?: TokenContext,
  ): Promise<{ response: AuthFinalizeResponseDto; refreshToken: string }> {
    const session = await this.redisService.getAuthSession(authToken);

    if (!session) {
      throw new UnauthorizedException("Auth session not found or expired");
    }

    if (session.status !== "confirmed") {
      throw new BadRequestException("Auth session not confirmed yet");
    }

    if (!session.telegramUserId) {
      throw new BadRequestException("Telegram user ID not found in session");
    }

    // Find or create user
    const telegramUserId = BigInt(session.telegramUserId);
    const { user } = await this.usersService.findOrCreateByTelegram(
      telegramUserId,
      {
        firstName: session.firstName,
        lastName: session.lastName,
        username: session.username,
        photoUrl: session.photoUrl,
        phoneNumber: session.phoneNumber,
      },
    );

    // Delete one-time session
    await this.redisService.deleteAuthSession(authToken);

    // Generate tokens
    const tokens = await this.generateTokens(user, context);

    const response: AuthFinalizeResponseDto = {
      accessToken: tokens.accessToken,
      expiresIn: this.getAccessTokenExpiresInSeconds(),
      user: {
        id: user.id,
        telegramUserId: user.telegramUserId.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.photoUrl,
        role: user.role,
      },
    };

    return { response, refreshToken: tokens.refreshToken };
  }

  /**
   * Refresh access token with rotation
   */
  async refreshTokens(
    refreshToken: string,
    context?: TokenContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Validate refresh token in Redis
    const session = await this.redisService.getRefreshSession(refreshToken);

    if (!session) {
      // Token not found - possibly already used (replay attack) or expired
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // Get user
    const user = await this.usersService.findById(session.userId);
    if (!user) {
      // User deleted - invalidate the token
      await this.redisService.invalidateRefreshToken(
        refreshToken,
        session.userId,
      );
      throw new UnauthorizedException("User not found");
    }

    // Invalidate old refresh token (rotation)
    await this.redisService.invalidateRefreshToken(
      refreshToken,
      session.userId,
    );

    // Generate new token pair
    return this.generateTokens(user, context);
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    const session = await this.redisService.getRefreshSession(refreshToken);
    if (session) {
      await this.redisService.invalidateRefreshToken(
        refreshToken,
        session.userId,
      );
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(userId: string): Promise<number> {
    return this.redisService.invalidateAllUserSessions(userId);
  }

  /**
   * Generate a secure random refresh token
   */
  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
    context?: TokenContext,
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      telegramUserId: user.telegramUserId.toString(),
      role: user.role,
    };

    const accessExpiresIn = this.getAccessTokenExpiresInSeconds();

    // Generate access token (JWT)
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessExpiresIn,
    });

    // Generate opaque refresh token (not JWT - just random bytes)
    const refreshToken = this.generateRefreshToken();

    // Store refresh session in Redis
    await this.redisService.createRefreshSession(refreshToken, {
      userId: user.id,
      createdAt: Date.now(),
      userAgent: context?.userAgent,
      ip: context?.ip,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Parse expires in string to seconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 604800; // default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        return 604800;
    }
  }

  /**
   * Verify access token and return payload
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  /**
   * Get access token expiration time in seconds
   */
  private getAccessTokenExpiresInSeconds(): number {
    const expiresIn = this.configService.get<string>("JWT_ACCESS_EXPIRES_IN");
    // Parse "15m" format
    const match = expiresIn?.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        return 900;
    }
  }

  /**
   * Verify bot internal secret for bot-to-backend communication
   */
  verifyBotSecret(providedSecret: string): boolean {
    const botSecret = this.configService.get<string>("BOT_INTERNAL_SECRET");
    return providedSecret === botSecret;
  }
}
