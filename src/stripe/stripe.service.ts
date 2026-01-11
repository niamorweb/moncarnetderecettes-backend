import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16' as any,
    });
  }

  // Cette méthode valide la signature Stripe
  verifyWebhook(rawBody: Buffer, sig: string) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  }

  async createCheckoutSession(userId: string) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Pass Premium MyCook',
              description:
                'Accès illimité aux recettes publiques et fonctionnalités avancées',
            },
            unit_amount: 499,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      client_reference_id: userId,
      success_url:
        process.env.FRONTEND_URL || `http://localhost:3000/payment-success`,
      cancel_url:
        process.env.FRONTEND_URL || `http://localhost:3000/payment-cancel`,
      metadata: {
        userId: userId,
      },
    });

    return session;
  }

  async cancelSubscription(stripeCustomerId: string) {
    // Récupération abonnements actif du client
    const subscriptions = await this.stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
    });

    if (subscriptions.data.length === 0) return null;

    // Demande à Stripe de ne pas renouveler l'abonnement
    return await this.stripe.subscriptions.update(subscriptions.data[0].id, {
      cancel_at_period_end: true,
    });
  }
}
