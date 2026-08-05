/**
 * useCryptoPrices - React hook to fetch XRP, BTC prices from CoinGecko
 * 
 * Features:
 * - Fetches real-time XRP and BTC prices from CoinGecko free API
 * - Caches prices for 60 seconds to avoid rate limits
 * - Falls back to hardcoded prices if API fails
 * - C2FLR is a testnet token with no market price - excluded
 * - CDP is a stablecoin pegged to ~$1
 */

import {useState, useEffect, useCallback} from 'react';

interface CryptoPriceData {
  xrp: {price: number; change24h: number};
  btc: {price: number; change24h: number};
  cdp: {price: number; change24h: number};
  lastUpdated: Date;
  isLoading: boolean;
  error: string | null;
}

// Fallback prices if API fails
const FALLBACK_PRICES = {
  xrp: 2.40,
  btc: 96000,
  cdp: 1.00, // CDP is a stablecoin pegged to ~$1
};

const CACHE_DURATION_MS = 60_000; // Cache for 60 seconds
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';

// Simple in-memory cache
let cachedPrices: {
  xrp: {price: number; change24h: number};
  btc: {price: number; change24h: number};
  cdp: {price: number; change24h: number};
  timestamp: number;
} | null = null;

export function useCryptoPrices(): CryptoPriceData {
  const [data, setData] = useState<CryptoPriceData>({
    xrp: {price: cachedPrices?.xrp.price ?? FALLBACK_PRICES.xrp, change24h: cachedPrices?.xrp.change24h ?? 0},
    btc: {price: cachedPrices?.btc.price ?? FALLBACK_PRICES.btc, change24h: cachedPrices?.btc.change24h ?? 0},
    cdp: {price: cachedPrices?.cdp.price ?? FALLBACK_PRICES.cdp, change24h: cachedPrices?.cdp.change24h ?? 0},
    lastUpdated: cachedPrices ? new Date(cachedPrices.timestamp) : new Date(),
    isLoading: false,
    error: null,
  });

  const fetchPrices = useCallback(async () => {
    // Check cache first
    if (cachedPrices && Date.now() - cachedPrices.timestamp < CACHE_DURATION_MS) {
      setData({
        xrp: cachedPrices.xrp,
        btc: cachedPrices.btc,
        cdp: cachedPrices.cdp,
        lastUpdated: new Date(cachedPrices.timestamp),
        isLoading: false,
        error: null,
      });
      return;
    }

    setData(prev => ({...prev, isLoading: true, error: null}));

    try {
      // Fetch XRP and BTC from CoinGecko
      const response = await fetch(
        `${COINGECKO_API}?ids=ripple,bitcoin&vs_currencies=usd&include_24hr_change=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Parse XRP price
      const xrpPrice = data.ripple?.usd ?? FALLBACK_PRICES.xrp;
      const xrpChange24h = data.ripple?.usd_24h_change ?? 0;

      // Parse BTC price
      const btcPrice = data.bitcoin?.usd ?? FALLBACK_PRICES.btc;
      const btcChange24h = data.bitcoin?.usd_24h_change ?? 0;

      // CDP is a stablecoin - pegged to ~$1
      const cdpPrice = FALLBACK_PRICES.cdp;
      const cdpChange24h = 0;

      // Update cache
      cachedPrices = {
        xrp: {price: xrpPrice, change24h: xrpChange24h},
        btc: {price: btcPrice, change24h: btcChange24h},
        cdp: {price: cdpPrice, change24h: cdpChange24h},
        timestamp: Date.now(),
      };

      setData({
        xrp: {price: xrpPrice, change24h: xrpChange24h},
        btc: {price: btcPrice, change24h: btcChange24h},
        cdp: {price: cdpPrice, change24h: cdpChange24h},
        lastUpdated: new Date(),
        isLoading: false,
        error: null,
      });

      console.log(`[Prices] Updated: XRP $${xrpPrice.toFixed(4)} | BTC $${btcPrice.toLocaleString()}`);
    } catch (err) {
      console.warn('[Prices] Failed to fetch, using fallback:', err);
      
      // Use cached prices if available, otherwise fallback
      const fallbackData = cachedPrices ?? {
        xrp: {price: FALLBACK_PRICES.xrp, change24h: 0},
        btc: {price: FALLBACK_PRICES.btc, change24h: 0},
        cdp: {price: FALLBACK_PRICES.cdp, change24h: 0},
      };
      
      setData({
        xrp: fallbackData.xrp,
        btc: fallbackData.btc,
        cdp: fallbackData.cdp,
        lastUpdated: cachedPrices ? new Date(cachedPrices.timestamp) : new Date(),
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch prices',
      });
    }
  }, []);

  // Fetch prices on mount and set up interval
  useEffect(() => {
    fetchPrices();

    // Refresh prices every 2 minutes
    const interval = setInterval(fetchPrices, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchPrices]);

  return data;
}

// Keep backward compatibility
export function useXrpPrice() {
  const prices = useCryptoPrices();
  return {
    price: prices.xrp.price,
    change24h: prices.xrp.change24h,
    lastUpdated: prices.lastUpdated,
    isLoading: prices.isLoading,
    error: prices.error,
  };
}

/**
 * Helper to convert amount to USD using specified asset price
 */
export function toUsd(amount: number, price: number): number {
  return amount * price;
}

/**
 * Helper to format USD value
 */
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0';
  if (amount < 0.01) return '<$0.01';
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  if (amount < 1_000_000) return `$${(amount / 1000).toFixed(2)}K`;
  return `$${(amount / 1_000_000).toFixed(2)}M`;
}

// Backward compatibility alias
export const xrpToUsd = toUsd;
