import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
