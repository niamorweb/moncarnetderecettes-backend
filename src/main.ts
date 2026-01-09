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
    origin: (origin, callback) => {
      // Liste des domaines autorisés (SANS SLASH À LA FIN)
      const allowedOrigins = [
        'http://localhost:3000',
        'https://moncarnetderecettes.vercel.app',
        'https://www.moncarnetderecettes.vercel.app',
      ];

      // Si pas d'origine (ex: appel serveur à serveur ou Postman) ou si l'origine est dans la liste
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(
          `❌ CORS BLOQUÉ : L'origine "${origin}" n'est pas autorisée !`,
        );
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
