import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CategoryDto, userId: string) {
    return this.prisma.category.create({
      data: {
        ...data,
        userId: userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId: userId },
    });
  }

  async findOne(id: string, userId: string) {
    return this.prisma.category.findFirst({
      where: {
        id: id,
        userId: userId,
      },
      include: { recipes: true },
    });
  }

  async deleteOne(categoryId, userId) {
    return this.prisma.category.delete({
      where: { id: categoryId, userId: userId },
    });
  }
}
