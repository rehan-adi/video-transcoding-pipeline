-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('Pending', 'Processing', 'Published', 'Failed');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'Pending',
    "outputBucket" TEXT,
    "outputKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_bucket_key_key" ON "Video"("bucket", "key");
