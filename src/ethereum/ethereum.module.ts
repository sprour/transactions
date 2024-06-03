import { HttpModule, Module } from '@nestjs/common';
import { EthereumService } from './ethereum.service';
import { EthereumController } from './ethereum.controller';
import { AzureService } from '../azure/azure.service';
import { GasPriceService } from './gas-price.service';

@Module({
  imports: [HttpModule],
  providers: [AzureService, EthereumService, GasPriceService],
  controllers: [EthereumController],
})
export class EthereumModule {
}
