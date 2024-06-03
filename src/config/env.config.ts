import { TechnicalError } from '../common/errors';

const env = {
  dev: {
    ETHEREUM_NETWORK: 'https://rinkeby.infura.io/v3/0b79ef8db07b43aab1c5d6753197dcb5',
    ETHEREUM_NETWORK_ID: 4,
    BLOCKCYPHER_BASE_URL: 'https://api.blockcypher.com/v1',
    BLOCKCYPHER_CURRENCY: 'btc',
    BLOCKCYPHER_NETWORK: 'test3',
    CHAINSO_BASE_URL: 'https://chain.so/api/v2',
    CHAINSO_NETWORK: 'BTCTEST',
    BLOCKSTREAM_BASE_URL: 'https://blockstream.info',
    BLOCKSTREAM_NETWORK: 'testnet',
    NETWORK_MODE: 'test'
  },
  devMainNet: {
    ETHEREUM_NETWORK: 'https://mainnet.infura.io/v3/0b79ef8db07b43aab1c5d6753197dcb5',
    ETHEREUM_NETWORK_ID: 1,
    BLOCKCYPHER_BASE_URL: 'https://api.blockcypher.com/v1',
    BLOCKCYPHER_CURRENCY: 'btc',
    BLOCKCYPHER_NETWORK: 'main',
    CHAINSO_BASE_URL: 'https://chain.so/api/v2',
    CHAINSO_NETWORK: 'BTC',
    BLOCKSTREAM_BASE_URL: 'https://blockstream.info',
    BLOCKSTREAM_NETWORK: '',
    NETWORK_MODE: 'main'
  },
  prod: {
    ETHEREUM_NETWORK: 'https://mainnet.infura.io/v3/0b79ef8db07b43aab1c5d6753197dcb5',
    ETHEREUM_NETWORK_ID: 1,
    BLOCKCYPHER_BASE_URL: 'https://api.blockcypher.com/v1',
    BLOCKCYPHER_CURRENCY: 'btc',
    BLOCKCYPHER_NETWORK: 'main',
    CHAINSO_BASE_URL: 'https://chain.so/api/v2',
    CHAINSO_NETWORK: 'BTC',
    BLOCKSTREAM_BASE_URL: 'https://blockstream.info',
    BLOCKSTREAM_NETWORK: '',
    NETWORK_MODE: 'main'
  },
  test: {
    ETHEREUM_NETWORK: 'https://rinkeby.infura.io/v3/0b79ef8db07b43aab1c5d6753197dcb5',
    ETHEREUM_NETWORK_ID: 4,
    BLOCKCYPHER_BASE_URL: 'https://api.blockcypher.com/v1',
    BLOCKCYPHER_CURRENCY: 'btc',
    BLOCKCYPHER_NETWORK: 'test3',
    CHAINSO_BASE_URL: 'https://chain.so/api/v2',
    CHAINSO_NETWORK: 'BTCTEST',
    BLOCKSTREAM_BASE_URL: 'https://blockstream.info',
    BLOCKSTREAM_NETWORK: 'testnet',
    NETWORK_MODE: 'test'
  },
  default: {
    PORT: 3100,
    BLOCKCHAIN_PROVIDER: 'blockstream'
  }
};

export const envConfig = () => {
  if (!process.env.ENV_ID) {
    throw new TechnicalError('ENV_ID not set!');
  }

  return {
    get: name => process.env[name] || env[process.env.ENV_ID][name] || env.default[name],
  };
};
