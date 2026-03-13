import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { WishlistService, WishlistResponse } from "./wishlist.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../generated/prisma/client";

@Controller("wishlist")
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  /**
   * Get current user's wishlist
   */
  @Get()
  async getWishlist(@CurrentUser() user: User): Promise<WishlistResponse> {
    return this.wishlistService.getWishlist(user.id);
  }

  /**
   * Get wishlist item count
   */
  @Get("count")
  async getWishlistCount(
    @CurrentUser() user: User,
  ): Promise<{ count: number }> {
    const count = await this.wishlistService.getWishlistCount(user.id);
    return { count };
  }

  /**
   * Check if product is in wishlist
   */
  @Get("check/:productId")
  async checkInWishlist(
    @CurrentUser() user: User,
    @Param("productId") productId: string,
  ): Promise<{ inWishlist: boolean }> {
    const inWishlist = await this.wishlistService.isInWishlist(
      user.id,
      productId,
    );
    return { inWishlist };
  }

  /**
   * Add product to wishlist
   */
  @Post(":productId")
  @HttpCode(HttpStatus.CREATED)
  async addToWishlist(
    @CurrentUser() user: User,
    @Param("productId") productId: string,
  ) {
    return this.wishlistService.addToWishlist(user.id, productId);
  }

  /**
   * Remove product from wishlist
   */
  @Delete(":productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromWishlist(
    @CurrentUser() user: User,
    @Param("productId") productId: string,
  ): Promise<void> {
    return this.wishlistService.removeFromWishlist(user.id, productId);
  }

  /**
   * Clear entire wishlist
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearWishlist(@CurrentUser() user: User): Promise<void> {
    return this.wishlistService.clearWishlist(user.id);
  }
}
