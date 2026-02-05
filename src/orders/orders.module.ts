import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RecipesModule } from 'src/recipes/recipes.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { LuluModule } from 'src/lulu/lulu.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    PrismaModule,
    RecipesModule,
    forwardRef(() => StripeModule),
    LuluModule,
    S3Module,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
