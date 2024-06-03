import { BusinessLogicError, TechnicalError } from '../common/errors';
import Web3 from 'web3';
import * as util from 'ethereumjs-util';
import { secp256k1 } from 'ethereumjs-util';
import { envConfig } from '../config/env.config';
import { erc20Abi } from './abi/erc20.contracts';
import BN from 'bn.js';
import BigNumber from 'bignumber.js';
import { KeyVaultClient } from 'azure-keyvault';
import Transaction from 'ethereumjs-tx';

import * as _ from 'underscore';
import * as assert from 'assert';
import { TxDetails, TxSignature } from './ethereum.types';
import { Logger } from '@nestjs/common';

const env = envConfig();
const network = env.get('ETHEREUM_NETWORK');
const networkID = env.get('ETHEREUM_NETWORK_ID');

export const web3 = new Web3(new Web3.providers.HttpProvider(network));

const logger = new Logger('EthereumUtils');

export const getEthereumAddress = (x: Buffer, y: Buffer): string => {
  const pubKey = Buffer.concat([x, y]);
  const pubKeyHash = util.bufferToHex(pubKey);
  const pubKeyDigest = util.bufferToHex(util.toBuffer(web3.utils.sha3(pubKeyHash)));

  return web3.utils.toChecksumAddress(`0x${pubKeyDigest.substr(pubKeyDigest.length - 40)}`);
};

/**
 * Get ERC20 token balance
 * @param fromAddress - Sender's Ethereum address
 * @param contract - web3.eth.Contract
 * @returns {number} ERC20 token balance in Wei
 */
export const erc20Balance = (fromAddress, contract): Promise<string> => {
  if (typeof contract.methods.balanceOf !== 'function') {
    throw new TechnicalError(` ${contract.options.address} doesn't have balanceOf method`);
  }

  return contract.methods.balanceOf(fromAddress).call();
};

/**
 * Validate Ethereum Address
 * @param address - Ethereum address
 * @returns {string} - The same ethereum address or throws exceptions
 */
export const validateEthereumAddress = (address: string): string => {
  if (!web3.utils.isAddress(address)) {
    throw new BusinessLogicError('Invalid Ethereum address');
  }

  return web3.utils.toChecksumAddress(address);
};

/**
 * Validate Ethereum Contract Address
 * @param contractAddress {string} - ERC20 token Contract Address
 * @returns {string} - the same contract address
 */
export const validateContractAddress = (contractAddress: string): string => {
  try {
    return web3.utils.toChecksumAddress(contractAddress);
  } catch (error) {
    throw new TechnicalError(error.message);
  }
};

/**
 * Get Ether Balance of the Address
 * @param address
 * @returns {string} Balance in Wei
 */
export const ethBalance = (address: string): Promise<string> => {
  return web3.eth.getBalance(address);
};

/**
 * Get Erc20 Contract
 * @param contractAbi - ERC20 token Contract Abi Json
 * @param contractAddress - ERC20 token Contract Address
 * @param fromAddress - ERC20 token sender address
 * @returns {web3.eth.Contract}
 */
export const getErc20Contract = (currencyCode: string, contractAddress: string, fromAddress: string) => {
    const abiString = erc20Abi(currencyCode);
    const jsonInterface = JSON.parse(abiString);
    return new web3.eth.Contract(jsonInterface, contractAddress,
      {from: fromAddress});
};

const split = (value) => {
// Split it into a whole and fractional part
  const comps = value.split('.');

  if (comps.length > 2) {
    throw new Error('Too many decimal points');
  }

  return {
    whole: comps[0], fraction: comps[1],
  };
};

const validate = (value: string, decimals?: string) => {
  // Is it negative?
  const negative = value.substring(0, 1) === '-';

  if (negative) {
    throw new Error(`Invalid amount ${value}, positive value expected`);
  }

  if (value === '.') {
    throw new Error(`Invalid value ${value} cannot be converted to` +
      ` base unit with ${decimals} decimals.`);
  }
};

