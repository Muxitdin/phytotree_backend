import { Module } from "@nestjs/common";
import { ClickModule } from "./click/click.module";

@Module({
  imports: [ClickModule],
  exports: [ClickModule],
})
export class PaymentsModule {}
