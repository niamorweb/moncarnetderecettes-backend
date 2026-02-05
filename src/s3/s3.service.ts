import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || 'mycook-pdfs';
    this.region = process.env.AWS_S3_REGION || 'eu-west-3';

    // Utilise automatiquement les credentials du CLI AWS (~/.aws/credentials)
    // ou les env vars AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY si définies
    this.s3 = new S3Client({ region: this.region });
  }

  async uploadPdf(buffer: Buffer, fileName: string): Promise<string> {
    const key = `pdfs/${fileName}.pdf`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    this.logger.log(`PDF uploaded to S3: ${url}`);
    return url;
  }

  async deletePdf(fileName: string): Promise<void> {
    const key = `pdfs/${fileName}.pdf`;

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`PDF deleted from S3: ${key}`);
  }
}