export const fromWeiToEther = (weiAmount: string): string => {
  try {
    validate(weiAmount);
    return web3.utils.fromWei((weiAmount).toString(), 'ether');
  } catch (error) {
    logger.error(error.message);
    throw new TechnicalError('Invalid Wei amount');
  }
};
export const fromGweiToWei = (gweiAmount: string): string => {
  validate(gweiAmount);
  return web3.utils.toWei(gweiAmount, 'gwei').toString();
};

export const amountToWei = (value: string, decimals: string): string => {
  validate(value, decimals);
  let {whole, fraction} = split(value);
  const ten = new BN(10);
  const base = ten.pow(new BN(decimals));

  if (!whole) {
    whole = '0';
  }

  if (!fraction) {
    fraction = '0';
  }

  if (fraction.length > decimals) {
    throw new Error('Too many decimal places');
  }

  while (fraction.length < decimals) {
    fraction += '0';
  }

  whole = new BN(whole);
  fraction = new BN(fraction);
  const wei = whole.mul(base).add(fraction);

  return new BN(wei.toString(10), 10).toLocaleString();
};

/**
 * Get Estimate Gas Limit for the ERC20 transaction
 * @param contract - web3.eth.Contract of ERC20 token
 * @param addresses - {
 *  from - Sender's Eth address
 *  to - Receiver's Eth address
 * }
 * @param weiAmount - ERC20 token amount in Wei
 * @param symbol - ERC20 token symbol
 * @returns {number} - Gas Limit in Gwei
 */
export const contractGasLimit = (contract, addresses, weiAmount, symbol): Promise<BigNumber> => {
  if (typeof contract.methods.transfer !== 'function') {
    throw new TechnicalError(`Token ${symbol} doesn't have transfer method`);
  }

  return contract.methods.transfer(addresses.to, weiAmount)
    .estimateGas({
      from: addresses.from,
    });
};

export const validateErc20Transaction = async (symbol: string, contractAddress: string, fromAddress: string, toAddress: string, weiAmount: string,
                                               gasPrice: string): Promise<{ txFee: string, gasLimit: string }> => {
  contractAddress = web3.utils.toChecksumAddress(contractAddress);
  fromAddress = web3.utils.toChecksumAddress(fromAddress);
  const contract = getErc20Contract(symbol, contractAddress, fromAddress);

  const balance = await erc20Balance(fromAddress, contract);

  if (new BigNumber(balance).isLessThan(new BigNumber(weiAmount))) {
    throw new BusinessLogicError(`There's not enough ${symbol} tokens on your account.`);
  }

  const addresses = {from: fromAddress, to: toAddress};
  const gasLimit = await contractGasLimit(contract, addresses, weiAmount, symbol);
  const gweiTxFee = new BigNumber(gasLimit).multipliedBy(new BigNumber(gasPrice));
  const weiTxFee = web3.utils.toWei(gweiTxFee.toFixed(), 'gwei');
  const txFee = web3.utils.fromWei(weiTxFee, 'ether');
  const weiEthBalance = await ethBalance(fromAddress);

  if (new BigNumber(weiEthBalance).isLessThan(new BigNumber(weiTxFee))) {
    throw new BusinessLogicError(`Not enough ETH for transaction. Minimum ${txFee} ETH required.`);
  }
  return {
    txFee, gasLimit: gasLimit.toFixed(),
  };
};

/**
 * Calculate Transaction Fee
 * @param gasPriceInGwei - Gas Price in Gwei
 * @param gasLimitInGwei - Gas Limit in Gwei
 * @returns {number} - Transaction fee in ETH
 */
