import { NextRequest, NextResponse } from 'next/server';

/**
 * GET  /api/audience/deposit
 * Returns the deposit address(es) for the authenticated viewer so they can
 * fund their wallet via:
 *   a) a direct USDT on-chain transfer to their WDK wallet address
 *   b) a MoonPay on-ramp widget URL (if MOONPAY_API_KEY is configured)
 *
 * The UI shows a QR code / copy button for the direct transfer address and a
 * "Buy with card" link for MoonPay.
 */
export async function GET(req: NextRequest) {
  const h = req.headers.get('authorization') ?? req.headers.get('x-flow-session') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : h || undefined;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { authService } = await import('@/server/auth/service');
  const session = await authService.getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const depositAddress = session.address;
  const FAMILY_DEFAULT_CHAIN: Record<string, string> = {
    evm: 'polygon', evm_erc4337: 'polygon', tron_gasfree: 'tron', btc: 'bitcoin', ton: 'ton', ton_gasless: 'ton',
  };
  const network = FAMILY_DEFAULT_CHAIN[session.family] ?? session.family;

  // Build MoonPay widget URL when API key is present
  let moonpayUrl: string | null = null;
  const moonpayApiKey = process.env.MOONPAY_API_KEY;
  const moonpaySecret = process.env.MOONPAY_SECRET_KEY;
  if (moonpayApiKey && depositAddress) {
    const baseUrl = process.env.FLOW_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const theme = process.env.MOONPAY_WIDGET_THEME ?? 'dark';
    const redirectUrl = encodeURIComponent(`${baseUrl}/wallet`);
    const rawUrl =
      `https://buy.moonpay.com?apiKey=${moonpayApiKey}` +
      `&defaultCurrencyCode=usdt_polygon` +
      `&walletAddress=${depositAddress}` +
      `&redirectURL=${redirectUrl}` +
      `&colorCode=%23${(process.env.MOONPAY_WIDGET_COLOR ?? '7C3AED').replace('#', '')}` +
      `&theme=${theme}`;

    // Sign the URL if secret is present (HMAC-SHA256 per MoonPay docs)
    if (moonpaySecret) {
      const { createHmac } = await import('crypto');
      const urlObj = new URL(rawUrl);
      const sig = createHmac('sha256', moonpaySecret)
        .update(urlObj.search)
        .digest('base64');
      moonpayUrl = `${rawUrl}&signature=${encodeURIComponent(sig)}`;
    } else {
      moonpayUrl = rawUrl;
    }
  }

  return NextResponse.json({
    depositAddress,
    family: session.family,
    network,
    supportedTokens: ['USDT'],
    moonpayUrl,
    instructions: [
      `Send USDT to your wallet address on the ${network} network.`,
      'Tokens arrive in minutes and are immediately available for tipping.',
      moonpayUrl
        ? 'Or click "Buy with card" to purchase USDT via MoonPay (card/bank).'
        : 'Add MOONPAY_API_KEY to enable card on-ramp.',
    ],
  });
}
