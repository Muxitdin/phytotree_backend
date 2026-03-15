import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ClickService } from "./click.service";
import { ClickPrepareDto, ClickCompleteDto } from "./dto";

@Controller("payments/click")
@SkipThrottle() // Skip rate limiting for payment callbacks
export class ClickController {
  private readonly logger = new Logger(ClickController.name);

  constructor(private readonly clickService: ClickService) {}

  @Post("prepare")
  @HttpCode(HttpStatus.OK)
  async prepare(@Body() dto: ClickPrepareDto) {
    this.logger.log("Received prepare request from Click");
    return this.clickService.prepare(dto);
  }

  @Post("complete")
  @HttpCode(HttpStatus.OK)
  async complete(@Body() dto: ClickCompleteDto) {
    this.logger.log("Received complete request from Click");
    return this.clickService.complete(dto);
  }
}
