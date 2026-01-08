import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  newCategoryName?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  prep_time: number;

  @Type(() => Number)
  @IsNumber()
  servings: number;

  @Type(() => Number)
  @IsNumber()
  cook_time: number;

  @IsArray()
  @IsString({ each: true })
  ingredients: string[];

  @IsArray()
  @IsString({ each: true })
  steps: string[];

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  cloudinaryPublicId?: string;
}
