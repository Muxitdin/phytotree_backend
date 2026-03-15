import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { OrderStatus } from "../generated/prisma/enums";
import { CreateOrderDto, OrderQueryDto } from "./dto";

const orderInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          images: true,
        },
      },
    },
  },
  payments: {
    select: {
      id: true,
      provider: true,
      status: true,
      amount: true,
      createdAt: true,
      completeTime: true,
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createFromCart(userId: string, dto: CreateOrderDto) {
    // Get user's cart
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: true,
      },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    // Check all products are in stock
    const outOfStockProducts = cartItems.filter(
      (item) => !item.product.inStock,
    );
    if (outOfStockProducts.length > 0) {
      throw new BadRequestException(
        `Some products are out of stock: ${outOfStockProducts.map((item) => item.product.nameRu).join(", ")}`,
      );
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    const shippingCost = 0; // Free shipping for now
    const totalAmount = subtotal + shippingCost;

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order with items in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          shippingAddress: dto.shippingAddress,
          shippingCity: dto.shippingCity,
          shippingNote: dto.shippingNote,
          subtotal,
          shippingCost,
          totalAmount,
          status: OrderStatus.PENDING,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              productName: item.product.nameRu, // Store Russian name as default
              productPrice: item.product.price,
              quantity: item.quantity,
              totalPrice: Number(item.product.price) * item.quantity,
            })),
          },
        },
        include: orderInclude,
      });

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { userId },
      });

      return newOrder;
    });

    return order;
  }

  async getUserOrders(userId: string, query: OrderQueryDto) {
    const take = 10;

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
    };

    const orders = await this.prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(query.cursor && {
        cursor: { id: query.cursor },
        skip: 1,
      }),
    });

    const hasMore = orders.length > take;
    const items = hasMore ? orders.slice(0, take) : orders;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (order.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    return order;
  }

  async getOrderByIdInternal(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  async generateClickPaymentUrl(userId: string, orderId: string) {
    const order = await this.getOrderById(userId, orderId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot pay for order with status: ${order.status}`,
      );
    }

    const serviceId = this.configService.get<string>("CLICK_SERVICE_ID");
    const merchantId = this.configService.get<string>("CLICK_MERCHANT_ID");
    const returnUrl = this.configService.get<string>("CLICK_RETURN_URL");

    if (!serviceId || !merchantId || !returnUrl) {
      throw new BadRequestException("Payment gateway not configured");
    }

    const params = new URLSearchParams({
      service_id: serviceId,
      merchant_id: merchantId,
      amount: order.totalAmount.toString(),
      transaction_param: order.id,
      return_url: returnUrl,
    });

    const paymentUrl = `https://my.click.uz/services/pay?${params.toString()}`;

    return {
      paymentUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.totalAmount,
    };
  }

  async checkPaymentStatus(userId: string, orderId: string) {
    const order = await this.getOrderById(userId, orderId);

    const latestPayment = await this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      isPaid: order.status === OrderStatus.PAID,
      payment: latestPayment
        ? {
            id: latestPayment.id,
            provider: latestPayment.provider,
            status: latestPayment.status,
            amount: latestPayment.amount,
            paidAt: latestPayment.completeTime,
          }
        : null,
    };
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.getOrderById(userId, orderId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel order with status: ${order.status}`,
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
      include: orderInclude,
    });
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

    const prefix = `PT${year}${month}${day}`;

    // Get today's order count
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const todayOrdersCount = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (todayOrdersCount + 1).toString().padStart(4, "0");

    return `${prefix}-${sequence}`;
  }
}
