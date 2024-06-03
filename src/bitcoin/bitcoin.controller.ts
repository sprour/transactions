import { Body, Controller, Logger, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { BitcoinService } from './bitcoin.service';
import { AddressDto, AzureKeyDto, BitcoinAddressDto, FeeRequestDto, SendTransactionResponseDto, BitcoinPaymentDto } from './bitcoin.types';

@Controller('bitcoin')
export class BitcoinController {
  private logger = new Logger('BitcoinController');

  constructor(private bitcoinService: BitcoinService) {
  }

  @Post('address')
  async address(@Body()bitcoinAddressDto: BitcoinAddressDto): Promise<{ address: string }> {
    return {
      address: await this.bitcoinService.getAddress(bitcoinAddressDto),
    };
  }

  @Post('calculate-transaction-fee')
  async calculateFee(@Body()feeRequestDto: FeeRequestDto): Promise<{ txFee: number }> {
    return {
      txFee: await this.bitcoinService.calculateFee(feeRequestDto),
    };
  }

  @Post('send-btc')
  async sendTransaction(@Body()bitcoinPaymentDto: BitcoinPaymentDto): Promise<SendTransactionResponseDto> {
    return await this.bitcoinService.sendTransaction(bitcoinPaymentDto);
  }

  @Post('max-transaction-size')
  async getMaximumTransactionSize(@Body()addressDto: AddressDto): Promise<{ txAmount: number }> {
    const txAmount = await this.bitcoinService.calculateMaximumTransactionSize(addressDto);
    return {
      txAmount,
    };
  }

  @Post('validate-address')
  validateAddress(@Body() addressDto: AddressDto): AddressDto {
    this.bitcoinService.validateAddress(addressDto.address);
    return addressDto;
  }

}
