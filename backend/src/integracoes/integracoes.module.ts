import { Module } from '@nestjs/common';
import { DecisoesModule } from '../decisoes';
import { IntegracaoSeeuMockController } from './integracao-seeu-mock.controller';

@Module({
  imports: [DecisoesModule],
  controllers: [IntegracaoSeeuMockController],
})
export class IntegracoesModule {}
