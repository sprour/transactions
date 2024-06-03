import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty } from 'class-validator';
import { AzureService } from './azure.service';

export class CreateAccountDto {
  @IsNotEmpty()
  keyVaultId: string;
}

@Controller('azure')
export class AzureController {

  constructor(private azureService: AzureService) {
  }

  @Post('create-account')
  async address(@Body()createAccountDto: CreateAccountDto): Promise<{ keyVaultId: string, keyVaultVersion: string }> {
    return await this.azureService.createKey(createAccountDto);
  }
}
