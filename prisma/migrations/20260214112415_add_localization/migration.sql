-- Step 1: Add new columns to product_categories with defaults
ALTER TABLE "product_categories"
ADD COLUMN "image_url" TEXT,
ADD COLUMN "name_en" TEXT,
ADD COLUMN "name_ru" TEXT,
ADD COLUMN "name_uz" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3);

-- Step 2: Copy existing name to all localized columns
UPDATE "product_categories" SET
  "name_en" = "name",
  "name_ru" = "name",
  "name_uz" = "name",
  "updated_at" = NOW();

-- Step 3: Make columns required
ALTER TABLE "product_categories"
ALTER COLUMN "name_en" SET NOT NULL,
ALTER COLUMN "name_ru" SET NOT NULL,
ALTER COLUMN "name_uz" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- Step 4: Drop old name column
ALTER TABLE "product_categories" DROP COLUMN "name";

-- Step 5: Add new columns to products with defaults
ALTER TABLE "products"
ADD COLUMN "description_en" TEXT,
ADD COLUMN "description_ru" TEXT,
ADD COLUMN "description_uz" TEXT,
ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "in_stock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "name_en" TEXT,
ADD COLUMN "name_ru" TEXT,
ADD COLUMN "name_uz" TEXT,
ADD COLUMN "slug" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3);

-- Step 6: Copy existing data to new columns (if products exist)
UPDATE "products" SET
  "name_en" = "name",
  "name_ru" = "name",
  "name_uz" = "name",
  "description_en" = "description",
  "description_ru" = "description",
  "description_uz" = "description",
  "slug" = LOWER(REPLACE("name", ' ', '-')),
  "updated_at" = NOW();

-- Step 7: Make columns required
ALTER TABLE "products"
ALTER COLUMN "name_en" SET NOT NULL,
ALTER COLUMN "name_ru" SET NOT NULL,
ALTER COLUMN "name_uz" SET NOT NULL,
ALTER COLUMN "slug" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- Step 8: Drop old columns from products
ALTER TABLE "products"
DROP COLUMN "description",
DROP COLUMN "image_url",
DROP COLUMN "name";

-- Step 9: Create indexes
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
CREATE INDEX "products_in_stock_idx" ON "products"("in_stock");
