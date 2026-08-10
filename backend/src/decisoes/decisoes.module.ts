import { Module } from '@nestjs/common';
import { DecisoesController } from './decisoes.controller';
import { DecisoesService } from './decisoes.service';
import { DocumentoTextoService } from './documento-texto.service';

@Module({
  controllers: [DecisoesController],
  providers: [DecisoesService, DocumentoTextoService],
  exports: [DecisoesService],
})
export class DecisoesModule {}
