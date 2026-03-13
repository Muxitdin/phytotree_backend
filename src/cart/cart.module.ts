import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
