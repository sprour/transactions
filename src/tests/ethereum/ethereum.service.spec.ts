import { Test, TestingModule } from '@nestjs/testing';
import { EthereumService } from '../../ethereum/ethereum.service';
import { GasPriceService } from '../../ethereum/gas-price.service';
import { AzureService } from '../../azure/azure.service';
import { HttpModule } from '@nestjs/common';

describe('EthereumService', () => {
  let service: EthereumService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [EthereumService, GasPriceService, AzureService],
    }).compile();

    service = module.get<EthereumService>(EthereumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
