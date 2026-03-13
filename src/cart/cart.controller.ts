import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { CartService, CartResponse } from "./cart.service";
import { AddToCartDto, UpdateCartItemDto } from "./dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../generated/prisma/client";

@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Get current user's cart
   */
  @Get()
  async getCart(@CurrentUser() user: User): Promise<CartResponse> {
    return this.cartService.getCart(user.id);
  }

  /**
   * Get cart item count
   */
  @Get("count")
  async getCartCount(@CurrentUser() user: User): Promise<{ count: number }> {
    const count = await this.cartService.getCartItemCount(user.id);
    return { count };
  }

  /**
   * Add item to cart
   */
  @Post("items")
  @HttpCode(HttpStatus.CREATED)
  async addToCart(@CurrentUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(user.id, dto);
  }

  /**
   * Update cart item quantity
   */
  @Patch("items/:productId")
  async updateCartItem(
    @CurrentUser() user: User,
    @Param("productId") productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(user.id, productId, dto);
  }

  /**
   * Remove item from cart
   */
  @Delete("items/:productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFromCart(
    @CurrentUser() user: User,
    @Param("productId") productId: string,
  ): Promise<void> {
    return this.cartService.removeFromCart(user.id, productId);
  }

  /**
   * Clear entire cart
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCart(@CurrentUser() user: User): Promise<void> {
    return this.cartService.clearCart(user.id);
  }
}
