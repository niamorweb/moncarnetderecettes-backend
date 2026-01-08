import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { RecipesService } from 'src/recipes/recipes.service';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, RecipesService],
})
export class ProfilesModule {}
