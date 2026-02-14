import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { TelegramService } from "./telegram.service";

@Controller("telegram")
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Telegram webhook endpoint
   * Receives updates from Telegram
   */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: unknown): Promise<void> {
    this.logger.log(`Webhook received: ${JSON.stringify(update)}`);
    await this.telegramService.handleUpdate(update);
  }

  /**
   * Debug endpoint to get bot info
   */
  @Get("bot-info")
  async getBotInfo() {
    return this.telegramService.getBotInfo();
  }
}
