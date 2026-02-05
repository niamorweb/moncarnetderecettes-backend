import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';
import { RecipesService } from 'src/recipes/recipes.service';
import { StripeService } from 'src/stripe/stripe.service';
import { LuluService } from 'src/lulu/lulu.service';
import { S3Service } from 'src/s3/s3.service';

// Convertit un nom de pays ou code en code ISO 2 lettres
function toCountryCode(country: string): string {
  const map: Record<string, string> = {
    france: 'FR',
    belgique: 'BE',
    belgium: 'BE',
    suisse: 'CH',
    switzerland: 'CH',
    canada: 'CA',
    luxembourg: 'LU',
  };
  const trimmed = country.trim();
  // Si c'est déjà un code 2 lettres
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return map[trimmed.toLowerCase()] || trimmed.toUpperCase();
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipesService: RecipesService,
    private readonly stripeService: StripeService,
    private readonly luluService: LuluService,
    private readonly s3Service: S3Service,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // 1. Créer la commande en DB (status PENDING)
    const order = await this.prisma.order.create({
      data: {
        userId,
        amountTotal: dto.amountTotal,
        currency: dto.currency || 'eur',
        status: OrderStatus.PENDING,
        quantity: dto.quantity || 1,
        printOptions: dto.printOptions as any,
        shippingAddress: {
          create: {
            ...dto.shippingAddress,
          },
        },
      },
      include: { shippingAddress: true },
    });

    // 2. Calculer le pageCount normalisé pour Lulu
    const recipeCount = await this.prisma.recipe.count({ where: { userId } });
    const interiorPageCount =
      this.luluService.normalizePageCount(recipeCount);

    // 3. Calculer le spine width pour Lulu
    const spineWidth = this.luluService.getSpineWidth(interiorPageCount);

    // 4. Générer les 2 PDFs (cover + intérieur) avec les dimensions Lulu
    this.logger.log(
      `Génération des PDFs pour la commande ${order.id} (${recipeCount} recettes, ${interiorPageCount} pages, spine=${spineWidth.toFixed(2)}mm)`,
    );
    const { coverPdf, interiorPdf } =
      await this.recipesService.printAllRecipesPrintReady(
        userId,
        interiorPageCount,
        spineWidth,
      );

    // 5. Upload les 2 PDFs sur S3
    const ts = Date.now();
    const [coverUrl, interiorUrl] = await Promise.all([
      this.s3Service.uploadPdf(coverPdf, `order-${order.id}-cover-${ts}`),
      this.s3Service.uploadPdf(interiorPdf, `order-${order.id}-interior-${ts}`),
    ]);

    // 6. Stocker l'URL intérieur sur la commande
    await this.prisma.order.update({
      where: { id: order.id },
      data: { pdfUrl: interiorUrl },
    });

    // 7. Créer la session Stripe Checkout
    const coverLabel =
      dto.printOptions.coverType === 'hardcover'
        ? 'Couverture rigide'
        : 'Couverture souple';
    const paperLabel =
      dto.printOptions.paperType === 'premium_silk'
        ? 'Papier premium silk'
        : 'Papier standard mat';
    const productLabel = `${coverLabel} - ${paperLabel}`;

    const session = await this.stripeService.createBookCheckoutSession(
      userId,
      order.id,
      dto.amountTotal,
      productLabel,
    );

    // 8. Stocker le stripeSessionId
    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    this.logger.log(
      `Commande ${order.id} créée, redirection Stripe: ${session.url}`,
    );

    return { orderId: order.id, checkoutUrl: session.url };
  }

  // Appelé par le webhook Stripe après paiement réussi
  async handlePaymentSuccess(orderId: string, paymentIntentId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shippingAddress: true, user: true },
    });

    if (!order) {
      this.logger.error(`Commande introuvable: ${orderId}`);
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAID,
        stripePaymentIntentId: paymentIntentId,
      },
    });

    this.logger.log(`Commande ${orderId} payée, envoi vers Lulu...`);

    const address = order.shippingAddress!;
    const interiorUrl = order.pdfUrl!;
    const coverUrl = interiorUrl.replace('-interior-', '-cover-');

    try {
      const luluJob = await this.luluService.createPrintJob({
        coverPdfUrl: coverUrl,
        interiorPdfUrl: interiorUrl,
        externalId: order.id,
        title: 'Mon Carnet de Recettes',
        quantity: order.quantity || 1,
        shippingLevel: 'MAIL',
        contactEmail: order.user.email,
        shippingAddress: {
          name: address.name,
          street1: address.line1,
          street2: address.line2 || undefined,
          city: address.city,
          country_code: toCountryCode(address.country),
          postcode: address.postalCode,
          phone_number: address.phone || '',
        },
      });

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          externalOrderId: String(luluJob.id),
          status: OrderStatus.IN_PRODUCTION,
        },
      });

      this.logger.log(
        `Print job Lulu créé: ${luluJob.id} pour order ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur Lulu pour commande ${orderId}: ${error.message}`,
      );
    }
  }

  // Appelé par le webhook Lulu
  async handleLuluWebhook(event: {
    id?: number;
    external_id?: string;
    status?: { name: string };
    line_items?: Array<{
      tracking_id?: string;
      tracking_urls?: string[];
    }>;
  }) {
    const order = await this.prisma.order.findFirst({
      where: event.external_id
        ? { id: event.external_id }
        : { externalOrderId: String(event.id) },
    });

    if (!order) {
      this.logger.warn(
        `Webhook Lulu: commande introuvable id=${event.id}, externalId=${event.external_id}`,
      );
      return;
    }

    const updateData: any = {};

    if (event.status?.name) {
      const statusMap: Record<string, OrderStatus> = {
        CREATED: OrderStatus.IN_PRODUCTION,
        UNPAID: OrderStatus.IN_PRODUCTION,
        PAYMENT_IN_PROGRESS: OrderStatus.IN_PRODUCTION,
        PRODUCTION_READY: OrderStatus.IN_PRODUCTION,
        PRODUCTION_DELAYED: OrderStatus.IN_PRODUCTION,
        IN_PRODUCTION: OrderStatus.IN_PRODUCTION,
        SHIPPED: OrderStatus.SHIPPED,
        DELIVERED: OrderStatus.DELIVERED,
        CANCELED: OrderStatus.CANCELLED,
        REJECTED: OrderStatus.CANCELLED,
      };

      const mappedStatus = statusMap[event.status.name];
      if (mappedStatus) {
        updateData.status = mappedStatus;
      }
    }

    const trackingInfo = event.line_items?.[0];
    if (trackingInfo?.tracking_id) {
      updateData.trackingNumber = trackingInfo.tracking_id;
    }
    if (trackingInfo?.tracking_urls?.[0]) {
      updateData.trackingUrl = trackingInfo.tracking_urls[0];
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: updateData,
      });

      this.logger.log(
        `Commande ${order.id} mise à jour via Lulu: ${JSON.stringify(updateData)}`,
      );
    }
  }

  // Créer un draft Lulu pour vérifier le rendu
  async createDraft(userId: string, dto: CreateOrderDto) {
    const recipeCount = await this.prisma.recipe.count({
      where: { userId },
    });
    const interiorPageCount =
      this.luluService.normalizePageCount(recipeCount);
    const spineWidth = this.luluService.getSpineWidth(interiorPageCount);

    this.logger.log(
      `Génération des PDFs draft pour userId: ${userId} (${recipeCount} recettes, ${interiorPageCount} pages, spine=${spineWidth.toFixed(2)}mm)`,
    );
    const { coverPdf, interiorPdf } =
      await this.recipesService.printAllRecipesPrintReady(
        userId,
        interiorPageCount,
        spineWidth,
      );

    const ts = Date.now();
    const [coverUrl, interiorUrl] = await Promise.all([
      this.s3Service.uploadPdf(coverPdf, `draft-${userId}-cover-${ts}`),
      this.s3Service.uploadPdf(interiorPdf, `draft-${userId}-interior-${ts}`),
    ]);

    const address = dto.shippingAddress;

    const luluJob = await this.luluService.createPrintJob({
      coverPdfUrl: coverUrl,
      interiorPdfUrl: interiorUrl,
      externalId: `draft-${ts}`,
      title: 'Mon Carnet de Recettes',
      quantity: 1,
      shippingLevel: 'MAIL',
      contactEmail: 'draft@mycook.com',
      shippingAddress: {
        name: address.name,
        street1: address.line1,
        street2: address.line2 || undefined,
        city: address.city,
        country_code: toCountryCode(address.country),
        postcode: address.postalCode,
        phone_number: address.phone || '',
      },
    });

    this.logger.log(`Draft Lulu créé: ${luluJob.id}`);

    return {
      luluJobId: luluJob.id,
      coverPdfUrl: coverUrl,
      interiorPdfUrl: interiorUrl,
      status: luluJob.status?.name,
    };
  }

  async findAll(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { shippingAddress: true },
    });
  }

  async findOne(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { shippingAddress: true },
    });

    if (!order) throw new NotFoundException('Commande introuvable');

    if (order.userId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à cette commande");
    }

    return order;
  }
}
