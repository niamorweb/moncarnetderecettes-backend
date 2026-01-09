import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

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

  app.enableCors({
    origin: ['*'],
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: '*',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
