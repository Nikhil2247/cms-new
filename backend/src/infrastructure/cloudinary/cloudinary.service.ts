import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  crop?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Upload an image to Cloudinary
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<UploadApiResponse> {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [
              { quality: 'auto' },
              { fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) {
              this.logger.error('Failed to upload image', error);
              reject(error);
            } else {
              this.logger.log(`Image uploaded successfully: ${result.public_id}`);
              resolve(result);
            }
          },
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    } catch (error) {
      this.logger.error('Failed to upload image to Cloudinary', error.stack);
      throw error;
    }
  }

  /**
   * Upload a document to Cloudinary
   */
  async uploadDocument(
    file: Express.Multer.File,
    folder: string = 'documents',
  ): Promise<UploadApiResponse> {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'raw',
          },
          (error, result) => {
            if (error) {
              this.logger.error('Failed to upload document', error);
              reject(error);
            } else {
              this.logger.log(`Document uploaded successfully: ${result.public_id}`);
              resolve(result);
            }
          },
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    } catch (error) {
      this.logger.error('Failed to upload document to Cloudinary', error.stack);
      throw error;
    }
  }

  /**
   * Upload an in-memory buffer to Cloudinary.
   * Useful for generated reports (PDF/Excel/CSV).
   */
  async uploadBuffer(
    buffer: Buffer,
    options: Record<string, unknown> = {},
  ): Promise<UploadApiResponse> {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            ...options,
          },
          (error, result) => {
            if (error) {
              this.logger.error('Failed to upload buffer', error);
              reject(error);
            } else {
              resolve(result);
            }
          },
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
    } catch (error) {
      this.logger.error('Failed to upload buffer to Cloudinary', error.stack);
      throw error;
    }
  }

  /**
   * Delete a resource from Cloudinary
   */
  async deleteResource(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });

      if (result.result === 'ok') {
        this.logger.log(`Resource deleted successfully: ${publicId}`);
      } else {
        this.logger.warn(`Failed to delete resource: ${publicId}`, result);
      }
    } catch (error) {
      this.logger.error('Failed to delete resource from Cloudinary', error.stack);
      throw error;
    }
  }

  /**
   * Optimize an image with transformations
   */
  async optimizeImage(url: string, options: OptimizeOptions): Promise<string> {
    try {
      const { width, height, quality = 80, format = 'auto', crop = 'fill' } = options;

      const publicId = this.extractPublicId(url);

      const optimizedUrl = cloudinary.url(publicId, {
        width,
        height,
        quality,
        format,
        crop,
        fetch_format: 'auto',
      });

      this.logger.log(`Image optimized: ${publicId}`);
      return optimizedUrl;
    } catch (error) {
      this.logger.error('Failed to optimize image', error.stack);
      throw error;
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string = 'uploads',
  ): Promise<UploadApiResponse[]> {
    try {
      const uploadPromises = files.map((file) => this.uploadImage(file, folder));
      const results = await Promise.all(uploadPromises);

      this.logger.log(`${files.length} images uploaded successfully`);
      return results;
    } catch (error) {
      this.logger.error('Failed to upload multiple images', error.stack);
      throw error;
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  private extractPublicId(url: string): string {
    try {
      const parts = url.split('/');
      const uploadIndex = parts.indexOf('upload');

      if (uploadIndex === -1) {
        throw new Error('Invalid Cloudinary URL');
      }

      const pathAfterUpload = parts.slice(uploadIndex + 2).join('/');
      const publicId = pathAfterUpload.split('.')[0];

      return publicId;
    } catch (error) {
      this.logger.error('Failed to extract public ID from URL', error.stack);
      throw error;
    }
  }

  /**
   * Generate a thumbnail from an image
   */
  async generateThumbnail(
    publicId: string,
    width: number = 150,
    height: number = 150,
  ): Promise<string> {
    try {
      const thumbnailUrl = cloudinary.url(publicId, {
        width,
        height,
        crop: 'thumb',
        gravity: 'face',
        quality: 'auto',
        fetch_format: 'auto',
      });

      this.logger.log(`Thumbnail generated for: ${publicId}`);
      return thumbnailUrl;
    } catch (error) {
      this.logger.error('Failed to generate thumbnail', error.stack);
      throw error;
    }
  }
}
