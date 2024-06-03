import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module';
import nock from 'nock';
import { DtoValidationPipe } from '../../common/validation.pipe';
import { AzureService } from '../../azure/azure.service';

describe('Azure Api Test', () => {
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

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    nock.cleanAll();
    await app.close();
  });

  it('azure/create-account - creates new key in azure', async () => {
    const azureKey = {
      key: {
        kid: 'https://account2pk.vault.azure.net/keys/keyId-1/keyVersion-1',
        x: '-oaKxCCzLA7fIwuGow_L-O20aynLpsMlcSzMW5VlkAQ',
        y: 'xhPawwFJKK_bP0IMZ88DEGCFIZ9g9vfKFwb95JkKN8s'
      }
    };
    nock('https://account2pk.vault.azure.net')
      .post('/keys/keyId-1/create?api-version=7.0')
      .reply(200, azureKey);

    const actual = await app.inject({
      method: 'POST',
      url: 'azure/create-account',
      payload: {
        keyVaultId: 'keyId-1'
      },
    });
    expect(actual.statusCode).toBe(201);
    expect(actual.payload).toBe('{"keyVaultId":"keyId-1","keyVaultVersion":"keyVersion-1"}');
  });

  it('azure/create-account - throws error if azure responses with error', async () => {
    nock('https://account2pk.vault.azure.net')
      .post('/keys/keyId-1/create?api-version=7.0')
      .reply(400);

    const actual = await app.inject({
      method: 'POST',
      url: 'azure/create-account',
      payload: {
        keyVaultId: 'keyId-1'
      },
    });
    expect(actual.statusCode).toBe(500);
    expect(actual.payload).toBe('{"statusCode":500,"message":"Failed to create account"}');
  });

});
