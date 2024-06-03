export const blockStreamConfig = {
  baseUrl: process.env.BLOCKSTREAM_BASE_URL || 'https://blockstream.info',
  network: process.env.BLOCKSTREAM_NETWORK || 'testnet',
  feeBaseUrl: 'https://api.blockcypher.com/v1',
  feeNetwork: 'test3',
};
