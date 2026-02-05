import { Module } from '@nestjs/common';
import { GelatoService } from './gelato.service';

@Module({
  providers: [GelatoService],
  exports: [GelatoService],
})
export class GelatoModule {}