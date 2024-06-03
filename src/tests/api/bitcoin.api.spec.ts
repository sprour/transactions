import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module';
import nock from 'nock';
import { DtoValidationPipe } from '../../common/validation.pipe';
import { AzureService } from '../../azure/azure.service';
import { legacyRawUtxo } from '../bitcoin/fixtures/legacyRawUtxo';
import { segwitRawUtxo } from '../bitcoin/fixtures/segwitRawUtxo';
import { testNetInfo } from '../bitcoin/fixtures/feeRate';
import * as BtcUtil from '../../bitcoin/bitcoin.utils';
import { Psbt } from 'bitcoinjs-lib';
import { segwitTxDetails } from '../bitcoin/fixtures/segwitTxDetails';
import { TechnicalError } from '../../common/errors';

describe('Bitcoin Api Tests', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      providers: [AzureService],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new DtoValidationPipe());
    // app.useGlobalInterceptors(new ErrorsInterceptor());
    await app.init();
  });

  beforeEach(() => {
    const azureKey = {
      key: {x: '-oaKxCCzLA7fIwuGow_L-O20aynLpsMlcSzMW5VlkAQ', y: 'xhPawwFJKK_bP0IMZ88DEGCFIZ9g9vfKFwb95JkKN8s'}
    };
    nock('https://account2pk.vault.azure.net')
      .get('/keys/keyId/keyVersion?api-version=7.0')
      .reply(200, azureKey);

    nock('https://blockstream.info')
      .get('/testnet/api/address/2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm/utxo')
      .reply(200, segwitRawUtxo);

    nock('https://blockstream.info')
      .get('/testnet/api/address/mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ/utxo')
      .reply(200, legacyRawUtxo);

    nock('https://api.blockcypher.com')
      .get('/v1/btc/test3')
      .reply(200, testNetInfo);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    nock.cleanAll();
    await app.close();
  });

  it('bitcoin/address - returns legacy address', async () => {

    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/address',
      payload: {
        azureKey: {
          keyVaultId: 'keyId',
          keyVaultVersion: 'keyVersion',
        },
        isSegwit: false
      },
    });
    expect(actual).toBeTruthy();
    expect(actual.payload).toBe('{\"address\":\"n41tpWr5SQzERsGQm4iRgHxZ6chmTs1SKT\"}');
  });

  it('bitcoin/address - throws error if BitcoinAddressDto validation fails', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/address',
      payload: {
        azureKey: {
          keyVaultId: 'keyId',
          keyVaultVersion: 'keyVersion',
        },
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload).toBe('{"statusCode":400,"error":"Bad Request","message":"BitcoinAddressDto has invalid fields"}');
  });

  it('bitcoin/address - returns segwit address', async () => {
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
      url: 'bitcoin/address',
      payload: {
        azureKey: {
          keyVaultId: 'keyId',
          keyVaultVersion: 'keyVersion',
        },
        isSegwit: true
      },
    });
    expect(actual).toBeTruthy();
    expect(actual.payload).toBe('{\"address\":\"2N29wq9f3pytw688WbSW58uqm2QgHQVFuH1\"}');
  });

  it('bitcoin/address - throws error if there\'s no post data', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/address',
      payload: {},
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload).toBe('{"statusCode":400,"error":"Bad Request","message":"BitcoinAddressDto has invalid fields"}');
  });

  it('bitcoin/address - throws error if azure key has empty fields', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/address',
      payload: {
        azureKey: {
          keyVaultId: '',
          keyVaultVersion: '',
        },
        isSegwit: true
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload).toBe('{"statusCode":400,"error":"Bad Request","message":"BitcoinAddressDto has invalid fields"}');
  });

  it('bitcoin/validate-address - returns address if one is valid', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/validate-address',
      payload: {
        address: '2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"address":"2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm"}');
  });

  it('bitcoin/validate-address - throws error is bitcoin address invalid', async () => {
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/validate-address',
      payload: {
        address: 'invalid-btc-address'
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload).toBe('{"statusCode":400,"message":"Invalid bitcoin address"}');
  });

  it('bitcoin/calculate-transaction-fee - calculate estimated transaction fee for segwit transaction', async () => {
    // total utxo amount is 0.4 BTC
    // fee rate 10
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/calculate-transaction-fee',
      payload: {
        fromAddress: '2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm',
        amount: '0.35'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"txFee":0.0000261}');
  });

  it('bitcoin/calculate-transaction-fee - calculate estimated transaction fee for legacy transaction', async () => {
    // total utxo amount is 0.4 BTC
    // fee rate 10
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/calculate-transaction-fee',
      payload: {
        fromAddress: 'mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ',
        amount: '0.35'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"txFee":0.0000373}');
  });

  it('bitcoin/calculate-transaction-fee - throws error if not enough balance', async () => {
    // total available amount is 0.4 BTC
    // fee rate 10
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/calculate-transaction-fee',
      payload: {
        fromAddress: 'mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ',
        amount: '0.4'
      },
    });
    expect(actual.statusCode).toBe(400);
    expect(actual.payload).toBe('{"statusCode":400,"message":"Not enough balance"}');
  });

  it('bitcoin/max-transaction-size - legacy address max available amount minus fee', async () => {
    // total available amount is 0.4 BTC
    // fee rate 10
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/max-transaction-size',
      payload: {
        address: 'mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"txAmount":0.39995524}');
  });

  it('bitcoin/max-transaction-size - segwit address max available amount minus fee', async () => {
    // total available amount is 0.4 BTC
    // fee rate 10
    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/max-transaction-size',
      payload: {
        address: '2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"txAmount":0.39996892}');
  });

  it('bitcoin/send-btc - sends transaction successfully', async () => {
    nock('https://api.blockcypher.com')
      .get('/v1/btc/test3')
      .reply(200, testNetInfo);

    nock('https://blockstream.info')
      .get('/testnet/api/address/2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm/txs')
      .reply(200, segwitTxDetails);

    nock('https://blockstream.info')
      .post('/testnet/api/tx')
      .reply(200, 'tx-id');

    jest.spyOn(BtcUtil, 'buildAndSignTransaction').mockImplementation(() => Promise.resolve(new Psbt()));
    jest.spyOn(BtcUtil, 'validateAndFinalizeTransaction').mockImplementation(() => {
      return {
        txId: 'tx-id',
        txHex: 'tx-hex'
      };
    });

    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/send-btc',
      payload: {
        azureKey: {
          keyVaultId: 'keyId',
          keyVaultVersion: 'keyVersion',
        },
        fromAddress: '2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm',
        toAddress: 'mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ',
        amount: '0.002'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"txHash":"tx-id","txFee":"0.0000169"}');
  });

  it('bitcoin/send-btc - throws error if transaction signing failed', async () => {
    nock('https://api.blockcypher.com')
      .get('/v1/btc/test3')
      .reply(200, testNetInfo);

    nock('https://blockstream.info')
      .get('/testnet/api/address/2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm/txs')
      .reply(200, segwitTxDetails);

    nock('https://blockstream.info')
      .post('/testnet/api/tx')
      .reply(200, 'tx-id');

    jest.spyOn(BtcUtil, 'buildAndSignTransaction').mockImplementation(
      () => Promise.reject(new TechnicalError('Failed to sign transaction')));
    jest.spyOn(BtcUtil, 'validateAndFinalizeTransaction').mockImplementation(() => {
      return {
        txId: 'tx-id',
        txHex: 'tx-hex'
      };
    });

    const actual = await app.inject({
      method: 'POST',
      url: 'bitcoin/send-btc',
      payload: {
        azureKey: {
          keyVaultId: 'keyId',
          keyVaultVersion: 'keyVersion',
        },
        fromAddress: '2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm',
        toAddress: 'mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ',
        amount: '0.002'
      },
    });
    expect(actual.statusCode).toBe(500);
    expect(actual.payload).toBe('{"statusCode":500,"message":"Failed to sign transaction"}');
  });

});
