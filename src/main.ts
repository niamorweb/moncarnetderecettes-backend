import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.use(cookieParser());

  app.use(
    bodyParser.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Conversion auto des types
      whitelist: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Mon API NestJS')
    .setDescription('Documentation de mon premier projet Nest')
    .setVersion('1.0')
    .addTag('users')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:8081',
        'http://localhost:19006',
        'https://moncarnetderecettes.vercel.app',
        'https://www.moncarnetderecettes.vercel.app',
      ];

      const devPatterns = [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
        /^exp:\/\//,
      ];

      const isDev = process.env.NODE_ENV !== 'production';
      const isDevOrigin =
        isDev && devPatterns.some((p) => p.test(origin || ''));

      if (!origin || allowedOrigins.includes(origin) || isDevOrigin) {
        callback(null, true);
      } else {
        console.log(`❌ CORS BLOQUÉ : ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
