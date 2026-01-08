import { PartialType } from '@nestjs/mapped-types';
import { RecipeDto } from './recipe.dto';

export class UpdateRecipeDto extends PartialType(RecipeDto) {}
