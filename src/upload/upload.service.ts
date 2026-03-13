import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";

export interface UploadSignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
}

export type UploadFolder = "products" | "categories" | "users";

@Injectable()
export class UploadService {
  constructor(private readonly configService: ConfigService) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.configService.get<string>("CLOUDINARY_API_KEY"),
      api_secret: this.configService.get<string>("CLOUDINARY_API_SECRET"),
    });
  }

  /**
   * Generate a signed upload signature for direct browser upload
   */
  generateSignature(folder: UploadFolder): UploadSignature {
    const timestamp = Math.round(Date.now() / 1000);
    const folderPath = `phytotree/${folder}`;

    // Parameters that will be signed
    const paramsToSign = {
      timestamp,
      folder: folderPath,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.configService.get<string>("CLOUDINARY_API_SECRET")!,
    );

    return {
      signature,
      timestamp,
      cloudName: this.configService.get<string>("CLOUDINARY_CLOUD_NAME")!,
      apiKey: this.configService.get<string>("CLOUDINARY_API_KEY")!,
      folder: folderPath,
    };
  }

  /**
   * Generate signature for multiple image upload
   */
  generateMultipleSignature(
    folder: UploadFolder,
    count: number,
  ): UploadSignature[] {
    if (count < 1 || count > 10) {
      throw new BadRequestException("Count must be between 1 and 10");
    }

    return Array.from({ length: count }, () => this.generateSignature(folder));
  }

  /**
   * Delete an image from Cloudinary by public_id
   */
  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Delete multiple images from Cloudinary
   */
  async deleteImages(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0) return;

    try {
      await cloudinary.api.delete_resources(publicIds);
    } catch {
      // Log error but don't throw - cleanup failures shouldn't break the app
    }
  }

  /**
   * Extract public_id from Cloudinary URL
   * Example: https://res.cloudinary.com/demo/image/upload/v1234567890/phytotree/products/abc123.jpg
   * Returns: phytotree/products/abc123
   */
  extractPublicId(url: string): string | null {
    try {
      const regex = /\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
