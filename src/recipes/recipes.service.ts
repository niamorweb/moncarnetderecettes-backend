import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as Handlebars from 'handlebars';
import { Browser } from 'puppeteer';

@Injectable()
export class RecipesService {
  private browser: Browser;
  private compiledTemplate: Handlebars.TemplateDelegate;
  private readonly logger = new Logger(RecipesService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createRecipe(data: any, userId: string) {
    let categoryId = data.categoryId || null;
    if (data.newCategoryName) {
      const newCategory = await this.prisma.category.create({
        data: {
          name: data.newCategoryName,
          userId: userId,
        },
      });
      categoryId = newCategory.id;
    }
    return this.prisma.recipe.create({
      data: {
        name: data.name,
        ingredients: data.ingredients,
        steps: data.steps,
        image_url: data.image_url,
        cloudinaryPublicId: data.cloudinaryPublicId,
        userId: userId,
        servings: data.servings,
        prep_time: data.prep_time,
        cook_time: data.cook_time,
        categoryId: categoryId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.recipe.findMany({
      where: { userId: userId },
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async bulkDelete(userId: string, recipeIds: string[]) {
    const recipesToDelete = await this.prisma.recipe.findMany({
      where: {
        id: { in: recipeIds },
        userId: userId,
      },
      select: {
        id: true,
        cloudinaryPublicId: true,
      },
    });

    const publicIdsToDelete = recipesToDelete
      .map((r) => r.cloudinaryPublicId)
      .filter((id) => id !== null);

    if (publicIdsToDelete.length > 0) {
      await Promise.all(
        publicIdsToDelete.map((publicId) =>
          this.cloudinaryService.deleteImage(publicId),
        ),
      );
    }

    return this.prisma.recipe.deleteMany({
      where: {
        id: { in: recipeIds },
        userId: userId,
      },
    });
  }

  async findOne(recipeId: string, userId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId: userId,
      },
      include: {
        category: true,
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recette introuvable');
    }

    return recipe;
  }

  async updateRecipe(id: string, userId: string, data: any) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });

    if (!recipe) throw new NotFoundException('Recette introuvable');
    if (recipe.userId !== userId)
      throw new ForbiddenException('Action interdite');

    if (data.cloudinaryPublicId && recipe.cloudinaryPublicId) {
      await this.cloudinaryService.deleteImage(recipe.cloudinaryPublicId);
    }

    const { servings, prep_time, cook_time, steps, ingredients, ...rest } =
      data;

    return this.prisma.recipe.update({
      where: { id },
      data: {
        ...rest,
        servings: servings ? parseInt(servings, 10) : null,
        prep_time: prep_time ? parseInt(prep_time, 10) : null,
        cook_time: cook_time ? parseInt(cook_time, 10) : null,
        ingredients: Array.isArray(ingredients) ? ingredients : undefined,
        steps: Array.isArray(steps) ? steps : undefined,
      },
    });
  }

  async bulkMoveToCategory(
    userId: string,
    recipeIds: string[],
    categoryId: string | null,
  ) {
    return this.prisma.recipe.updateMany({
      where: {
        id: { in: recipeIds },
        userId: userId,
      },
      data: {
        categoryId: categoryId,
      },
    });
  }

  async deleteRecipe(id: string, userId: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });

    if (!recipe) throw new NotFoundException("Cette recette n'existe pas");
    if (recipe.userId !== userId)
      throw new ForbiddenException('Action interdite');

    if (recipe.cloudinaryPublicId) {
      await this.cloudinaryService.deleteImage(recipe.cloudinaryPublicId);
    }

    return this.prisma.recipe.delete({ where: { id } });
  }

  async findOneRecipePublic(username: string, recipeId: string) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        username: username,
        isPremium: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('Recipe not found');
    }

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    return recipe;
  }
  async onModuleInit() {
    try {
      const templatePath = join(
        process.cwd(),
        'src',
        'templates',
        'recipes-book.hbs',
      );
      const templateHtml = readFileSync(templatePath, 'utf-8');

      if (!templateHtml || templateHtml.trim().length === 0) {
        throw new Error(`Le fichier template est vide : ${templatePath}`);
      }

      this.compiledTemplate = Handlebars.compile(templateHtml);
    } catch (e) {
      throw e;
    }
    await this.launchBrowser();
  }

  private async launchBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.log("🚀 Lancement de l'instance Chrome...");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async printAllRecipes(userId: string): Promise<Buffer> {
    this.logger.log(`📥 Début génération pour userId: ${userId}`);

    if (!this.compiledTemplate) {
      throw new Error('Template non initialisé');
    }

    const recipes = await this.prisma.recipe.findMany({
      where: { userId },
      include: { category: true },
    });

    this.logger.log(`Found ${recipes.length} recipes`);

    const htmlContent = this.compiledTemplate({ recipes });
    if (!htmlContent || htmlContent.startsWith('undefined')) {
      throw new Error('Erreur de rendu Handlebars');
    }

    await this.launchBrowser();
    const page = await this.browser.newPage();

    try {
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfUint8Array = await page.pdf({
        format: 'A5',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      return Buffer.from(pdfUint8Array);
    } finally {
      await page.close();
    }
  }
}
