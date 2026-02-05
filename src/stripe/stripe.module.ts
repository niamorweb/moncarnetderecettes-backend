import { Module, forwardRef } from '@nestjs/common';
import { StripeWebhookController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersModule } from 'src/orders/orders.module';

@Module({
  imports: [PrismaModule, forwardRef(() => OrdersModule)],
  controllers: [StripeWebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
