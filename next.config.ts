import type { NextConfig } from 'next';

const AGENT_PORT = process.env.AGENT_PORT ?? '3001';
const AGENT_URL = `http://localhost:${AGENT_PORT}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,

  serverExternalPackages: [
    'better-sqlite3',
    'pino',
    '@tetherto/wdk',
    '@tetherto/wdk-wallet-evm',
    '@tetherto/wdk-wallet-evm-erc-4337',
    '@tetherto/wdk-wallet-tron',
    '@tetherto/wdk-wallet-tron-gasfree',
    '@tetherto/wdk-protocol-bridge-usdt0-evm',
    '@tetherto/wdk-protocol-fiat-moonpay',
    '@tetherto/wdk-pricing-bitfinex-http',
    '@tetherto/wdk-pricing-provider',
    'tronweb',
    'bip322-js',
    '@ton/core',
    '@ton/crypto',
    'ethers',
    'node-cron',
    '@anthropic-ai/sdk',
    '@web3-storage/w3up-client',
  ],

  // Empty turbopack config to silence dev-mode warnings
  turbopack: {},

  // Webpack extensionAlias lets .js imports resolve to .ts source files
  // (required because src/ server code uses Node ESM .js extension convention)
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },

  async rewrites() {
    return [
      {
        source: '/rumble/:path*',
        destination: `${AGENT_URL}/rumble/:path*`,
      },
      {
        source: '/api/agent/:path*',
        destination: `${AGENT_URL}/api/agent/:path*`,
      },
    ];
  },
};

export default nextConfig;
