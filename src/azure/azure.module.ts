import { Module } from '@nestjs/common';
import { AzureService } from './azure.service';
import { AzureSignerAsync } from './azureSignerAsync';
import { AzureController } from './azure.controller';

@Module({
  providers: [AzureService, AzureSignerAsync],
  controllers: [AzureController],
})
export class AzureModule {
}
