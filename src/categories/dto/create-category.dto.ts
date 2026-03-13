import {
  IsString,
  IsOptional,
  IsUrl,
  MinLength,
  Matches,
} from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase alphanumeric with hyphens only",
  })
  slug: string;

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
  @IsUrl()
  imageUrl?: string;
}
