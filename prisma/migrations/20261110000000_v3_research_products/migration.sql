-- V3: marketplaces, products, listings, research pipeline tables, verification audit, measurement semantics.
-- Additive only. Users, profiles, measurements, recommendations, feedback and existing charts are untouched.
ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'OFFICIAL_PRODUCT_PAGE';
ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_LISTING';

CREATE TYPE "ResearchStatus" AS ENUM ('SUCCESS','PARTIAL_SUCCESS','SOURCE_UNAVAILABLE','ACCESS_RESTRICTED','INVALID_DATA','NEEDS_HUMAN_VERIFICATION');
CREATE TYPE "JobState" AS ENUM ('QUEUED','RUNNING','COMPLETED','FAILED');
CREATE TYPE "VerificationAction" AS ENUM ('APPROVED','REJECTED','FLAGGED','EDITED','DEPRECATED');

CREATE TABLE "Marketplace" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "domain" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Marketplace_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Marketplace_slug_key" ON "Marketplace"("slug");
CREATE UNIQUE INDEX "Marketplace_domain_key" ON "Marketplace"("domain");

CREATE TABLE "Product" (
  "id" TEXT NOT NULL, "brandId" TEXT NOT NULL, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "categoryId" TEXT NOT NULL,
  "gender" "Gender" NOT NULL DEFAULT 'UNISEX', "fitCut" TEXT NOT NULL DEFAULT 'REGULAR', "fitCutStated" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Product_brandId_slug_key" ON "Product"("brandId","slug");
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductListing" (
  "id" TEXT NOT NULL, "productId" TEXT NOT NULL, "marketplaceId" TEXT, "url" TEXT NOT NULL, "retrievedAt" TIMESTAMP(3), "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ProductListing_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ProductListing_url_key" ON "ProductListing"("url");
ALTER TABLE "ProductListing" ADD CONSTRAINT "ProductListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductListing" ADD CONSTRAINT "ProductListing_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MeasurementDefinition" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "appliesTo" TEXT NOT NULL, "description" TEXT NOT NULL,
  CONSTRAINT "MeasurementDefinition_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MeasurementDefinition_code_key" ON "MeasurementDefinition"("code");

CREATE TABLE "ResearchJob" (
  "id" TEXT NOT NULL, "state" "JobState" NOT NULL DEFAULT 'QUEUED', "targets" JSONB NOT NULL, "createdById" TEXT, "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
  CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id"));
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ResearchSource" (
  "id" TEXT NOT NULL, "jobId" TEXT, "url" TEXT NOT NULL, "domain" TEXT NOT NULL, "status" "ResearchStatus" NOT NULL, "httpStatus" INTEGER,
  "extractionMethod" TEXT, "note" TEXT, "chartVersionId" TEXT, "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ResearchSource_jobId_idx" ON "ResearchSource"("jobId");
CREATE INDEX "ResearchSource_url_idx" ON "ResearchSource"("url");
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ResearchJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DataVerification" (
  "id" TEXT NOT NULL, "chartVersionId" TEXT NOT NULL, "action" "VerificationAction" NOT NULL, "adminId" TEXT, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataVerification_pkey" PRIMARY KEY ("id"));
CREATE INDEX "DataVerification_chartVersionId_idx" ON "DataVerification"("chartVersionId");
ALTER TABLE "DataVerification" ADD CONSTRAINT "DataVerification_chartVersionId_fkey" FOREIGN KEY ("chartVersionId") REFERENCES "BrandSizeChartVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataVerification" ADD CONSTRAINT "DataVerification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Charts: optional product scope (null = brand-level). productKey keeps the identity index unique for brand-level charts too.
ALTER TABLE "BrandSizeChart" ADD COLUMN "productId" TEXT, ADD COLUMN "productKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BrandSizeChart" ADD CONSTRAINT "BrandSizeChart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "BrandSizeChart_identity_key";
CREATE UNIQUE INDEX "BrandSizeChart_identity_key" ON "BrandSizeChart"("brandId","categoryId","productKey","gender","region","productLine","fitCut");

ALTER TABLE "BrandSizeChartVersion"
  ADD COLUMN "sourceDomain" TEXT, ADD COLUMN "extractionMethod" TEXT,
  ADD COLUMN "measurementSemantics" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "ambiguousDimensions" JSONB NOT NULL DEFAULT '[]';

INSERT INTO "MeasurementDefinition"("id","code","name","appliesTo","description") VALUES
 ('md_body_circ','BODY_CIRCUMFERENCE','Body circumference','BODY','Tape measured around the person (chest, waist, hips...). The size is designed to fit this body.'),
 ('md_garment_circ','GARMENT_CIRCUMFERENCE','Garment circumference','GARMENT','Full distance around the finished garment at that point. Ease = garment minus body.'),
 ('md_garment_flat','GARMENT_WIDTH_FLAT','Garment width (flat)','GARMENT','Width of the garment laid flat. Circumference is twice this. NEVER converted automatically.'),
 ('md_garment_len','GARMENT_LENGTH','Garment length','GARMENT','Length of the garment (e.g. HPS to hem). Shown for information; not compared with a body measurement.'),
 ('md_ambiguous','AMBIGUOUS','Meaning not stated','UNKNOWN','The source does not say what this number represents. Excluded from recommendations until a human confirms it.');
