-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "Unit" AS ENUM ('CM', 'IN');
CREATE TYPE "FitPreference" AS ENUM ('SLIM', 'REGULAR', 'RELAXED', 'OVERSIZED');
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DEPRECATED');
CREATE TYPE "FitOutcome" AS ENUM ('TOO_TIGHT', 'PERFECT', 'TOO_LOOSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fitCategory" TEXT,
    "preferredUnit" "Unit" NOT NULL DEFAULT 'CM',
    "fitPreference" "FitPreference" NOT NULL DEFAULT 'REGULAR',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipsCm" DOUBLE PRECISION,
    "shoulderCm" DOUBLE PRECISION,
    "armLengthCm" DOUBLE PRECISION,
    "inseamCm" DOUBLE PRECISION,
    "neckCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClothingCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    CONSTRAINT "ClothingCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandSizeChart" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "fitCut" TEXT NOT NULL DEFAULT 'REGULAR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandSizeChart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandSizeChartVersion" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rows" JSONB NOT NULL,
    "measurementType" TEXT NOT NULL DEFAULT 'GARMENT',
    "status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandSizeChartVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chartVersionId" TEXT NOT NULL,
    "fitPreference" "FitPreference" NOT NULL,
    "recommendedSize" TEXT,
    "confidence" DOUBLE PRECISION,
    "insufficientData" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedBrand" (
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedBrand_pkey" PRIMARY KEY ("userId","brandId")
);

CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "purchasedSize" TEXT NOT NULL,
    "outcome" "FitOutcome" NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
CREATE UNIQUE INDEX "BodyMeasurement_userId_key" ON "BodyMeasurement"("userId");
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE UNIQUE INDEX "ClothingCategory_slug_key" ON "ClothingCategory"("slug");
CREATE UNIQUE INDEX "BrandSizeChart_brandId_categoryId_fitCut_key" ON "BrandSizeChart"("brandId", "categoryId", "fitCut");
CREATE UNIQUE INDEX "BrandSizeChartVersion_chartId_version_key" ON "BrandSizeChartVersion"("chartId", "version");
CREATE INDEX "Recommendation_userId_createdAt_idx" ON "Recommendation"("userId", "createdAt");
CREATE INDEX "UserFeedback_recommendationId_idx" ON "UserFeedback"("recommendationId");

-- Data-quality guard rails (not modelled in Prisma, enforced by the database)
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_ranges_chk" CHECK (
  ("chestCm" IS NULL OR "chestCm" BETWEEN 40 AND 250) AND
  ("waistCm" IS NULL OR "waistCm" BETWEEN 40 AND 250) AND
  ("heightCm" IS NULL OR "heightCm" BETWEEN 80 AND 260)
);

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandSizeChart" ADD CONSTRAINT "BrandSizeChart_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandSizeChart" ADD CONSTRAINT "BrandSizeChart_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ClothingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BrandSizeChartVersion" ADD CONSTRAINT "BrandSizeChartVersion_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "BrandSizeChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_chartVersionId_fkey" FOREIGN KEY ("chartVersionId") REFERENCES "BrandSizeChartVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SavedBrand" ADD CONSTRAINT "SavedBrand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedBrand" ADD CONSTRAINT "SavedBrand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
