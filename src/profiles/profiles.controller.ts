import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from '@nestjs/passport';
import { EmailVerifiedGuard } from 'src/guards/email-verified.guard';
import { RecipesService } from 'src/recipes/recipes.service';

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly recipesServices: RecipesService,
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
  async update(@Request() req, @Body() data: UpdateProfileDto) {
    return this.profilesService.updateProfile(req.user.userId, data);
  }
}
