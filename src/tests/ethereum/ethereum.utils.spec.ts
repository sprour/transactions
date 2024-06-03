import BigNumber from 'bignumber.js';
import * as KeyVault from 'azure-keyvault';
import { ApplicationTokenCredentials } from 'ms-rest-azure';
// import { getBalance, sendSignedTransaction } from './web3Mock';
import * as EthUtils from '../../ethereum/ethereum.utils';

describe('Ethereum Utils', () => {

  it('getErc20Contract - get Erc20 decimals', async () => {
    const contract = EthUtils.getErc20Contract('OSM', '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc', '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b');
    const actual = await contract.methods.decimals().call();
    expect(actual).toEqual('18');
  });

  it('validateEthereumAddress - returns the same ethereum address if valid', async () => {
    const address = '0x6233343030346361376132623339653661353066';
    expect(EthUtils.validateEthereumAddress(address)).toBe(address);
  });

  it('validateEthereumAddress - throws error if address invalid', async () => {
    const address = 'invalid-eth-address';
    expect(() => {
      EthUtils.validateEthereumAddress(address);
    }).toThrow('Invalid Ethereum address');
  });

  it('validateEthereumAddress - throws error if address checksum invalid', async () => {
    const address = '';
    expect(() => {
      EthUtils.validateEthereumAddress(address);
    }).toThrow('Invalid Ethereum address');
  });

  it('validateContractAddress - returns the same contract address if valid', async () => {
    const address = '';
    expect(() => {
      EthUtils.validateEthereumAddress(address);
    }).toThrow('Invalid Ethereum address');
  });

  it('getEthereumAddress - returns ethereum address', async () => {
    const x = Buffer.from('1b5c2b104138b64197cd89469f46f1b1a81eb6a45cd3f56827830902a97f287c');
    const y = Buffer.from('70010bedf855d6ea88f0f0783e66add18562db77c64b8a7ae1776bc9d1541c9b');
    const actual = EthUtils.getEthereumAddress(x, y);
    expect(actual).toBe('0xc62389792ddeEC88E7D1B34004cA7A2b39E6a50F');
    expect(EthUtils.validateEthereumAddress(actual)).toBe('0xc62389792ddeEC88E7D1B34004cA7A2b39E6a50F');
  });

  it('fromWeiToEther - transfers WEI to ETH', () => {
    const actual = EthUtils.fromWeiToEther('2500000000000000000');
    expect(actual).toBe('2.5');
  });

  it('fromWeiToEther - throws error if amount is negative ', () => {
    expect(() => {
      EthUtils.fromWeiToEther('-2500000000000000000');
    }).toThrow('Invalid Wei amount');
  });

  it('fromGweiToWei - transfers GWEI to WEI', () => {
    const actual = EthUtils.fromGweiToWei('2000000000');
    expect(actual).toBe('2000000000000000000');
  });

  it('fromGweiToWei - throws error if amount is decimal', () => {
    expect(() => {
      EthUtils.fromWeiToEther('2.5');
    }).toThrow('Invalid Wei amount');
  });

  it('amountToWei - returns WEI Amount of the currency with 6 decimals', () => {
    const actual = EthUtils.amountToWei('5.5', '6');
    expect(actual).toBe('5500000');
  });

  it('amountToWei - returns WEI Amount of ETH with 18 decimals ', () => {
    const actual = EthUtils.amountToWei('5.5', '18');
    expect(actual).toBe('5500000000000000000');
  });

  it('amountToWei - throws error if amount is negative ', () => {
    expect(() => {
      EthUtils.amountToWei('-5.5', '18');
    }).toThrow('Invalid amount -5.5, positive value expected');
  });

  it('getErc20Contract - returns ERC20 contract', () => {
    const actual = EthUtils.getErc20Contract('OSM', '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc', '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b');
    expect(actual).toBeTruthy();
    expect(actual.methods.transfer).toBeDefined();
    expect(actual.methods.balanceOf).toBeDefined();
  });

  it('validateErc20Transaction - returns txFee and gasLimit for ERC20 transaction', async () => {
    jest.spyOn(EthUtils, 'erc20Balance').mockImplementation(() => Promise.resolve('2000000000000000000'));
    jest.spyOn(EthUtils, 'contractGasLimit').mockImplementation(() => Promise.resolve(new BigNumber('250000')));

    const actual = await EthUtils.validateErc20Transaction('OSM', '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
      '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b', '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b',
      '20000000000', '8');
    expect(actual.txFee).toBe('0.002');
    expect(actual.gasLimit).toBe('250000');
  });

  it('validateErc20Transaction - throws error if ERC20 balance is too small', async () => {
    jest.spyOn(EthUtils, 'erc20Balance').mockImplementation(() => Promise.resolve('10000000000'));
    jest.spyOn(EthUtils, 'contractGasLimit').mockImplementation(() => Promise.resolve(new BigNumber('150000')));
    await expect(EthUtils.validateErc20Transaction('OSM', '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
      '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b', '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b',
      '20000000000', '8')).rejects.toThrow('There\'s not enough OSM tokens on your account.');
  });

  it('validateErc20Transaction - throws error if not enough ETH balance for transaction fee', async () => {
    jest.spyOn(EthUtils, 'erc20Balance').mockImplementation(() => Promise.resolve('2000000000000000000'));
    jest.spyOn(EthUtils, 'ethBalance').mockImplementation(() => Promise.resolve('0'));
    jest.spyOn(EthUtils, 'contractGasLimit').mockImplementation(() => Promise.resolve(new BigNumber('150000')));
    await expect(EthUtils.validateErc20Transaction('OSM', '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
      '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b', '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b',
      '20000000000', '8')).rejects.toThrow('Not enough ETH for transaction. Minimum 0.0012 ETH required.');
  });

  it('transactionFee - returns transaction fee in ETH ', () => {
    const actual = EthUtils.transactionFee(new BigNumber('8'), new BigNumber('21000'));
    expect(actual).toBe('0.000168');
  });

  it('transactionFee - throws error if wrong gasPrice or gasLimit values', () => {
    expect(() => EthUtils.transactionFee(new BigNumber('8.5'), new BigNumber('21000')))
      .toThrow('Invalid gasPrice value 8.5');
    expect(() => EthUtils.transactionFee(new BigNumber('-2'), new BigNumber('21000')))
      .toThrow('Invalid gasPrice value -2');
    expect(() => EthUtils.transactionFee(new BigNumber('8'), new BigNumber('2.1000')))
      .toThrow('Invalid gasLimit value 2.1');
    expect(() => EthUtils.transactionFee(new BigNumber('8'), new BigNumber('-21000')))
      .toThrow('Invalid gasLimit value -21000');
  });

  it('totalCost - returns total cost in Wei', () => {
    const actual = EthUtils.totalCost('2.5', '0.000021');
    expect(actual.toFixed()).toBe('2500021000000000000');
  });

  it('validateEthTransaction - returns txFee and gasLimit', async () => {
    jest.spyOn(EthUtils, 'ethBalance').mockImplementation(() => Promise.resolve('3000000000000000000'));
    const actual = await EthUtils.validateEthTransaction('0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b', '2.5', '10');
    expect(actual.txFee).toBe('0.0015');
    expect(actual.gasLimit).toBe('150000');
  });

  it('validateEthTransaction - throws error if not enough ETH balance', async () => {
    jest.spyOn(EthUtils, 'ethBalance').mockImplementation(() => Promise.resolve('1000000000000000000'));
    await expect(EthUtils.validateEthTransaction('0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b', '2.5', '10'))
      .rejects.toThrow('You don\'t have enough balance');
  });

  it('validateEthTransaction - throws error if invalid Ethereum address ', async () => {
    await expect(EthUtils.validateEthTransaction('invalid-eth-address', '2.5', '10'))
      .rejects.toThrow('Invalid Ethereum address');
  });

  it('getErc20TransactionData - throws error if invalid Ethereum address ', async () => {
    const actual = EthUtils.getErc20TransactionData('OSM', '0x208ea67ec6c6d935aaac3d4e8be840e7fbb5dbbc',
      '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b', '0xA70dE2dc0a83ddE69b5CfE37d37dA421F80CB61b', '25000000000000');
    expect(actual).toBe('0xa9059cbb000000000000000000000000a70de2dc0a83dde69b5cfe37d37da421f80cb61b000000000000000000000000000000000000000000000000000016bcc41e9000');
    // expect(actual).toBe('test');
  });

  it('getTransaction - throws error if invalid Ethereum address ', async () => {
    const txDetails = {
      toAddress: '0xc62389792ddeEC88E7D1B34004cA7A2b39E6a50F',
      weiAmount: '100000000000',
      gas: {
        price: '8',
        limit: '21000'
      },
      nonce: 1,
      data: '0x',
    };
    const actual = EthUtils.getTransaction(txDetails);

    expect(actual).toBeTruthy();
    expect(JSON.stringify(actual))
      .toBe('["0x01","0x01dcd65000","0x5208","0xc62389792ddeec88e7d1b34004ca7a2b39e6a50f","0x174876e800","0x","0x1c","0x","0x"]');
  });

  it('signTransaction - returns transaction signature', async () => {
    class Transaction {
    };
    const tx = new Transaction();
    const client = new KeyVault.KeyVaultClient(new ApplicationTokenCredentials('client-id', 'tenant-id', 'client-secret'));
    jest.spyOn(EthUtils, 'sign').mockImplementation(() => Promise.resolve({
      r: Buffer.from('r-component'),
      s: Buffer.from('s-component'),
      v: Buffer.from('v-component')
    }));
    const actual = await EthUtils.signTransaction(tx, {client, uri: 'keyvault-uri', id: 'key-id', version: 'key-version'});

    expect(actual.r.toString())
      .toBe('r-component');
    expect(actual.s.toString())
      .toBe('s-component');
    expect(actual.v.toString())
      .toBe('v-component');
  });

  it('signTransaction - throws error if transaction sign fails', async () => {
    class Transaction {
    };
    const tx = new Transaction();
    const client = new KeyVault.KeyVaultClient(new ApplicationTokenCredentials('client-id', 'tenant-id', 'client-secret'));
    jest.spyOn(EthUtils, 'sign').mockImplementation(() => Promise.reject('Failure'));
    await expect(EthUtils.signTransaction(tx, {client, uri: 'keyvault-uri', id: 'key-id', version: 'key-version'})).rejects
      .toThrow('Failed to sign ethereum transaction');
  });
  /*
    it('sendEthTransaction - returns transaction hash', () => {
      class Transaction {
        serialize: () => '0x123434';
      }

      const tx = new Transaction();
      tx.serialize = jest.fn().mockImplementation(() => '0x23445');
      // web3.eth.sendSignedTransaction = jest.fn().mockImplementation(() => Promise.resolve('tx-hash'));

      EthUtils.sendEthTransaction(tx, {
        r: Buffer.from('r-component'),
        s: Buffer.from('s-component'),
        v: Buffer.from('v-component')
      });
      expect(sendSignedTransaction).toHaveBeenCalledTimes(1);
      expect(sendSignedTransaction).toHaveBeenCalledWith('0x0x23445');
    });
  */
});
