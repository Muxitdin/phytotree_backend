import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
  Headers,
} from "@nestjs/common";
import { Response, Request } from "express";
import { AuthService } from "./auth.service";
import {
  AuthConfirmDto,
  AuthFinalizeDto,
  AuthInitResponseDto,
  AuthFinalizeResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { User } from "../generated/prisma/client";

interface UserMeResponse {
  id: string;
  telegramUserId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  role: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Initialize Telegram login flow
   * Returns auth token and Telegram deep link
   */
  @Post("init")
  @HttpCode(HttpStatus.OK)
  async initAuth(): Promise<AuthInitResponseDto> {
    return this.authService.initAuth();
  }

  /**
   * Confirm auth session (called by Telegram bot)
   * Requires BOT_INTERNAL_SECRET in Authorization header
   */
  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  async confirmAuth(
    @Headers("authorization") authHeader: string,
    @Body() dto: AuthConfirmDto,
  ): Promise<{ success: boolean }> {
    // Verify bot internal secret
    const token = authHeader?.replace("Bearer ", "");
    if (!token || !this.authService.verifyBotSecret(token)) {
      throw new UnauthorizedException("Invalid bot secret");
    }

    return this.authService.confirmAuth(dto);
  }

  /**
   * Finalize auth and get JWT tokens
   * Sets refresh token in httpOnly cookie
   */
  @Post("finalize")
  @HttpCode(HttpStatus.OK)
  async finalizeAuth(
    @Body() dto: AuthFinalizeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthFinalizeResponseDto> {
    const context = {
      userAgent: req.headers["user-agent"],
      ip: req.ip || req.socket.remoteAddress,
    };

    const { response, refreshToken } = await this.authService.finalizeAuth(
      dto.authToken,
      context,
    );

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/auth",
    });

    return response;
  }

  /**
   * Refresh access token using refresh token from cookie
   */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // Parse refresh token from cookie
    const cookies = this.parseCookies(req.headers.cookie || "");
    const refreshToken = cookies["refreshToken"];

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    const context = {
      userAgent: req.headers["user-agent"],
      ip: req.ip || req.socket.remoteAddress,
    };

    const tokens = await this.authService.refreshTokens(refreshToken, context);

    // Rotate refresh token
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/auth",
    });

    return {
      accessToken: tokens.accessToken,
      expiresIn: 900, // 15 minutes
    };
  }

  /**
   * Logout - invalidate refresh token and clear cookie
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    // Parse and invalidate refresh token in Redis
    const cookies = this.parseCookies(req.headers.cookie || "");
    const refreshToken = cookies["refreshToken"];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
    });

    return { success: true };
  }

  /**
   * Logout from all devices - invalidate all refresh tokens
   */
  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean; sessionsInvalidated: number }> {
    const user = req.user as User;
    const sessionsInvalidated = await this.authService.logoutAllDevices(
      user.id,
    );

    // Clear current cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
    });

    return { success: true, sessionsInvalidated };
  }

  /**
   * Get current user (protected route)
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request): UserMeResponse {
    const user = req.user as User;
    return {
      id: user.id,
      telegramUserId: user.telegramUserId.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      role: user.role,
    };
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(";").forEach((cookie) => {
      const [name, ...rest] = cookie.split("=");
      if (name && rest.length > 0) {
        cookies[name.trim()] = rest.join("=").trim();
      }
    });

    return cookies;
  }
}
