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
import { CategoriesService, PaginatedResult } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto";
import { ProductCategory } from "../generated/prisma/client";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../generated/prisma/enums";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Create a new category (Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCategoryDto): Promise<ProductCategory> {
    return this.categoriesService.create(dto);
  }

  /**
   * Get all categories with cursor-based pagination (Public)
   */
  @Get()
  async findAll(
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: number,
  ): Promise<PaginatedResult<ProductCategory>> {
    return this.categoriesService.findAll({ cursor, limit });
  }

  /**
   * Get a single category by ID or slug (Public)
   */
  @Get(":idOrSlug")
  async findOne(@Param("idOrSlug") idOrSlug: string): Promise<ProductCategory> {
    return this.categoriesService.findOne(idOrSlug);
  }

  /**
   * Update a category (Admin only)
   */
  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<ProductCategory> {
    return this.categoriesService.update(id, dto);
  }

  /**
   * Delete a category (Admin only)
   */
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
