import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import {
  OrderStatus,
  PaymentStatus,
  PaymentProvider,
} from "../../generated/prisma/enums";
import {
  ClickPrepareDto,
  ClickCompleteDto,
  ClickPrepareResponse,
  ClickCompleteResponse,
} from "./dto";
import { ClickError, ClickErrorMessages, ClickAction } from "./enums";
import { validateClickSignature } from "./utils";

@Injectable()
export class ClickService {
  private readonly logger = new Logger(ClickService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async prepare(dto: ClickPrepareDto): Promise<ClickPrepareResponse> {
    this.logger.log(`Prepare request received: ${JSON.stringify(dto)}`);

    // 1. Validate signature
    const secretKey = this.configService.get<string>("CLICK_SECRET_KEY") ?? "";
    const isValidSign = validateClickSignature(
      {
        clickTransId: dto.click_trans_id,
        serviceId: dto.service_id.toString(),
        merchantTransId: dto.merchant_trans_id,
        amount: dto.amount,
        action: dto.action,
        signTime: dto.sign_time,
        signString: dto.sign_string,
      },
      secretKey,
    );

    if (!isValidSign) {
      this.logger.warn(
        `Invalid signature for transaction ${dto.click_trans_id}`,
      );
      return this.prepareErrorResponse(dto, ClickError.SignCheckFailed);
    }

    // 2. Validate action
    if (dto.action !== (ClickAction.Prepare as number)) {
      this.logger.warn(`Invalid action ${dto.action} for prepare request`);
      return this.prepareErrorResponse(dto, ClickError.ActionNotFound);
    }

    // 3. Find order
    const order = await this.prisma.order.findUnique({
      where: { id: dto.merchant_trans_id },
      include: { payments: true },
    });

    if (!order) {
      this.logger.warn(`Order not found: ${dto.merchant_trans_id}`);
      return this.prepareErrorResponse(dto, ClickError.OrderNotFound);
    }

    // 4. Validate amount
    if (Number(order.totalAmount) !== dto.amount) {
      this.logger.warn(
        `Amount mismatch: expected ${String(order.totalAmount)}, got ${dto.amount}`,
      );
      return this.prepareErrorResponse(dto, ClickError.InvalidAmount);
    }

    // 5. Check if already paid
    if (order.status === OrderStatus.PAID) {
      this.logger.warn(`Order ${order.id} is already paid`);
      return this.prepareErrorResponse(dto, ClickError.AlreadyPaid);
    }

    // 6. Check for existing cancelled transaction
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        clickTransId: BigInt(dto.click_trans_id),
      },
    });

    if (existingPayment?.status === PaymentStatus.CANCELLED) {
      this.logger.warn(`Transaction ${dto.click_trans_id} was cancelled`);
      return this.prepareErrorResponse(dto, ClickError.TransactionCancelled);
    }

    // 7. Create payment record
    const prepareId = Date.now().toString();

    try {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.CLICK,
          status: PaymentStatus.PROCESSING,
          amount: dto.amount,
          clickTransId: BigInt(dto.click_trans_id),
          clickPaydocId: BigInt(dto.click_paydoc_id),
          merchantPrepareId: prepareId,
          prepareTime: new Date(),
          rawPrepareRequest: dto as object,
        },
      });

      // 8. Update order status
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.AWAITING_PAYMENT },
      });

      this.logger.log(
        `Prepare successful for order ${order.id}, prepareId: ${prepareId}`,
      );

      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_prepare_id: prepareId,
        error: ClickError.Success,
        error_note: ClickErrorMessages[ClickError.Success],
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error creating payment: ${errorMessage}`);
      return this.prepareErrorResponse(dto, ClickError.UpdateFailed);
    }
  }

  async complete(dto: ClickCompleteDto): Promise<ClickCompleteResponse> {
    this.logger.log(`Complete request received: ${JSON.stringify(dto)}`);

    // 1. Validate signature
    const secretKey = this.configService.get<string>("CLICK_SECRET_KEY") ?? "";
    const isValidSign = validateClickSignature(
      {
        clickTransId: dto.click_trans_id,
        serviceId: dto.service_id.toString(),
        merchantTransId: dto.merchant_trans_id,
        merchantPrepareId: dto.merchant_prepare_id,
        amount: dto.amount,
        action: dto.action,
        signTime: dto.sign_time,
        signString: dto.sign_string,
      },
      secretKey,
    );

    if (!isValidSign) {
      this.logger.warn(
        `Invalid signature for transaction ${dto.click_trans_id}`,
      );
      return this.completeErrorResponse(dto, ClickError.SignCheckFailed);
    }

    // 2. Validate action
    if (dto.action !== (ClickAction.Complete as number)) {
      this.logger.warn(`Invalid action ${dto.action} for complete request`);
      return this.completeErrorResponse(dto, ClickError.ActionNotFound);
    }

    // 3. Find payment by prepare_id
    const payment = await this.prisma.payment.findFirst({
      where: {
        merchantPrepareId: dto.merchant_prepare_id,
        orderId: dto.merchant_trans_id,
      },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(
        `Payment not found for prepareId: ${dto.merchant_prepare_id}`,
      );
      return this.completeErrorResponse(dto, ClickError.TransactionNotFound);
    }

    // 4. Validate amount
    if (Number(payment.amount) !== dto.amount) {
      this.logger.warn(
        `Amount mismatch: expected ${String(payment.amount)}, got ${dto.amount}`,
      );
      return this.completeErrorResponse(dto, ClickError.InvalidAmount);
    }

    // 5. Check if already completed
    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.warn(`Payment ${payment.id} is already completed`);
      return this.completeErrorResponse(dto, ClickError.AlreadyPaid);
    }

    // 6. Check if cancelled
    if (payment.status === PaymentStatus.CANCELLED) {
      this.logger.warn(`Payment ${payment.id} was cancelled`);
      return this.completeErrorResponse(dto, ClickError.TransactionCancelled);
    }

    const confirmId = Date.now().toString();

    try {
      // 7. Handle cancellation from Click (error < 0)
      if (dto.error < 0) {
        this.logger.log(`Payment cancelled by Click with error: ${dto.error}`);

        await this.prisma.$transaction([
          this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.CANCELLED,
              cancelTime: new Date(),
              cancelReason: dto.error,
              rawCompleteRequest: dto as object,
            },
          }),
          this.prisma.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.CANCELLED },
          }),
        ]);

        return {
          click_trans_id: dto.click_trans_id,
          merchant_trans_id: dto.merchant_trans_id,
          merchant_confirm_id: confirmId,
          error: ClickError.Success,
          error_note: ClickErrorMessages[ClickError.Success],
        };
      }

      // 8. Successful payment
      this.logger.log(
        `Processing successful payment for order ${payment.orderId}`,
      );

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            merchantConfirmId: confirmId,
            completeTime: new Date(),
            rawCompleteRequest: dto as object,
          },
        }),
        this.prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: OrderStatus.PAID,
            paidAt: new Date(),
          },
        }),
      ]);

      this.logger.log(
        `Payment completed successfully for order ${payment.orderId}`,
      );

      // TODO: Send notification to user via Telegram
      // TODO: Send notification to admin

      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        merchant_confirm_id: confirmId,
        error: ClickError.Success,
        error_note: ClickErrorMessages[ClickError.Success],
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error completing payment: ${errorMessage}`);
      return this.completeErrorResponse(dto, ClickError.UpdateFailed);
    }
  }

  private prepareErrorResponse(
    dto: ClickPrepareDto,
    error: ClickError,
  ): ClickPrepareResponse {
    return {
      click_trans_id: dto.click_trans_id,
      merchant_trans_id: dto.merchant_trans_id,
      merchant_prepare_id: null,
      error,
      error_note: ClickErrorMessages[error],
    };
  }

  private completeErrorResponse(
    dto: ClickCompleteDto,
    error: ClickError,
  ): ClickCompleteResponse {
    return {
      click_trans_id: dto.click_trans_id,
      merchant_trans_id: dto.merchant_trans_id,
      merchant_confirm_id: null,
      error,
      error_note: ClickErrorMessages[error],
    };
  }
}
