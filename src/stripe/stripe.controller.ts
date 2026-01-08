// src/stripe/stripe.controller.ts
import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('stripe')
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') sig: string,
  ) {
    let event;

    try {
      event = this.stripeService.verifyWebhook(req.rawBody, sig);
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // Activation de l'abonnement
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const stripeCustomerId = session.customer as string;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isPremium: true,
          stripeCustomerId: stripeCustomerId,
          premiumEndsAt: null,
        },
      });
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;

      // Si l'utilisateur vient de demander l'annulation
      if (subscription.cancel_at_period_end) {
        const endDate = new Date(subscription.current_period_end * 1000);
        await this.prisma.user.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: { premiumEndsAt: endDate },
        });
      }
      // Si l'utilisateur a changé d'avis et a cliqué sur "Réactiver"
      else {
        await this.prisma.user.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: { premiumEndsAt: null },
        });
      }
    }

    // Désactivation de l'abonnement
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer as string;

      await this.prisma.user.update({
        where: { stripeCustomerId: stripeCustomerId },
        data: { isPremium: false },
      });
    }

    return { received: true };
  }

  @Post('create-checkout')
  @UseGuards(AuthGuard('jwt'))
  async createCheckout(@Req() req: any) {
    const userId = req.user.userId;

    const session = await this.stripeService.createCheckoutSession(userId);

    // Return url de paiement stripe
    return { url: session.url };
  }

  @Post('cancel-subscription')
  @UseGuards(AuthGuard('jwt'))
  async cancel(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      throw new BadRequestException('Aucun utilisateur trouvé');
    }
    if (!user.stripeCustomerId) {
      throw new BadRequestException('Aucun abonnement trouvé');
    }

    await this.stripeService.cancelSubscription(user.stripeCustomerId);

    return {
      message: 'Votre abonnement ne sera pas renouvelé à la fin du mois.',
    };
  }
}
