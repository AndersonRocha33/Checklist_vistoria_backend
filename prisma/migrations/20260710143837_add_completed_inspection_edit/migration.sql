-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "editedAfterCompletion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editingAfterCompletion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedById" TEXT;

-- CreateIndex
CREATE INDEX "Inspection_lastEditedById_idx" ON "Inspection"("lastEditedById");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
