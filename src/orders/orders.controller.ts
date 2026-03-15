import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { OrdersService } from "./orders.service";
import { CreateOrderDto, OrderQueryDto } from "./dto";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createFromCart(userId, dto);
  }

  @Get()
  async getOrders(
    @CurrentUser("id") userId: string,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.getUserOrders(userId, query);
  }

  @Get(":orderId")
  async getOrder(
    @CurrentUser("id") userId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.ordersService.getOrderById(userId, orderId);
  }

  @Post(":orderId/pay/click")
  @HttpCode(HttpStatus.OK)
  async payWithClick(
    @CurrentUser("id") userId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.ordersService.generateClickPaymentUrl(userId, orderId);
  }

  @Get(":orderId/payment-status")
  async checkPaymentStatus(
    @CurrentUser("id") userId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.ordersService.checkPaymentStatus(userId, orderId);
  }

  @Delete(":orderId")
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @CurrentUser("id") userId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.ordersService.cancelOrder(userId, orderId);
  }
}