export const transactionFee = (gasPriceInGwei: BigNumber, gasLimitInGwei: BigNumber): string => {
  if (!gasPriceInGwei.isPositive() || gasPriceInGwei.decimalPlaces() > 0) {
    throw new TechnicalError(`Invalid gasPrice value ${gasPriceInGwei}`);
  }

  if (!gasLimitInGwei.isPositive() || gasLimitInGwei.decimalPlaces() > 0) {
    throw new TechnicalError(`Invalid gasLimit value ${gasLimitInGwei}`);
  }

  const gweiFee = gasPriceInGwei.multipliedBy(gasLimitInGwei).toFixed();
  const weiFee = web3.utils.toWei(gweiFee, 'gwei');

  return web3.utils.fromWei(weiFee, 'ether');
};

/**
 *
 * @param amount - Amount in Ether
 * @param txFee - txFee in Ether
 * @returns {BN} - BigNumber Transaction Total Upfront price in Wei
 */
export const totalCost = (amount: string, txFee: string): BigNumber => {
  const amountBN = new BigNumber(web3.utils.toWei(amount, 'ether').toString());
  const feeBN = new BigNumber(web3.utils.toWei(txFee, 'ether').toString());
  return amountBN.plus(feeBN);
};

/**
 * Validate Ether Transaction Details
 * @param fromAddress - ETH address of sender
 * @param amount - amount in eth
 * @param gasPrice - gas price in gwei
 * @returns {gasLimit: number, txFee: number}
 */
export const validateEthTransaction = async (fromAddress: string, amount: string, gasPrice: string): Promise<{ txFee: string, gasLimit: string }> => {
  const address = validateEthereumAddress(fromAddress);
  const gasLimit = new BigNumber(150000);
  const txFee = transactionFee(new BigNumber(gasPrice), gasLimit);

  if (typeof amount !== 'undefined' && amount !== null) {
    const cost = totalCost(amount, txFee);
    const balance = new BigNumber(await ethBalance(address));

    if (balance.isLessThan(cost)) {
      throw new BusinessLogicError('You don\'t have enough balance');
    }
  }

  return {txFee, gasLimit: gasLimit.toFixed()};
};

/**
 * Get Transaction Count
 * @param fromAddress
 * @returns {number} The latest transaction nonce of the Ethereum address
 */
export const getTransactionCount = (fromAddress) => {
  fromAddress = web3.utils.toChecksumAddress(fromAddress);
  return web3.eth.getTransactionCount(fromAddress);
};

/**
 * Get Transaction Object
 * @param toAddress - Ethereum Address or ERC20 Contract Address
 * @param weiAmount - Amount in Wei units
 * @param gas - {
 *   price  - Gas price in Gwei per operation
 *   limit - Maximum amount of Gas in Gwei, which can be spend for transaction
 * }
 * @param transactionParams - {
 *   nonce - The latest transaction nonce of the sender's ethereum address
 *   data - Message for the Smart Contract, e.g. ERC20 transaction details
 * }
 * @returns {Object} - Ethereum's Transaction
 */
export const getTransaction = (txDetails: TxDetails): Transaction => {
  const gasPrice = new BigNumber(txDetails.gas.price);
  const txParams = {
    nonce: web3.utils.toHex(txDetails.nonce),
    gasPrice: web3.utils.toHex(web3.utils.toWei(gasPrice.toFixed(), 'gwei')),
    gasLimit: web3.utils.toHex(txDetails.gas.limit),
    to: txDetails.toAddress,
    value: web3.utils.toHex(txDetails.weiAmount),
    data: txDetails.data,
    // EIP 155 chainId - mainnet: 1, rinkebey: 4
    chainId: networkID,
  };
  return new Transaction(txParams);
};

/**
 * Get ERC20 Transaction Data
 * @param currencyCode - ERC20 Currency Code
 * @param contractAddress - ERC20 Contract address
 * @param toAddress - Ethereum address of the receiver
 * @param fromAddress - Ethereum Address of the sender
 * @param weiAmount - ERC20 token amount in Wei
 * @returns {string} Transaction data in Hex
 */
export const getErc20TransactionData = (currencyCode: string, contractAddress: string, fromAddress: string, toAddress: string, weiAmount: string) => {
  const contract = getErc20Contract(currencyCode, contractAddress, fromAddress);

  return contract.methods.transfer(toAddress, weiAmount).encodeABI();
};

