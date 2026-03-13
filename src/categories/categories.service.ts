import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProductCategory, Prisma } from "../generated/prisma/client";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto";

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CategoriesQueryParams {
  cursor?: string;
  limit?: number;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<ProductCategory> {
    // Check if slug already exists
    const existing = await this.prisma.productCategory.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(
        `Category with slug "${dto.slug}" already exists`,
      );
    }

    return this.prisma.productCategory.create({
      data: {
        slug: dto.slug,
        nameRu: dto.nameRu,
        nameEn: dto.nameEn,
        nameUz: dto.nameUz,
        imageUrl: dto.imageUrl,
      },
    });
  }

  async findAll(
    params: CategoriesQueryParams,
  ): Promise<PaginatedResult<ProductCategory>> {
    const limit = Math.min(params.limit ?? 20, 100);

    const categories = await this.prisma.productCategory.findMany({
      take: limit + 1, // Fetch one extra to check if there are more
      ...(params.cursor && {
        cursor: { id: params.cursor },
        skip: 1, // Skip the cursor itself
      }),
      orderBy: { createdAt: "desc" },
    });

    const hasMore = categories.length > limit;
    const data = hasMore ? categories.slice(0, -1) : categories;
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  async findOne(idOrSlug: string): Promise<ProductCategory> {
    // Try to find by ID first, then by slug
    const category = await this.prisma.productCategory.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category "${idOrSlug}" not found`);
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<ProductCategory> {
    // Check if category exists
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    // Check if new slug conflicts with another category
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.productCategory.findUnique({
        where: { slug: dto.slug },
      });

      if (slugExists) {
        throw new ConflictException(
          `Category with slug "${dto.slug}" already exists`,
        );
      }
    }

    const updateData: Prisma.ProductCategoryUpdateInput = {};

    if (dto.slug) updateData.slug = dto.slug;
    if (dto.nameRu) updateData.nameRu = dto.nameRu;
    if (dto.nameEn) updateData.nameEn = dto.nameEn;
    if (dto.nameUz) updateData.nameUz = dto.nameUz;
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;

    return this.prisma.productCategory.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    // Warn if category has products (they will be cascade deleted)
    if (existing._count.products > 0) {
      // Products will be cascade deleted due to onDelete: Cascade in schema
    }

    await this.prisma.productCategory.delete({
      where: { id },
    });
  }
}
