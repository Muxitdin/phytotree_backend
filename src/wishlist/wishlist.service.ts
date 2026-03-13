import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "../generated/prisma/client";

const wishlistItemInclude = {
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
} satisfies Prisma.WishlistItemInclude;

type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{
  include: typeof wishlistItemInclude;
}>;

export interface WishlistResponse {
  items: WishlistItemWithProduct[];
  totalItems: number;
}

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string): Promise<WishlistResponse> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: wishlistItemInclude,
      orderBy: { createdAt: "desc" },
    });

    return {
      items,
      totalItems: items.length,
    };
  }

  async addToWishlist(
    userId: string,
    productId: string,
  ): Promise<WishlistItemWithProduct> {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    // Check if already in wishlist
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException("Product is already in wishlist");
    }

    return this.prisma.wishlistItem.create({
      data: {
        userId,
        productId,
      },
      include: wishlistItemInclude,
    });
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const wishlistItem = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException("Wishlist item not found");
    }

    await this.prisma.wishlistItem.delete({
      where: { id: wishlistItem.id },
    });
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    return !!item;
  }

  async clearWishlist(userId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({
      where: { userId },
    });
  }

  async getWishlistCount(userId: string): Promise<number> {
    return this.prisma.wishlistItem.count({
      where: { userId },
    });
  }
}
