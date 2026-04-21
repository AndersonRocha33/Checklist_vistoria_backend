-- AlterTable
ALTER TABLE "InspectionItem" ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
