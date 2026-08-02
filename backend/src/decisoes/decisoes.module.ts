import { Module } from '@nestjs/common';
import { DecisoesController } from './decisoes.controller';
import { DecisoesService } from './decisoes.service';

@Module({
  controllers: [DecisoesController],
  providers: [DecisoesService],
})
export class DecisoesModule {}
