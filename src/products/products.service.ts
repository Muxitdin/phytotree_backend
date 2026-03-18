import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Product } from "../generated/prisma/client";
import { CreateProductDto, UpdateProductDto } from "./dto";

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ProductsQueryParams {
  cursor?: string;
  limit?: number;
  categoryId?: string;
  categorySlug?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

type ProductWithCategory = Product & {
  category: {
    id: string;
    slug: string;
    nameRu: string;
    nameEn: string;
    nameUz: string;
  };
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto): Promise<ProductWithCategory> {
    // Check if slug already exists
    const existingSlug = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException(
        `Product with slug "${dto.slug}" already exists`,
      );
    }

    // Check if category exists
    const category = await this.prisma.productCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new BadRequestException(
        `Category with ID "${dto.categoryId}" not found`,
      );
    }

    return this.prisma.product.create({
      data: {
        slug: dto.slug,
        categoryId: dto.categoryId,
        nameRu: dto.nameRu,
        nameEn: dto.nameEn,
        nameUz: dto.nameUz,
        descriptionRu: dto.descriptionRu,
        descriptionEn: dto.descriptionEn,
        descriptionUz: dto.descriptionUz,
        price: new Prisma.Decimal(dto.price),
        images: dto.images ?? [],
        inStock: dto.inStock ?? true,
        quantity: dto.inStock ? dto.quantity : 0,
      },
      include: {
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
    });
  }

  async findAll(
    params: ProductsQueryParams,
  ): Promise<PaginatedResult<ProductWithCategory>> {
    const limit = Math.min(params.limit ?? 20, 100);

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }

    if (params.categorySlug) {
      where.category = { slug: params.categorySlug };
    }

    if (params.inStock !== undefined) {
      where.inStock = params.inStock;
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.price = {};
      if (params.minPrice !== undefined) {
        where.price.gte = new Prisma.Decimal(params.minPrice);
      }
      if (params.maxPrice !== undefined) {
        where.price.lte = new Prisma.Decimal(params.maxPrice);
      }
    }

    if (params.search) {
      where.OR = [
        { nameRu: { contains: params.search, mode: "insensitive" } },
        { nameEn: { contains: params.search, mode: "insensitive" } },
        { nameUz: { contains: params.search, mode: "insensitive" } },
        { descriptionRu: { contains: params.search, mode: "insensitive" } },
        { descriptionEn: { contains: params.search, mode: "insensitive" } },
        { descriptionUz: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      take: limit + 1,
      ...(params.cursor && {
        cursor: { id: params.cursor },
        skip: 1,
      }),
      orderBy: { createdAt: "desc" },
      include: {
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
    });

    const hasMore = products.length > limit;
    const data = hasMore ? products.slice(0, -1) : products;
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  async findOne(idOrSlug: string): Promise<ProductWithCategory> {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
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
    });

    if (!product) {
      throw new NotFoundException(`Product "${idOrSlug}" not found`);
    }

    return product;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductWithCategory> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    // Check if new slug conflicts
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
      });

      if (slugExists) {
        throw new ConflictException(
          `Product with slug "${dto.slug}" already exists`,
        );
      }
    }

    // Check if new category exists
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new BadRequestException(
          `Category with ID "${dto.categoryId}" not found`,
        );
      }
    }

    const updateData: Prisma.ProductUpdateInput = {};

    if (dto.slug) updateData.slug = dto.slug;
    if (dto.categoryId)
      updateData.category = { connect: { id: dto.categoryId } };
    if (dto.nameRu) updateData.nameRu = dto.nameRu;
    if (dto.nameEn) updateData.nameEn = dto.nameEn;
    if (dto.nameUz) updateData.nameUz = dto.nameUz;
    if (dto.descriptionRu !== undefined)
      updateData.descriptionRu = dto.descriptionRu;
    if (dto.descriptionEn !== undefined)
      updateData.descriptionEn = dto.descriptionEn;
    if (dto.descriptionUz !== undefined)
      updateData.descriptionUz = dto.descriptionUz;
    if (dto.price !== undefined)
      updateData.price = new Prisma.Decimal(dto.price);
    if (dto.images !== undefined) updateData.images = dto.images;
    if (dto.inStock !== undefined) updateData.inStock = dto.inStock;
    if (dto.quantity !== undefined) updateData.quantity = dto.quantity;

    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
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
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    await this.prisma.product.delete({
      where: { id },
    });
  }
}
