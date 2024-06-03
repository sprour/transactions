export const azureConfig = {
  tenantId: process.env.AZURE_TENANT_ID || 'foo-bar',
  clientId: process.env.AZURE_CLIENT_ID || '6d44e0e4-1da2-4f43-ac89-7e3d265e0b76',
  clientSecret: process.env.AZURE_CLIENT_SECRET || 'j5V.mYtZlpQc:O8/m8B2=p=-/7ytpzY_',
  vaultUri: process.env.AZURE_KEYVAULT_URI || 'https://account2pk.vault.azure.net',
  // tenantId: process.env.AZURE_TENANT_ID || 'foo-bar',
  // clientId: process.env.AZURE_CLIENT_ID || '668ca81b-dc2e-4306-affb-7d4b2a2d4d28',
  // clientSecret: process.env.AZURE_CLIENT_SECRET || 'ocmukdHa/+ZlVH9IR7v+VBD7lwQjec2Fi0Guq45l/S0=',
  // vaultUri: process.env.AZURE_KEYVAULT_URI || 'https://polybius-devkeyvault.vault.azure.net',

};
