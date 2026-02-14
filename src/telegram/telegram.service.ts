import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { RedisService } from "../redis/redis.service";

interface UserState {
  authToken: string;
  awaitingContact: boolean;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot;
  private readonly userStates = new Map<number, UserState>();

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const token = this.configService.get<string>("TELEGRAM_BOT_TOKEN");
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not defined");
    }
    this.bot = new Bot(token);
  }

  async onModuleInit() {
    // Initialize bot (required for webhook mode)
    await this.bot.init();
    this.logger.log(`Bot initialized: @${this.bot.botInfo.username}`);

    this.setupHandlers();
    await this.setupWebhook();
  }

  private setupHandlers() {
    // Handle /start command with auth token
    this.bot.command("start", async (ctx) => {
      this.logger.log(`Received /start command from user ${ctx.from?.id}`);
      this.logger.log(`ctx.match value: "${ctx.match}"`);
      this.logger.log(`Full message text: "${ctx.message?.text}"`);

      const authToken = ctx.match;

      if (!authToken) {
        this.logger.log("No auth token provided, sending welcome message");
        await ctx.reply(
          "Welcome to Phytotree Bot! This bot is used for authentication.",
        );
        return;
      }

      this.logger.log(`Looking up auth session for token: ${authToken}`);
      // Check if auth session exists
      const session = await this.redisService.getAuthSession(authToken);
      this.logger.log(
        `Session found: ${session ? JSON.stringify(session) : "null"}`,
      );

      if (!session) {
        await ctx.reply(
          "❌ Authorization link has expired or is invalid.\n\nPlease request a new link from the website.",
        );
        return;
      }

      if (session.status !== "pending") {
        await ctx.reply(
          "⚠️ This authorization link has already been used.\n\nPlease request a new link if needed.",
        );
        return;
      }

      // Store the auth token for this user
      this.userStates.set(ctx.from!.id, {
        authToken,
        awaitingContact: false,
      });

      // Show confirmation buttons
      const keyboard = new InlineKeyboard()
        .text("✅ Confirm Login", "confirm_login")
        .text("❌ Cancel", "cancel_login");

      await ctx.reply(
        `🔐 *Authorization Request*\n\nYou are about to log in to Phytotree.\n\nDo you want to continue?`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        },
      );
    });

    // Handle Confirm button
    this.bot.callbackQuery("confirm_login", async (ctx) => {
      await ctx.answerCallbackQuery();

      const userId = ctx.from.id;
      const state = this.userStates.get(userId);

      if (!state) {
        await ctx.editMessageText(
          "❌ Session expired. Please start over from the website.",
        );
        return;
      }

      // Check if session still exists
      const session = await this.redisService.getAuthSession(state.authToken);
      if (!session || session.status !== "pending") {
        await ctx.editMessageText(
          "❌ Authorization link has expired. Please request a new one.",
        );
        this.userStates.delete(userId);
        return;
      }

      // Request contact for phone number
      state.awaitingContact = true;
      this.userStates.set(userId, state);

      const contactKeyboard = new Keyboard()
        .requestContact("📱 Share Phone Number")
        .resized()
        .oneTime();

      await ctx.editMessageText(
        "📱 *Phone Number Required*\n\nTo complete the login, please share your phone number by clicking the button below.",
        { parse_mode: "Markdown" },
      );

      await ctx.reply("Please share your phone number:", {
        reply_markup: contactKeyboard,
      });
    });

    // Handle Cancel button
    this.bot.callbackQuery("cancel_login", async (ctx) => {
      await ctx.answerCallbackQuery();

      const userId = ctx.from.id;
      this.userStates.delete(userId);

      await ctx.editMessageText("❌ Authorization cancelled.");
    });

    // Handle contact share
    this.bot.on("message:contact", async (ctx) => {
      const userId = ctx.from.id;
      const state = this.userStates.get(userId);

      if (!state || !state.awaitingContact) {
        return;
      }

      const contact = ctx.message.contact;

      // Verify that the contact belongs to the sender
      if (contact.user_id !== userId) {
        await ctx.reply(
          "❌ Please share your own phone number, not someone else's.",
        );
        return;
      }

      // Check if session still exists
      const session = await this.redisService.getAuthSession(state.authToken);
      if (!session || session.status !== "pending") {
        await ctx.reply(
          "❌ Authorization link has expired. Please request a new one from the website.",
          { reply_markup: { remove_keyboard: true } },
        );
        this.userStates.delete(userId);
        return;
      }

      // Get user profile photo
      let photoUrl: string | null = null;
      try {
        const photos = await ctx.api.getUserProfilePhotos(userId, {
          limit: 1,
        });
        if (photos.total_count > 0 && photos.photos[0]?.length > 0) {
          const photo = photos.photos[0][photos.photos[0].length - 1]; // Get largest size
          const file = await ctx.api.getFile(photo.file_id);
          if (file.file_path) {
            const botToken =
              this.configService.get<string>("TELEGRAM_BOT_TOKEN");
            photoUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to get profile photo for user ${userId}:`,
          error,
        );
      }

      // Call backend to confirm auth
      await this.confirmAuthOnBackend({
        authToken: state.authToken,
        telegramUserId: userId.toString(),
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name ?? null,
        username: ctx.from.username ?? null,
        photoUrl,
        phoneNumber: contact.phone_number,
      });

      // Clean up state
      this.userStates.delete(userId);

      await ctx.reply(
        "✅ *Login Successful!*\n\nYou can now return to the website. You will be logged in automatically.",
        {
          parse_mode: "Markdown",
          reply_markup: { remove_keyboard: true },
        },
      );
    });

    // Error handler
    this.bot.catch((err) => {
      this.logger.error("Bot error:", err);
    });
  }

  private async setupWebhook() {
    const domain = this.configService.get<string>("WEBHOOK_DOMAIN");
    const path = this.configService.get<string>("WEBHOOK_PATH");

    if (!domain || !path) {
      this.logger.warn(
        "WEBHOOK_DOMAIN or WEBHOOK_PATH not configured, skipping webhook setup",
      );
      return;
    }

    const webhookUrl = `${domain}${path}`;

    try {
      await this.bot.api.setWebhook(webhookUrl, {
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });
      this.logger.log(`Webhook set to: ${webhookUrl}`);
    } catch (error) {
      this.logger.error("Failed to set webhook:", error);
    }
  }

  /**
   * Handle incoming webhook updates
   */
  async handleUpdate(update: unknown): Promise<void> {
    this.logger.log(`Received update: ${JSON.stringify(update)}`);
    try {
      await this.bot.handleUpdate(
        update as Parameters<typeof this.bot.handleUpdate>[0],
      );
      this.logger.log("Update processed successfully");
    } catch (error) {
      this.logger.error("Error processing update:", error);
      throw error;
    }
  }

  /**
   * Confirm auth on backend
   */
  private async confirmAuthOnBackend(data: {
    authToken: string;
    telegramUserId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    phoneNumber: string;
  }): Promise<void> {
    // Update Redis session directly (same process)
    await this.redisService.updateAuthSession(data.authToken, {
      status: "confirmed",
      telegramUserId: data.telegramUserId,
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      photoUrl: data.photoUrl,
      phoneNumber: data.phoneNumber,
    });
  }

  /**
   * Get bot info
   */
  async getBotInfo() {
    const [me, webhookInfo] = await Promise.all([
      this.bot.api.getMe(),
      this.bot.api.getWebhookInfo(),
    ]);
    return {
      bot: me,
      webhook: webhookInfo,
    };
  }
}
