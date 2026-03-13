import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { AddToCartDto, UpdateCartItemDto } from "./dto";

const cartItemInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      nameRu: true,
      nameEn: true,
      nameUz: true,
      price: true,
      images: true,
      inStock: true,
      category: {
        select: {
          id: true,
          slug: true,
          nameRu: true,
          nameEn: true,
          nameUz: true,
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithProduct = Prisma.CartItemGetPayload<{
  include: typeof cartItemInclude;
}>;

export interface CartResponse {
  items: CartItemWithProduct[];
  totalItems: number;
  totalPrice: string;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string): Promise<CartResponse> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: "desc" },
    });

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items
      .reduce((sum, item) => {
        const price = Number(item.product.price);
        return sum + price * item.quantity;
      }, 0)
      .toFixed(2);

    return {
      items,
      totalItems,
      totalPrice,
    };
  }

  async addToCart(
    userId: string,
    dto: AddToCartDto,
  ): Promise<CartItemWithProduct> {
    // Check if product exists and is in stock
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID "${dto.productId}" not found`,
      );
    }

    if (!product.inStock) {
      throw new BadRequestException("Product is out of stock");
    }

    // Upsert cart item (add or update quantity)
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: dto.productId,
        },
      },
    });

    if (existingItem) {
      // Update quantity
      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + (dto.quantity ?? 1) },
        include: cartItemInclude,
      });
    }

    // Create new cart item
    return this.prisma.cartItem.create({
      data: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity ?? 1,
      },
      include: cartItemInclude,
    });
  }

  async updateCartItem(
    userId: string,
    productId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartItemWithProduct> {
    const cartItem = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException("Cart item not found");
    }

    return this.prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity: dto.quantity },
      include: cartItemInclude,
    });
  }

  async removeFromCart(userId: string, productId: string): Promise<void> {
    const cartItem = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException("Cart item not found");
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItem.id },
    });
  }

  async clearCart(userId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: { userId },
    });
  }

  async getCartItemCount(userId: string): Promise<number> {
    const result = await this.prisma.cartItem.aggregate({
      where: { userId },
      _sum: { quantity: true },
    });

    return result._sum.quantity ?? 0;
  }
}
