import { Module } from '@nestjs/common';
import { LuluService } from './lulu.service';

@Module({
  providers: [LuluService],
  exports: [LuluService],
})
export class LuluModule {}
