/*
  Warnings:

  - You are about to drop the column `isPrivate` on the `Profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "isPrivate",
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;
