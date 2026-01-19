import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Ajuste le chemin selon ton projet
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto) {
    // On crée la commande en liant l'utilisateur et l'adresse de livraison
    return this.prisma.order.create({
      data: {
        userId: userId,
        amountTotal: dto.amountTotal,
        currency: dto.currency || 'eur',
        status: OrderStatus.PENDING,
        quantity: dto.quantity || 1,
        printOptions: dto.printOptions as any, // On stocke le JSON de Gelato
        pdfUrl: dto.pdfUrl,
        shippingAddress: {
          create: {
            ...dto.shippingAddress,
          },
        },
      },
      include: {
        shippingAddress: true, // On retourne l'adresse avec la commande
      },
    });
  }

  // On filtre par userId pour que l'utilisateur ne voit que SES commandes
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

    // Sécurité : Vérifier que la commande appartient bien à l'user
    if (order.userId !== userId) {
      throw new ForbiddenException('Vous n’avez pas accès à cette commande');
    }

    return order;
  }

  // Utile pour les Webhooks Stripe ou Gelato (màj du statut)
  async updateStatus(id: string, status: OrderStatus, externalId?: string) {
    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        externalOrderId: externalId,
      },
    });
  }
}
