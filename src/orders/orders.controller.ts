import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from '@nestjs/passport';
import { EmailVerifiedGuard } from 'src/guards/email-verified.guard';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
  create(@Req() req, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(req.user.userId, createOrderDto);
  }

  @Post('draft')
  @UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
  createDraft(@Req() req, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createDraft(req.user.userId, createOrderDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
  findAll(@Req() req) {
    return this.ordersService.findAll(req.user.userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), EmailVerifiedGuard)
  findOne(@Req() req, @Param('id') id: string) {
    return this.ordersService.findOne(req.user.userId, id);
  }

  // Webhook Lulu (pas d'auth JWT)
  @Post('webhooks/lulu')
  async handleLuluWebhook(
    @Body() body: any,
  ) {
    this.logger.log(`Webhook Lulu reçu: ${JSON.stringify(body)}`);

    await this.ordersService.handleLuluWebhook(body);

    return { received: true };
  }
}
