-- V5: revocable sessions, hashed single-use auth tokens, security events, admin audit log,
-- extra verification statuses, missing foreign keys, and correction of two data-integrity defaults.
-- Additive and safe to run on a database with live data: no table or column is dropped, no user data is changed,
-- and no account changes role (existing ADMIN accounts stay ADMIN; nobody is promoted).

-- 1. New enum values (ADD VALUE cannot be used in the same transaction it was added in, so nothing below uses them).
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_HUMAN_VERIFICATION';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'INVALID';

CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
CREATE TYPE "AuthEventType" AS ENUM (
  'REGISTER', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGIN_BLOCKED_DISABLED', 'LOGOUT', 'LOGOUT_ALL', 'SESSION_REVOKED',
  'EMAIL_VERIFICATION_SENT', 'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED', 'PASSWORD_REHASHED', 'ACCOUNT_DELETED');

-- 2. User account state. Existing accounts are left unverified (emailVerifiedAt NULL): they keep working,
--    and are asked to verify their address from the dashboard.
ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "disabledAt" TIMESTAMP(3);

-- 3. Sessions
CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  "ipHash" TEXT,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Auth tokens
CREATE TABLE "AuthToken" (
  "id" TEXT NOT NULL,
  "type" "AuthTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Security events
CREATE TABLE "AuthEvent" (
  "id" TEXT NOT NULL,
  "type" "AuthEventType" NOT NULL,
  "userId" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AuthEvent_type_createdAt_idx" ON "AuthEvent"("type", "createdAt");
CREATE INDEX "AuthEvent_userId_createdAt_idx" ON "AuthEvent"("userId", "createdAt");
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Admin audit log
CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Coverage notes can now describe one product (missing PRODUCT data) as well as a brand (missing BRAND data).
ALTER TABLE "BrandCoverageNote" ADD COLUMN "productId" TEXT, ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "BrandCoverageNote" ADD CONSTRAINT "BrandCoverageNote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Relationships that existed only by convention. Dangling references are cleared first (they point at rows that
--    no longer exist), then the constraint is added. Product.categoryId is NOT NULL, so it is added NOT VALID and then
--    validated only if every row is consistent: a bad legacy row can never make the deployment fail.
UPDATE "ResearchSource" s SET "chartVersionId" = NULL
  WHERE "chartVersionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "BrandSizeChartVersion" v WHERE v."id" = s."chartVersionId");
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_chartVersionId_fkey" FOREIGN KEY ("chartVersionId") REFERENCES "BrandSizeChartVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "BrandSizeChartVersion" v SET "verifiedById" = NULL
  WHERE "verifiedById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = v."verifiedById");
ALTER TABLE "BrandSizeChartVersion" ADD CONSTRAINT "BrandSizeChartVersion_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ClothingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
DO $$ BEGIN
  ALTER TABLE "Product" VALIDATE CONSTRAINT "Product_categoryId_fkey";
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'Product_categoryId_fkey left NOT VALID: some legacy products reference a missing category. See docs/AUDIT-V5.md.';
END $$;

-- 9. Data integrity corrections (metadata only; measurement rows are not touched).
-- 9a. A product whose listing never stated its cut was stored as REGULAR. Its cut is UNKNOWN.
UPDATE "BrandSizeChart" c SET "fitCut" = 'UNKNOWN'
  FROM "Product" p
  WHERE c."productId" = p."id" AND p."fitCutStated" = false AND p."fitCut" = 'REGULAR' AND c."fitCut" = 'REGULAR';
UPDATE "Product" SET "fitCut" = 'UNKNOWN' WHERE "fitCutStated" = false AND "fitCut" = 'REGULAR';

-- 9b. Chart versions whose source never said what its numbers mean were stored as GARMENT. If every body-comparable
--     dimension is flagged AMBIGUOUS, the chart-level type is UNKNOWN.
UPDATE "BrandSizeChartVersion" v SET "measurementType" = 'UNKNOWN'
  WHERE v."measurementType" = 'GARMENT'
    AND jsonb_typeof(v."ambiguousDimensions") = 'array' AND jsonb_array_length(v."ambiguousDimensions") > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each_text(v."measurementSemantics") s
      WHERE s.key IN ('chest','waist','hips','shoulder','armLength','inseam','neck','thigh') AND s.value <> 'AMBIGUOUS');

-- 10. Reference table: two clearer codes for non-circumference body/garment values.
INSERT INTO "MeasurementDefinition"("id","code","name","appliesTo","description") VALUES
 ('md_body_linear','BODY_LINEAR','Body length / width','BODY','A straight body measurement such as shoulder width, arm length or inseam.'),
 ('md_garment_linear','GARMENT_LINEAR','Garment length / width','GARMENT','A straight garment measurement such as shoulder seam to seam or garment inseam.')
ON CONFLICT ("code") DO NOTHING;
