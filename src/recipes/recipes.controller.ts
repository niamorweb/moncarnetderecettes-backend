import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  Get,
  Put,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Patch,
  NotFoundException,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipeDto } from './dto/recipe.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { EmailVerifiedGuard } from 'src/guards/email-verified.guard';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { FileInterceptor } from '@nestjs/platform-express';

@UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesServices: RecipesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image')) // Interception de l'image
  async createRecipe(
    @Body() data: RecipeDto,
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
        fileIsRequired: false,
      }),
    )
    file: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    let imageUrl: string | undefined = undefined;

    if (file) {
      // Upload sur cloudinary
      const uploadResult: any = await this.cloudinaryService.uploadImage(file);
      return this.recipesServices.createRecipe(
        {
          ...data,
          image_url: uploadResult.secure_url,
          cloudinaryPublicId: uploadResult.public_id, // 👈 AJOUTE ÇA
        },
        userId,
      );
    } else {
      throw new NotFoundException(
        'Une image est nécessaire pour créer une recette',
      );
    }
  }

  @Get('all')
  async findAll(@Request() req) {
    const userId = req.user.userId;
    return this.recipesServices.findAll(userId);
  }

  @Patch('bulk-move')
  async bulkMove(
    @Request() req,
    @Body() data: { recipeIds: string[]; categoryId: string | null },
  ) {
    const userId = req.user.userId;

    return this.recipesServices.bulkMoveToCategory(
      userId,
      data.recipeIds,
      data.categoryId,
    );
  }

  @Delete('bulk-delete')
  async bulkDelete(@Request() req, @Body() data: { ids: string[] }) {
    const userId = req.user.userId;

    return this.recipesServices.bulkDelete(userId, data.ids);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') recipeId: string) {
    const userId = req.user.userId;
    // On passe l'ID de la recette ET l'ID de l'utilisateur pour la sécurité
    return this.recipesServices.findOne(recipeId, userId);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image')) // Pour intercepter l'image
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() data: UpdateRecipeDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
        fileIsRequired: false,
      }),
    )
    file: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    let updateData = { ...data };

    if (file) {
      const uploadResult: any = await this.cloudinaryService.uploadImage(file);

      updateData = {
        ...updateData,
        image_url: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id,
      };
    }

    return this.recipesServices.updateRecipe(id, userId, updateData);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    return this.recipesServices.deleteRecipe(id, req.user.userId);
  }
}
