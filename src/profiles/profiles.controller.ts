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
      const uploadResult: any =
        await this.cloudinaryServices.uploadImageAvatar(file);

      updateData = {
        ...updateData,
        avatar_url: uploadResult.secure_url,
        avatar_cloudinary_public_id: uploadResult.public_id,
      };
    }
    return this.profilesService.updateProfile(userId, updateData);
  }
}
