import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ProductsService, PaginatedResult } from "./products.service";
import { CreateProductDto, UpdateProductDto } from "./dto";
import { Product } from "../generated/prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../generated/prisma/enums";

type ProductWithCategory = Product & {
  category: {
    id: string;
    slug: string;
    nameRu: string;
    nameEn: string;
    nameUz: string;
  };
};

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Create a new product (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto): Promise<ProductWithCategory> {
    return this.productsService.create(dto);
  }

  /**
   * Get all products with cursor-based pagination and filters (Public)
   */
  @Get()
  async findAll(
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: number,
    @Query("categoryId") categoryId?: string,
    @Query("categorySlug") categorySlug?: string,
    @Query("inStock") inStock?: boolean,
    @Query("minPrice") minPrice?: number,
    @Query("maxPrice") maxPrice?: number,
    @Query("search") search?: string,
  ): Promise<PaginatedResult<ProductWithCategory>> {
    return this.productsService.findAll({
      cursor,
      limit,
      categoryId,
      categorySlug,
      inStock,
      minPrice,
      maxPrice,
      search,
    });
  }

  /**
   * Get a single product by ID or slug (Public)
   */
  @Get(":idOrSlug")
  async findOne(
    @Param("idOrSlug") idOrSlug: string,
  ): Promise<ProductWithCategory> {
    return this.productsService.findOne(idOrSlug);
  }

  /**
   * Update a product (Admin only)
   */
  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductWithCategory> {
    return this.productsService.update(id, dto);
  }

  /**
   * Delete a product (Admin only)
   */
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
