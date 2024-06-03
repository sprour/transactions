import { HttpModule, HttpService, Module } from '@nestjs/common';
import { BitcoinModule } from './bitcoin/bitcoin.module';
import { EthereumModule } from './ethereum/ethereum.module';
import { AzureModule } from './azure/azure.module';
import { IntegrationModule } from './integration/integration.module';

@Module({
  imports: [HttpModule, BitcoinModule, EthereumModule, AzureModule, IntegrationModule],
  controllers: [],
  providers: [],
})
export class AppModule {
}
