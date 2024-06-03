import { Module } from '@nestjs/common';
import { BitcoinController } from './bitcoin.controller';
import { BitcoinService } from './bitcoin.service';
import { AzureService } from '../azure/azure.service';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [IntegrationModule],
  controllers: [BitcoinController],
  providers: [AzureService, BitcoinService],
})
export class BitcoinModule {
}
