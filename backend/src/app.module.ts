import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { blockchainConfig } from './config';
import { BlockchainModule } from './blockchain';
import { DecisoesModule } from './decisoes';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [blockchainConfig],
    }),
    BlockchainModule,
    DecisoesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
