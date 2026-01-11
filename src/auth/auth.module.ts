import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './jwt.strategy';
import { env } from 'prisma/config';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret:
        'aojkroajrfoajojvrojarvpojapojrvapoiurvzijravopjvouroaiuvporavpouapiorvropakjxoprxpkera',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