/**
 * Sign Transaction With Azure KeyVault
 * @param tx - Transaction object*
 * @param keyVault - {
 *  client - Azure KeyVault Authenticated Client
 *  uri - Azure KeyVault Application Url
 *  id - Azure KeyVault Id
 *  version - Azure KeyVault Version of the KeyVaultId
 *  }
 * @returns {Buffer} - Signature
 *
 */
export const signTransaction = async (tx: Transaction, keyVault: { client: KeyVaultClient, uri: string, id: string, version: string })
  : Promise<TxSignature> => {
  try {
    return await sign(tx,
      keyVault.client,
      keyVault.uri,
      keyVault.id,
      keyVault.version);
  } catch (e) {
    logger.error(e.toString());
    throw new TechnicalError('Failed to sign ethereum transaction');
  }
};

/**
 * Send Signed Raw Transaction to Ethereum network
 * @param tx
 * @param signature
 * @returns {string} Transaction Hash
 */
export const sendEthTransaction = (tx: Transaction, signature: TxSignature): Promise<string> => {
  Object.assign(tx, signature);
  const serializedTransaction = tx.serialize();
  const raw = `0x${serializedTransaction.toString('hex')}`;
  return new Promise((resolve, reject) => {
    web3.eth.sendSignedTransaction(raw)
      .once('transactionHash', (txHash) => {
        resolve(txHash);
      })
      .on('error', error => reject(error));
  });
};

// The order of the curve 'n'. See: https://en.bitcoin.it/wiki/Secp256k1
const CURVE_ORDER = new BN(Buffer.from('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 'hex'));
const HALF_CURVE_ORDER = CURVE_ORDER.clone().ishrn(1);

function isHigh(num) {
  return num.ucmp(HALF_CURVE_ORDER) === 1;
}

export const makeCanonical = (buffer: Buffer): Buffer => {
  const r = new BN(buffer.slice(0, 32));
  let s = new BN(buffer.slice(32, 64));

  if (isHigh(s)) {
    s = CURVE_ORDER.sub(s);
  }
  return Buffer.concat([r.toBuffer(), s.toBuffer()]);
};

/**
 * Signs a transaction using azure key vault
 * @param {Transaction} tx the transaction object to sign
 * @param {KeyVaultClient} client - the key vault client object
 * @param {string} vaultUri the vault URI
 * @param {string} keyName the name of the EC key
 * @param {string} keyVersion the version of the key
 * @return {Buffer} the signed transaction object
 */
export const sign = async (tx: Transaction, client: KeyVaultClient, vaultUri: string, keyName: string, keyVersion: string)
  : Promise<TxSignature> => {
  const msgHash = tx.hash(false);

  const keyBundle = await client.getKey(vaultUri, keyName, keyVersion);
  const pubKey = Buffer.concat([Uint8Array.from([4]), keyBundle.key.x, keyBundle.key.y]);

  const signResult = await client.sign(vaultUri, keyName, keyVersion, 'ECDSA256', msgHash);
  const signature = makeCanonical(Buffer.from(signResult.result));

  let v = -1;
  // Recover the public key by comparing the recovered key with the actual public key.
  // If a match is found, that's the value of 'v'
  for (let i = 0; i <= 1; i++) {
    const recoveredPubKey = secp256k1.recover(msgHash, signature, i, false);
    if (_.isEqual(pubKey, recoveredPubKey)) {
      v = i;
      break;
    }
  }
  assert.strictEqual(true, v === 0 || v === 1);
  // As per the EIP-155 spec, the value of 'v' is also dependent on the chain id.
  // See: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md#specification
  v += 27;
  if (tx.getChainId() > 0) {
    v += tx.getChainId() * 2 + 8;
  }

  return {
    r: signature.slice(0, 32),
    s: signature.slice(32, 64),
    v: Buffer.from([v]),
  };
};
