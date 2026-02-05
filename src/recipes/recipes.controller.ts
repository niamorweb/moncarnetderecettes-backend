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
  Res,
  Query,
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
          cloudinaryPublicId: uploadResult.public_id,
        },
        userId,
      );
    } else {
      return this.recipesServices.createRecipe(
        {
          ...data,
          image_url: null,
          cloudinaryPublicId: null,
        },
        userId,
      );
    }
  }

  @Get('all')
  async findAll(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const userId = req.user.userId;

    // If no pagination params, return all (backward compat for pdf-viewer etc.)
    if (!page && !limit) {
      return this.recipesServices.findAll(userId);
    }

    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10)));

    return this.recipesServices.findPaginated(userId, pageNum, limitNum, categoryId || undefined);
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

  @Get('pdf/print-all')
  async printAllRecipes(@Request() req, @Res() res) {
    const pdfBuffer = await this.recipesServices.printAllRecipes(
      req.user.userId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="mes-recettes.pdf"',
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }
}
