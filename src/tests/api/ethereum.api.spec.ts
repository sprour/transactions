import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module';
import { AzureService } from '../../azure/azure.service';
import nock from 'nock';
import { DtoValidationPipe } from '../../common/validation.pipe';
import { gasPrices } from '../ethereum/fixtures/gas.prises';
import * as EthUtil from '../../ethereum/ethereum.utils';
import { ethBalance, signTransaction } from '../../ethereum/ethereum.utils';
import { TechnicalError } from '../../common/errors';

describe('Ethereum Api Tests', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      providers: [AzureService],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new DtoValidationPipe());
    await app.init();
  });

  beforeEach(() => {
    nock('https://ethgasstation.info')
      .get('/json/ethgasAPI.json')
      .reply(200, gasPrices);

    jest.spyOn(EthUtil, 'getTransactionCount').mockImplementation(() => Promise.resolve(0));
  });

  it('ethereum/address - display valid ethereum address', async () => {
    const azureKey = {
      key: {
        x: '-oaKxCCzLA7fIwuGow_L-O20aynLpsMlcSzMW5VlkAQ',
        y: 'xhPawwFJKK_bP0IMZ88DEGCFIZ9g9vfKFwb95JkKN8s'
      }
    };
    nock('https://account2pk.vault.azure.net')
      .get('/keys/keyId/keyVersion?api-version=7.0')
      .reply(200, azureKey);

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/address',
      payload: {
        keyVaultId: 'keyId',
        keyVaultVersion: 'keyVersion',
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{\"address\":\"0x74893D44f3C3836BAf4f6D5ea3BAeB9f252fc75d\"}');
  });

  it('ethereum/address - throws validation error if azureKey fields are empty', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/address',
      payload: {
        keyVaultId: '',
        keyVaultVersion: ''
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload).toBe('{"statusCode":400,"error":"Bad Request","message":"AzureKeyDto has invalid fields"}');
  });

  it('ethereum/gas-price - display gas price', async () => {
    const actual = await app.inject({
      method: 'GET',
      url: 'ethereum/gas-price'
    });
    expect(actual.statusCode).toBe(200);
    expect(actual.payload).toBe('{"fastest":12,"fast":8,"slow":2}');
  });

  it('ethereum/gas-price - throws error if ethgasstation.info unavailable', async () => {
    nock.cleanAll();
    nock('https://ethgasstation.info')
      .get('/json/ethgasAPI.json')
      .reply(500);
    const actual = await app.inject({
      method: 'GET',
      url: 'ethereum/gas-price'
    });
    expect(actual.statusCode).toBe(500);
    expect(actual.payload).toBe('{"statusCode":500,"message":"Failed to fetch gas prices"}');
  });

  it('ethereum/validate-address - returns same address if ok', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/validate-address',
      payload: {
        cryptoAddress: '0x3664356561336261656239663235326663373564'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"cryptoAddress":"0x3664356561336261656239663235326663373564"}');
  });

  it('ethereum/validate-address - throws error if address is invalid', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/validate-address',
      payload: {
        cryptoAddress: 'invalid-address'
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload).toBe('{"statusCode":400,"message":"Invalid Ethereum address"}');
  });

  it('ethereum/eth-max-transaction-size - returns max amount', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('2000000000000000000'));
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/eth-max-transaction-size',
      payload: {
        address: 'eth-address'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"txAmount":"1.9988"}');
  });

  it('ethereum/eth-max-transaction-size - throws error if failed to fetch balance', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.reject('Ethereum node is down'));
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/eth-max-transaction-size',
      payload: {
        address: 'eth-address'
      },
    });
    expect(actual.statusCode).toBe(500);
    expect(actual.payload).toBe('{"statusCode":500,"message":"Failed to calculate ETH max balance for address eth-address"}');
  });

  it('ethereum/erc20-max-transaction-size - display Erc20 balance', async () => {
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('2500000000000000000'));
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/erc20-max-transaction-size',
      payload: {
        address: '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        symbol: 'OSM'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"txAmount":"2.5"}');
  });

  it('ethereum/erc20-max-transaction-size - throws error if failed to fetch balance', async () => {
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('250000000000000000'));
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/erc20-max-transaction-size',
      payload: {
        address: 'invalid-eth-address',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        symbol: 'OSM'
      },
    });
    expect(actual.statusCode).toBe(500);
    expect(actual.payload)
      .toBe('{"statusCode":500,"message":"Failed to calculate max balance for address invalid-eth-address with currencyCode OSM"}');
  });

  it('ethereum/erc20-max-transaction-size - throws error if payload fields are empty', async () => {
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('250000000000000000'));
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/erc20-max-transaction-size',
      payload: {
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        symbol: 'OSM'
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload)
      .toBe('{"statusCode":400,"error":"Bad Request","message":"Erc20MaxAmountDto has invalid fields"}');
  });

  it('ethereum/preview-eth - display estimate transaction fee for ETH', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('3500000000000000000'));
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/preview-eth',
      payload: {
        fromAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '2.55',
        gasPrice: '2',
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload)
      .toBe('{"txFee":"0.0003"}');
  });

  it('ethereum/preview-eth - throw error if not enough ETH balance', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('2500000000000000000'));
    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/preview-eth',
      payload: {
        fromAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '2.55',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload)
      .toBe('{"statusCode":400,"message":"You don\'t have enough balance"}');
  });

  it('ethereum/send-eth - send ETH transaction', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('3500000000000000000'));
    jest.spyOn(EthUtil, 'signTransaction').mockImplementation(() => Promise.resolve({
      r: Buffer.from(''),
      s: Buffer.from(''),
      v: Buffer.from(''),
    }));

    jest.spyOn(EthUtil, 'sendEthTransaction').mockImplementation(() => Promise.resolve('tx-hash-id'));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/send-eth',
      payload: {
        azureKey: {
          keyVaultId: 'azure-key-1',
          keyVaultVersion: '12315e48347843ce9d38de14dd1377fe'
        },
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '0.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload)
      .toBe('{"txHash":"tx-hash-id","txFee":"0.0003"}');
  });

  it('ethereum/send-eth - throws error if sign transaction fails', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('3500000000000000000'));
    jest.spyOn(EthUtil, 'signTransaction').mockImplementation(
      () => Promise.reject(new TechnicalError('Failed to sign transaction')));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/send-eth',
      payload: {
        azureKey: {
          keyVaultId: 'azure-key-1',
          keyVaultVersion: '12315e48347843ce9d38de14dd1377fe'
        },
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '0.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(500);
    expect(actual.payload)
      .toBe('{"statusCode":500,"message":"Failed to sign transaction"}');
  });

  it('ethereum/send-eth - throws error if not enough funds', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('100000000'));
    // jest.spyOn(EthUtil, 'signTransaction').mockImplementation(() => Promise.reject('Failed to sign transaction'));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/send-eth',
      payload: {
        azureKey: {
          keyVaultId: 'azure-key-1',
          keyVaultVersion: '12315e48347843ce9d38de14dd1377fe'
        },
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '0.03',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload)
      .toBe('{"statusCode":400,"message":"You don\'t have enough balance"}');
  });

  it('ethereum/send-erc20 - sends erc20 transaction successfully ', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('3500000000000000000'));
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('1500000000000000000'));
    jest.spyOn(EthUtil, 'signTransaction').mockImplementation(() => Promise.resolve({
      r: Buffer.from(''),
      s: Buffer.from(''),
      v: Buffer.from(''),
    }));
    jest.spyOn(EthUtil, 'sendEthTransaction').mockImplementation(() => Promise.resolve('tx-hash-id'));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/send-erc20',
      payload: {
        azureKey: {
          keyVaultId: 'azure-key-1',
          keyVaultVersion: '12315e48347843ce9d38de14dd1377fe'
        },
        symbol: 'OSM',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        decimals: 18,
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '0.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload)
      .toBe('{"txHash":"tx-hash-id","txFee":"0.000102644"}');
  });

  it('ethereum/send-erc20 - throws error if not enough ether for erc20 transaction ', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('0'));
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('2500000000000000000'));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/send-erc20',
      payload: {
        azureKey: {
          keyVaultId: 'azure-key-1',
          keyVaultVersion: '12315e48347843ce9d38de14dd1377fe'
        },
        symbol: 'OSM',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        decimals: 18,
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '0.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload)
      .toBe('{"statusCode":400,"message":"Not enough ETH for transaction. Minimum 0.000102644 ETH required."}');
  });

  it('ethereum/preview-erc20 - show erc20 transaction fee in Eth', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('1500000000000000000'));
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('2500000000000000000'));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/preview-erc20',
      payload: {
        symbol: 'OSM',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        decimals: 18,
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '0.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload)
      .toBe('{"txFee":"0.000102644"}');
  });

  it('ethereum/preview-erc20 - throw error if not enough ether for erc20 transaction', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('0'));
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('2500000000000000000'));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/preview-erc20',
      payload: {
        symbol: 'OSM',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        decimals: 18,
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '0.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload)
      .toBe('{"statusCode":400,"message":"Not enough ETH for transaction. Minimum 0.000102644 ETH required."}');
  });

  it('ethereum/send-erc20 - throws error if not enough erc20 amount', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('3500000000000000000'));
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('200000000000'));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/send-erc20',
      payload: {
        azureKey: {
          keyVaultId: 'azure-key-1',
          keyVaultVersion: '12315e48347843ce9d38de14dd1377fe'
        },
        symbol: 'OSM',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        decimals: 18,
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '1.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload)
      .toBe('{"statusCode":400,"message":"There\'s not enough OSM tokens on your account."}');
  });

  it('ethereum/send-erc20 - throws error if erc20 transaction signing fails', async () => {
    jest.spyOn(EthUtil, 'ethBalance').mockImplementation(() => Promise.resolve('3500000000000000000'));
    jest.spyOn(EthUtil, 'erc20Balance').mockImplementation(() => Promise.resolve('55000000000000000000'));
    jest.spyOn(EthUtil, 'signTransaction').mockImplementation(() =>
      Promise.reject(new TechnicalError('Failed to sign transaction')));

    const actual = await app.inject({
      method: 'POST',
      url: 'ethereum/send-erc20',
      payload: {
        azureKey: {
          keyVaultId: 'azure-key-1',
          keyVaultVersion: '12315e48347843ce9d38de14dd1377fe'
        },
        symbol: 'OSM',
        contractAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        decimals: 18,
        fromAddress: '0xe22dba53b0f046e8d915e8a7d2e0dc46367e9318',
        toAddress: '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
        amount: '1.003',
        gasPrice: 2
      },
    });
    expect(actual.statusCode).toBe(500);
    expect(actual.payload)
      .toBe('{"statusCode":500,"message":"Failed to sign transaction"}');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    await app.close();
  });

});
