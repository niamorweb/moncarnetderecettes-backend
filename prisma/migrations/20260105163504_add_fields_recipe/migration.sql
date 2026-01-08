/*
  Warnings:

  - You are about to drop the column `step` on the `Recipe` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "step",
ADD COLUMN     "cook_time" INTEGER,
ADD COLUMN     "prep_time" INTEGER,
ADD COLUMN     "servings" INTEGER,
ADD COLUMN     "steps" TEXT[];
