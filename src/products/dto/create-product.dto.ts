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

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase alphanumeric with hyphens only",
  })
  slug: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  @MinLength(1)
  nameRu: string;

  @IsString()
  @MinLength(1)
  nameEn: string;

  @IsString()
  @MinLength(1)
  nameUz: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionUz?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;
}
