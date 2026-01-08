import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Global()
@Module({
  providers: [
    {
      provide: 'RESEND_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Resend(configService.get<string>('RESEND_API_KEY'));
      },
      inject: [ConfigService],
    },
  ],
  exports: ['RESEND_CLIENT'],
})
export class ResendModule {}
