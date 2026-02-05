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
      where: {
        username: username,
        profile: {
          isPublic: true,
        },
      },
      select: {
        username: true,
        isPremium: true,
        profile: {
          select: {
            name: true,
            bio: true,
            avatar_url: true,
            location: true,
            website: true,
            instagram: true,
            tiktok: true,
            youtube: true,
            pinterest: true,
            threads: true,
            facebook: true,
            twitter: true,
            twitch: true,
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
            category: { select: { name: true, id: true } },
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

    if (!user) {
      return null;
    }

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
    console.log(`PATCH profile for user ${userId}`);

    const { username, public_name, is_public, ...rest } = data;
    console.log(`DATA profile for user ${data.is_public}`);

    const profileData: any = { ...rest };

    if (public_name !== undefined) profileData.name = public_name;

    if (is_public !== undefined) {
      profileData.isPublic = is_public === 'true' || is_public === true;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        profile: {
          update: profileData,
        },
      },
    });

    return { success: true, message: 'Profil mis à jour' };
  }
}
