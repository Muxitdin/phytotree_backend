import { Module } from "@nestjs/common";
import { ClickController } from "./click.controller";
import { ClickService } from "./click.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ClickController],
  providers: [ClickService],
  exports: [ClickService],
})
export class ClickModule {}
