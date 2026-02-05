import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  InternalServerErrorException,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from '@nestjs/passport';
import { EmailVerifiedGuard } from 'src/guards/email-verified.guard';
import { RecipesService } from 'src/recipes/recipes.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { UpdateRecipeDto } from 'src/recipes/dto/update-recipe.dto';

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly recipesServices: RecipesService,
    private readonly cloudinaryServices: CloudinaryService,
  ) {}

  @Get('public/:username')
  async getPublic(@Param('username') username: string) {
    return this.profilesService.getPublicProfileByUsername(username);
  }

  @Get('public/:username/recipe/:id')
  async getPublicRecipe(
    @Param('username') username: string,
    @Param('id') id: string,
  ) {
    return this.recipesServices.findOneRecipePublic(username, id);
  }

  @UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.profilesService.getMyProfile(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
  @Patch('me')
  @UseInterceptors(FileInterceptor('avatar'))
  async update(
    @Request() req,
    @Body() data: UpdateProfileDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5 Mo
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
        fileIsRequired: false,
      }),
    )
    file: Express.Multer.File,
  ) {
    console.log(
      '[UPDATE PROFILE] Début de la mise à jour du profil pour l’utilisateur ID:',
      req.user.userId,
    );

    if (!file) {
      console.log(
        '[UPDATE PROFILE] Aucun fichier avatar reçu. Mise à jour sans changement d’avatar.',
      );
    } else {
      console.log('[UPDATE PROFILE] Fichier reçu :', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        filename: file.filename,
      });
    }

    const userId = req.user.userId;
    let updateData = { ...data };

    if (file) {
      console.log('[UPDATE PROFILE] Upload de l’avatar en cours...');
      try {
        const uploadResult: any =
          await this.cloudinaryServices.uploadImageAvatar(file);
        console.log('[UPDATE PROFILE] Upload Cloudinary réussi :', {
          secure_url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
        });

        updateData = {
          ...updateData,
          avatar_url: uploadResult.secure_url,
          avatar_cloudinary_public_id: uploadResult.public_id,
        };
      } catch (error) {
        console.error(
          '[UPDATE PROFILE] Erreur lors de l’upload Cloudinary :',
          error,
        );
        throw new InternalServerErrorException(
          'Échec du téléchargement de l’avatar',
        );
      }
    }

    console.log(
      '[UPDATE PROFILE] Mise à jour du profil avec les données :',
      updateData,
    );

    try {
      const result = await this.profilesService.updateProfile(
        userId,
        updateData,
      );
      console.log('[UPDATE PROFILE] Profil mis à jour avec succès :', result);
      return result;
    } catch (error) {
      console.error(
        '[UPDATE PROFILE] Erreur lors de la mise à jour du profil :',
        error,
      );
      throw new InternalServerErrorException(
        'Échec de la mise à jour du profil',
      );
    }
  }
}
