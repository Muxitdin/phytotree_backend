import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { User, Role } from "../generated/prisma/client";

export interface CreateUserData {
  telegramUserId: bigint;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  phoneNumber?: string | null;
  role?: Role;
}

export interface UpdateUserData {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  phoneNumber?: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTelegramUserId(telegramUserId: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramUserId },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        telegramUserId: data.telegramUserId,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        photoUrl: data.photoUrl,
        phoneNumber: data.phoneNumber,
        role: data.role ?? Role.CUSTOMER,
      },
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        photoUrl: data.photoUrl,
        phoneNumber: data.phoneNumber,
      },
    });
  }

  async findOrCreateByTelegram(
    telegramUserId: bigint,
    profileData: UpdateUserData,
  ): Promise<{ user: User; isNew: boolean }> {
    const existingUser = await this.findByTelegramUserId(telegramUserId);

    if (existingUser) {
      // Update profile data if changed
      const updatedUser = await this.update(existingUser.id, profileData);
      return { user: updatedUser, isNew: false };
    }

    // Create new user
    const newUser = await this.create({
      telegramUserId,
      ...profileData,
    });

    return { user: newUser, isNew: true };
  }
}
