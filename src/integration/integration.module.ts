import { HttpModule, Module } from '@nestjs/common';
import { BlockStreamService } from './blockstream/blockstream.service';

@Module({
  imports: [HttpModule],
  providers: [BlockStreamService],
  exports: [BlockStreamService],
})
export class IntegrationModule {
}
