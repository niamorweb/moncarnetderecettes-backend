import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from 'prisma/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = env('DATABASE_URL');

    const pool = new Pool({
      connectionString: connectionString,
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Connexion à PostgreSQL réussie !');
    } catch (error) {
      console.error('❌ Erreur de connexion à la base de données:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
