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
  private compiledPrintTemplate: Handlebars.TemplateDelegate;
  private compiledCoverTemplate: Handlebars.TemplateDelegate;
  private readonly logger = new Logger(RecipesService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createRecipe(data: any, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isPremium) {
      const recipeCount = await this.prisma.recipe.count({ where: { userId } });
      if (recipeCount >= 42) {
        throw new ForbiddenException(
          'Vous avez atteint la limite de 42 recettes. Passez à Premium pour en ajouter davantage.',
        );
      }
    }

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

  async findPaginated(
    userId: string,
    page: number,
    limit: number,
    categoryId?: string,
  ) {
    const where: any = { userId };
    if (categoryId) where.categoryId = categoryId;

    const [data, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.recipe.count({ where }),
    ]);

    return { data, total, hasMore: page * limit < total };
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

    const {
      servings,
      prep_time,
      cook_time,
      steps,
      ingredients,
      categoryId,
      ...rest
    } = data;

    return this.prisma.recipe.update({
      where: { id },
      data: {
        ...rest,
        categoryId: categoryId === '' ? null : (categoryId ?? undefined),
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
    // Helper pour pagination single-page (1 recette = 1 page)
    Handlebars.registerHelper('calcPageSingle', (index: number) => index + 1);
    // Helper legacy pour pagination double-page (1 recette = 2 pages)
    Handlebars.registerHelper(
      'calcPage',
      (index: number, offset: number) => index * 2 + 1 + offset,
    );

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

      const printTemplatePath = join(
        process.cwd(),
        'src',
        'templates',
        'recipes-book-print.hbs',
      );
      const printTemplateHtml = readFileSync(printTemplatePath, 'utf-8');

      if (!printTemplateHtml || printTemplateHtml.trim().length === 0) {
        throw new Error(
          `Le fichier template print est vide : ${printTemplatePath}`,
        );
      }

      this.compiledPrintTemplate = Handlebars.compile(printTemplateHtml);

      const coverTemplatePath = join(
        process.cwd(),
        'src',
        'templates',
        'cover-spread.hbs',
      );
      const coverTemplateHtml = readFileSync(coverTemplatePath, 'utf-8');
      this.compiledCoverTemplate = Handlebars.compile(coverTemplateHtml);
    } catch (e) {
      throw e;
    }
    await this.launchBrowser();
  }

  private async launchBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
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

  /**
   * Génère 2 PDFs séparés pour Lulu print-on-demand :
   * - coverPdf : cover spread (back + spine + front) en 1 page
   * - interiorPdf : pages intérieures (recettes + pages blanches)
   *
   * Lulu attend 2 fichiers séparés (cover + interior).
   * Format A5 (148x210mm) + bleed 3.175mm (0.125in) = 154.35x216.35mm
   */
  async printAllRecipesPrintReady(
    userId: string,
    targetPageCount?: number,
    spineWidth?: number,
    coverDimensions?: {
      spreadWidth: number;
      spreadHeight: number;
      frontWidth: number;
      frontHeight: number;
      frontLeft: number;
      frontTop: number;
      backWidth: number;
      backHeight: number;
      backLeft: number;
      backTop: number;
      spineWidth: number;
      spineHeight: number;
      spineLeft: number;
      spineTop: number;
    },
  ): Promise<{ coverPdf: Buffer; interiorPdf: Buffer }> {
    this.logger.log(`Generation PDF print-ready A5 pour userId: ${userId}`);

    if (!this.compiledPrintTemplate || !this.compiledCoverTemplate) {
      throw new Error('Templates non initialises');
    }

    const [recipes, user] = await Promise.all([
      this.prisma.recipe.findMany({
        where: { userId },
        include: { category: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      }),
    ]);

    const userName = user?.username || 'Mon Livre';
    const recipeCount = recipes.length;

    // Pages intérieures = recettes + pages blanches
    const blankPagesCount =
      targetPageCount && targetPageCount > recipes.length
        ? targetPageCount - recipes.length
        : 0;
    const blankPages = new Array(blankPagesCount).fill(0);

    this.logger.log(
      `PDF: ${recipeCount} recettes, ${blankPagesCount} pages blanches, target=${targetPageCount}`,
    );

    await this.launchBrowser();

    // ── Dimensions pages intérieures ──
    const bleed = 3.175; // 0.125in en mm
    const pageWidth = coverDimensions ? coverDimensions.frontWidth : 148;
    const pageHeight = coverDimensions ? coverDimensions.frontHeight : 210;
    const interiorWidth = pageWidth + bleed * 2;
    const interiorHeight = pageHeight + bleed * 2;

    // ── Dimensions cover spread ──
    let coverSpreadWidth: number;
    let coverSpreadHeight: number;
    let backLeft: number;
    let backTop: number;
    let backWidth: number;
    let backHeight: number;
    let spineLeft: number;
    let spineTop: number;
    let spine: number;
    let spineHeight: number;
    let frontLeft: number;
    let frontTop: number;
    let frontWidth: number;
    let frontHeight: number;

    if (coverDimensions) {
      // Dimensions fournies par l'API externe (Gelato)
      coverSpreadWidth = coverDimensions.spreadWidth;
      coverSpreadHeight = coverDimensions.spreadHeight;
      backLeft = coverDimensions.backLeft;
      backTop = coverDimensions.backTop;
      backWidth = coverDimensions.backWidth;
      backHeight = coverDimensions.backHeight;
      spineLeft = coverDimensions.spineLeft;
      spineTop = coverDimensions.spineTop;
      spine = coverDimensions.spineWidth;
      spineHeight = coverDimensions.spineHeight;
      frontLeft = coverDimensions.frontLeft;
      frontTop = coverDimensions.frontTop;
      frontWidth = coverDimensions.frontWidth;
      frontHeight = coverDimensions.frontHeight;
    } else {
      // Fallback : calcul Lulu casewrap hardcover A5
      spine = spineWidth || 5;
      const wrap = 19.05;
      const boardOverhang = 3.175;
      const hinge = 2.54;
      const bw = 148 + boardOverhang;
      const bh = 210 + boardOverhang * 2;
      coverSpreadWidth = wrap * 2 + bw * 2 + hinge * 2 + spine;
      coverSpreadHeight = wrap * 2 + bh;
      backLeft = wrap;
      backTop = wrap;
      backWidth = bw;
      backHeight = bh;
      spineLeft = wrap + bw + hinge;
      spineTop = wrap;
      spineHeight = bh;
      frontLeft = wrap + bw + hinge + spine + hinge;
      frontTop = wrap;
      frontWidth = bw;
      frontHeight = bh;
    }

    // ── 1. Générer le cover spread ──
    const coverHtml = this.compiledCoverTemplate({
      userName,
      recipeCount,
      spreadWidth: coverSpreadWidth,
      spreadHeight: coverSpreadHeight,
      frontWidth,
      frontHeight,
      frontLeft,
      frontTop,
      backWidth,
      backHeight,
      backLeft,
      backTop,
      spineWidth: spine,
      spineHeight,
      spineLeft,
      spineTop,
    });

    const coverPage = await this.browser.newPage();
    let coverPdfBuffer: Buffer;
    try {
      await coverPage.setViewport({
        width: Math.round((coverSpreadWidth / 25.4) * 96),
        height: Math.round((coverSpreadHeight / 25.4) * 96),
        deviceScaleFactor: 3,
      });
      await coverPage.setContent(coverHtml, { waitUntil: 'networkidle0' });
      const coverPdf = await coverPage.pdf({
        width: `${coverSpreadWidth}mm`,
        height: `${coverSpreadHeight}mm`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      coverPdfBuffer = Buffer.from(coverPdf);
    } finally {
      await coverPage.close();
    }

    // ── 2. Générer les pages intérieures ──
    const interiorHtml = this.compiledPrintTemplate({
      recipes,
      blankPages,
    });

    const interiorPage = await this.browser.newPage();
    let interiorPdfBuffer: Buffer;
    try {
      // Viewport en pixels pour A5 + bleed
      await interiorPage.setViewport({
        width: Math.round((interiorWidth / 25.4) * 96), // ~583px
        height: Math.round((interiorHeight / 25.4) * 96), // ~817px
        deviceScaleFactor: 3,
      });
      await interiorPage.setContent(interiorHtml, {
        waitUntil: 'networkidle0',
      });
      const interiorPdf = await interiorPage.pdf({
        width: `${interiorWidth}mm`,
        height: `${interiorHeight}mm`,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      interiorPdfBuffer = Buffer.from(interiorPdf);
    } finally {
      await interiorPage.close();
    }

    this.logger.log(
      `PDFs générés: cover spread (${coverSpreadWidth.toFixed(1)}x${coverSpreadHeight.toFixed(1)}mm, spine=${spine}mm) + ${recipeCount + blankPagesCount} pages intérieures (${interiorWidth.toFixed(1)}x${interiorHeight.toFixed(1)}mm)`,
    );

    return { coverPdf: coverPdfBuffer, interiorPdf: interiorPdfBuffer };
  }
}
