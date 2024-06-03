import { Test, TestingModule } from '@nestjs/testing';
import { BitcoinService } from '../../bitcoin/bitcoin.service';
import { AzureService } from '../../azure/azure.service';
import { BlockStreamService } from '../../integration/blockstream/blockstream.service';
import { HttpModule } from '@nestjs/common';
import { FeeRequestDto } from '../../bitcoin/bitcoin.types';

describe('BitcoinService', () => {
  let service: BitcoinService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [BitcoinService, AzureService, BlockStreamService],
    }).compile();

    service = module.get<BitcoinService>(BitcoinService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be defined', () => {
    const fee = service.calculateFee({
      amount: '0.02',
      fromAddress: 'btc-address'
    });
    expect(service).toBeDefined();
  });

});
