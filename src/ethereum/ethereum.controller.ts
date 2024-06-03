import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { AzureKeyDto } from '../bitcoin/bitcoin.types';
import { EthAddressResponse, EthereumService } from './ethereum.service';
import { GasPriceService } from './gas-price.service';
import { Erc20MaxAmountDto, Erc20PaymentDto, Erc20PreviewDto, EthPaymentDto, EthPreviewDto } from './ethereum.types';

@Controller('ethereum')
export class EthereumController {

  constructor(private ethereumService: EthereumService, private gasPriceService: GasPriceService) {
  }

  @Get('gas-price')
  async gasPrice(): Promise<{ slow: number, fast: number, fastest: number }> {
    return await this.gasPriceService.getPrices();
  }

  @Post('address')
  @UsePipes(new ValidationPipe())
  async address(@Body()azureKeyDto: AzureKeyDto): Promise<EthAddressResponse> {
    return await this.ethereumService.getAddress(azureKeyDto);
  }

  @Post('validate-address')
  async validateAddress(@Body()addressDto: { cryptoAddress: string }): Promise<{ cryptoAddress: string }> {
    this.ethereumService.validateAddress(addressDto.cryptoAddress);
    return addressDto;
  }

  @Post('eth-max-transaction-size')
  async ethMaxTransactionSize(@Body()addressDto: { address: string }): Promise<{ txAmount: string }> {
    return await this.ethereumService.getMaximumEthTransactionSize(addressDto.address);
  }

  @Post('erc20-max-transaction-size')
  async erc20MaxTransactionSize(@Body()erc20Dto: Erc20MaxAmountDto): Promise<{ txAmount: string }> {
    return await this.ethereumService.getMaximumErc20TransactionSize(erc20Dto.symbol, erc20Dto.contractAddress, erc20Dto.address);
  }

  @Post('preview-erc20')
  async previewErc20(@Body()erc20PreviewDto: Erc20PreviewDto) {
    return await this.ethereumService.previewErc20(erc20PreviewDto);
  }

  @Post('preview-eth')
  async previewEth(@Body()ethPreviewDto: EthPreviewDto) {
    return await this.ethereumService.previewEth(ethPreviewDto);
  }

  @Post('send-eth')
  async sendEth(@Body()ethPaymentDto: EthPaymentDto) {
    return await this.ethereumService.sendEth(ethPaymentDto);
  }

  @Post('send-erc20')
  async sendErc20(@Body()erc20PaymentDto: Erc20PaymentDto) {
    return await this.ethereumService.sendErc20(erc20PaymentDto);
  }

}
