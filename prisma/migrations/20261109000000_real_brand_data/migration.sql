-- Additive migration: keeps all users, measurements, recommendations and existing charts.
CREATE TYPE "Gender" AS ENUM ('MEN', 'WOMEN', 'UNISEX');
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_SITE', 'OFFICIAL_PDF', 'STORE_MEASURED', 'MANUAL_ENTRY', 'DEMO');

ALTER TABLE "BrandSizeChart"
  ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNISEX',
  ADD COLUMN "region" TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN "productLine" TEXT NOT NULL DEFAULT '';

DROP INDEX "BrandSizeChart_brandId_categoryId_fitCut_key";
CREATE UNIQUE INDEX "BrandSizeChart_identity_key"
  ON "BrandSizeChart"("brandId", "categoryId", "gender", "region", "productLine", "fitCut");

ALTER TABLE "BrandSizeChartVersion"
  ADD COLUMN "sourceType" "SourceType" NOT NULL DEFAULT 'MANUAL_ENTRY',
  ADD COLUMN "originalUnit" "Unit" NOT NULL DEFAULT 'CM',
  ADD COLUMN "retrievedAt" TIMESTAMP(3);

-- Existing demo charts keep working and are clearly typed as DEMO
UPDATE "BrandSizeChartVersion" v SET "sourceType" = 'DEMO'
FROM "BrandSizeChart" c JOIN "Brand" b ON b."id" = c."brandId"
WHERE v."chartId" = c."id" AND b."isDemo" = true;

CREATE TABLE "BrandCoverageNote" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT,
    "gender" "Gender",
    "note" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandCoverageNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BrandCoverageNote_brandId_idx" ON "BrandCoverageNote"("brandId");
ALTER TABLE "BrandCoverageNote" ADD CONSTRAINT "BrandCoverageNote_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
