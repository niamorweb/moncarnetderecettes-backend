import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async getPublicProfileByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username, isPremium: true },
      select: {
        id: true,
        username: true,
        isPremium: true,
        profile: {
          select: {
            name: true,
            bio: true,
            avatar_url: true,
          },
        },
        recipes: {
          select: {
            id: true,
            name: true,
            image_url: true,
            prep_time: true,
            cook_time: true,
            servings: true,
            category: { select: { id: true, name: true } },
          },
        },
        categories: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return user;
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        username: true,
        isPremium: true,
        premiumEndsAt: true,
        profile: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  async updateProfile(userId: string, data: any) {
    console.log(' czcz ', data);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        profile: {
          update: {
            name: data.public_name,
            bio: data.bio,
            avatar_url: data.avatar_url,
            avatar_cloudinary_public_id: data.avatar_cloudinary_public_id, // Nouveau champ
          },
        },
      },
      include: { profile: true },
    });

    return { success: true, message: 'Profile updated' };
  }
}
