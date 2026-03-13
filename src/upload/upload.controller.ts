import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { UploadService, UploadSignature, UploadFolder } from "./upload.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../generated/prisma/enums";

const VALID_FOLDERS: UploadFolder[] = ["products", "categories", "users"];

@Controller("upload")
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Get upload signature for single image (Admin only for products/categories)
   */
  @Get("signature")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getSignature(
    @Query("folder") folder: UploadFolder,
  ): UploadSignature {
    if (!folder || !VALID_FOLDERS.includes(folder)) {
      throw new BadRequestException(
        `Invalid folder. Must be one of: ${VALID_FOLDERS.join(", ")}`,
      );
    }

    return this.uploadService.generateSignature(folder);
  }

  /**
   * Get multiple upload signatures (Admin only)
   */
  @Get("signatures")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getMultipleSignatures(
    @Query("folder") folder: UploadFolder,
    @Query("count") count: number = 1,
  ): UploadSignature[] {
    if (!folder || !VALID_FOLDERS.includes(folder)) {
      throw new BadRequestException(
        `Invalid folder. Must be one of: ${VALID_FOLDERS.join(", ")}`,
      );
    }

    return this.uploadService.generateMultipleSignature(folder, count);
  }
}
