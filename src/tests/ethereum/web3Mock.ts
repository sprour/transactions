import { classToClass } from 'class-transformer';

export const sendSignedTransaction = jest.fn().mockImplementation(() => ({
  once: jest.fn().mockImplementation(() => ({
    on: jest.fn()
  }))
}));

export const getBalance = jest.fn();
const HttpProvider = jest.fn();
const isAddress = jest.fn();
export class Contract {
}

class Web3 {
  eth = {
    sendSignedTransaction,
    getBalance,
    Contract
  };
  static providers = {
    HttpProvider
  };
  static utils: {
    isAddress
  };
}

export const web3Mock = jest.mock('web3', () => ({
  __esModule: true, // this property makes it work
  default: Web3
}));
