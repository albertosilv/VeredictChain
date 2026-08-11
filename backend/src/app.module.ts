import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { blockchainConfig, authConfig } from './config';
import { BlockchainModule } from './blockchain';
import { DecisoesModule } from './decisoes';
import { AuthModule } from './auth';
import { IntegracoesModule } from './integracoes/integracoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [blockchainConfig, authConfig],
    }),
    ThrottlerModule.forRoot([
      {
        // Limite global padrão: mitiga scraping agressivo e ataques de força
        // bruta/DoS contra endpoints que assinam transações on-chain.
        ttl: 60_000,
        limit: 60,
      },
    ]),
    BlockchainModule,
    AuthModule,
    DecisoesModule,
    IntegracoesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
