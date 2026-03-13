import {
  IsString,
  IsOptional,
  IsUrl,
  MinLength,
  Matches,
} from "class-validator";

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase alphanumeric with hyphens only",
  })
  slug?: string;

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
  @IsUrl()
  imageUrl?: string | null;
}
