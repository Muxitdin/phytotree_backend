import { Module } from "@nestjs/common";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [WishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
