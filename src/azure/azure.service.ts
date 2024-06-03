import { Injectable, Logger } from '@nestjs/common';
import { azureConfig } from '../config/azure.config';
import * as KeyVault from 'azure-keyvault';
import KeyVaultClient from 'azure-keyvault';
import { KeyBundle, KeyOperationResult } from 'azure-keyvault/lib/models';
import { ApplicationTokenCredentials } from 'ms-rest-azure';
import { TechnicalError } from '../common/errors';
import { CreateAccountDto } from './azure.controller';

@Injectable()
export class AzureService {
  client: KeyVaultClient;
  private logger = new Logger('AzureService');

  constructor() {
    const {clientId, tenantId, clientSecret} = azureConfig;
    const applicationTokenCredentials = new ApplicationTokenCredentials(clientId, tenantId, clientSecret);
    this.client = new KeyVault.KeyVaultClient(applicationTokenCredentials);
  }

  async getKey(keyVaultId: string, keyVaultVersion: string): Promise<KeyBundle> {
    const {vaultUri} = azureConfig;
    try {
      return await this.client.getKey(vaultUri, keyVaultId, keyVaultVersion);
    } catch (error) {
      this.logger.error(error.toString());
      throw new TechnicalError('Failed to fetch osom account');
    }
  }

  getClient(): KeyVaultClient {
    return this.client;
  }

  getKeyVaultUri(): string {
    return azureConfig.vaultUri;
  }

  async signTransaction(txHash: Buffer, keyVaultId, keyVaultVersion): Promise<KeyOperationResult> {
    return await this.client.sign(azureConfig.vaultUri, keyVaultId, keyVaultVersion, 'ECDSA256', txHash);
  }

  async createKey(createAccountDto: CreateAccountDto): Promise<{ keyVaultId: string, keyVaultVersion: string }> {
    try {
      const {keyVaultId} = createAccountDto;
      const keyOps = ['sign', 'verify'];
      const keyOptions = {
        keyOps, curve: 'SECP256K1'
      };
      const {vaultUri} = azureConfig;
      const keyBundle = await this.client.createKey(vaultUri, keyVaultId, 'EC', keyOptions);
      const {key: {kid}} = keyBundle;
      const keyVaultVersion = kid.substring(kid.lastIndexOf('/') + 1);
      return {
        keyVaultId,
        keyVaultVersion
      };
    } catch (error) {
      this.logger.error(error.toString());
      throw new TechnicalError('Failed to create account');
    }

  }
}
