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
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        profile: {
          update: {
            name: data.public_name,
          },
        },
      },
      include: { profile: true },
    });
  }
}
