import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: Express.Multer.File) {
    const compressedImageBuffer = await sharp(file.buffer)
      .resize(800, 800, { fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'mycook_recipes' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      uploadStream.end(compressedImageBuffer);
    });
  }

  async uploadImageAvatar(file: Express.Multer.File) {
    const compressedImageBuffer = await sharp(file.buffer)
      .resize(400, 400, { fit: 'inside' })
      .webp({ quality: 80 })
      .toBuffer();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'mycook_profiles_avatar' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      uploadStream.end(compressedImageBuffer);
    });
  }

  async deleteImage(publicId: string) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }
}
