import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import * as crypto from "crypto";

export interface AuthSession {
  status: "pending" | "confirmed";
  telegramUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  phoneNumber: string | null;
}

export interface RefreshSession {
  userId: string;
  createdAt: number;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly AUTH_SESSION_TTL = 300; // 5 minutes in seconds
  private readonly REFRESH_SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis(this.configService.get<string>("REDIS_URL")!);
  }

  /**
   * Hash a refresh token using SHA256
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private getRefreshKey(hashedToken: string): string {
    return `refresh:${hashedToken}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `user:sessions:${userId}`;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private getAuthKey(authToken: string): string {
    return `auth:${authToken}`;
  }

  async createAuthSession(authToken: string): Promise<void> {
    const session: AuthSession = {
      status: "pending",
      telegramUserId: null,
      firstName: null,
      lastName: null,
      username: null,
      photoUrl: null,
      phoneNumber: null,
    };

    await this.client.setex(
      this.getAuthKey(authToken),
      this.AUTH_SESSION_TTL,
      JSON.stringify(session),
    );
  }

  async getAuthSession(authToken: string): Promise<AuthSession | null> {
    const data = await this.client.get(this.getAuthKey(authToken));
    if (!data) {
      return null;
    }
    return JSON.parse(data) as AuthSession;
  }

  async updateAuthSession(
    authToken: string,
    updates: Partial<AuthSession>,
  ): Promise<boolean> {
    const session = await this.getAuthSession(authToken);
    if (!session) {
      return false;
    }

    const ttl = await this.client.ttl(this.getAuthKey(authToken));
    if (ttl <= 0) {
      return false;
    }

    const updatedSession: AuthSession = { ...session, ...updates };
    await this.client.setex(
      this.getAuthKey(authToken),
      ttl,
      JSON.stringify(updatedSession),
    );

    return true;
  }

  async deleteAuthSession(authToken: string): Promise<void> {
    await this.client.del(this.getAuthKey(authToken));
  }

  async authSessionExists(authToken: string): Promise<boolean> {
    const exists = await this.client.exists(this.getAuthKey(authToken));
    return exists === 1;
  }

  async getAuthSessionTTL(authToken: string): Promise<number> {
    return await this.client.ttl(this.getAuthKey(authToken));
  }

  // ==================== Refresh Token Sessions ====================

  /**
   * Store a refresh token session
   * @param refreshToken - The raw refresh token (will be hashed)
   * @param session - Session data
   */
  async createRefreshSession(
    refreshToken: string,
    session: RefreshSession,
  ): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    const key = this.getRefreshKey(hashedToken);
    const userSessionsKey = this.getUserSessionsKey(session.userId);

    // Store session data
    await this.client.setex(
      key,
      this.REFRESH_SESSION_TTL,
      JSON.stringify(session),
    );

    // Add to user's session set (for "logout all devices")
    await this.client.sadd(userSessionsKey, hashedToken);
    // Set TTL on user sessions set (refresh it)
    await this.client.expire(userSessionsKey, this.REFRESH_SESSION_TTL);
  }

  /**
   * Validate and get refresh session
   * @param refreshToken - The raw refresh token
   * @returns Session data or null if invalid
   */
  async getRefreshSession(
    refreshToken: string,
  ): Promise<RefreshSession | null> {
    const hashedToken = this.hashToken(refreshToken);
    const key = this.getRefreshKey(hashedToken);

    const data = await this.client.get(key);
    if (!data) {
      return null;
    }

    return JSON.parse(data) as RefreshSession;
  }

  /**
   * Invalidate a refresh token (used during rotation and logout)
   * @param refreshToken - The raw refresh token
   * @param userId - User ID to remove from user sessions set
   */
  async invalidateRefreshToken(
    refreshToken: string,
    userId: string,
  ): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    const key = this.getRefreshKey(hashedToken);
    const userSessionsKey = this.getUserSessionsKey(userId);

    await this.client.del(key);
    await this.client.srem(userSessionsKey, hashedToken);
  }

  /**
   * Invalidate all refresh tokens for a user (logout all devices)
   * @param userId - User ID
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    const userSessionsKey = this.getUserSessionsKey(userId);

    // Get all session hashes for this user
    const sessionHashes = await this.client.smembers(userSessionsKey);

    if (sessionHashes.length === 0) {
      return 0;
    }

    // Delete all session keys
    const keys = sessionHashes.map((hash) => this.getRefreshKey(hash));
    await this.client.del(...keys);

    // Delete the user sessions set
    await this.client.del(userSessionsKey);

    return sessionHashes.length;
  }

  /**
   * Get count of active sessions for a user
   */
  async getUserSessionCount(userId: string): Promise<number> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    return await this.client.scard(userSessionsKey);
  }
}
