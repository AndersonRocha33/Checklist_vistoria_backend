/*
  Warnings:

  - A unique constraint covering the columns `[name,ownerId]` on the table `Enterprise` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Enterprise" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Enterprise_ownerId_idx" ON "Enterprise"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Enterprise_name_ownerId_key" ON "Enterprise"("name", "ownerId");

-- AddForeignKey
ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
