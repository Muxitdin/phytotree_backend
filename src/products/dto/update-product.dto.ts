import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUrl,
  MinLength,
  Matches,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase alphanumeric with hyphens only",
  })
  slug?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameRu?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nameUz?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string | null;

  @IsOptional()
  @IsString()
  descriptionEn?: string | null;

  @IsOptional()
  @IsString()
  descriptionUz?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;
}
