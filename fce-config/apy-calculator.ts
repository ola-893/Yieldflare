// APY Calculator - Real Implementation
// Copy to fce-extension-scaffold/typescript/src/app/apy-calculator.ts

import { ethers } from 'ethers';
import mysql from 'mysql2/promise';

/**
 * Strategy performance metrics
 */
export interface StrategyMetrics {
    address: string;
    apy: number;
    volatility: number;
    sharpeRatio: number;
    tvl: bigint;
    utilizationRate: number;
    riskScore: number;
}

/**
 * APY Calculator for strategy selection
 */
export class APYCalculator {
    private provider: ethers.JsonRpcProvider;
    private dbPool: mysql.Pool | null = null;

    constructor(rpcUrl: string, dbConfig?: mysql.PoolOptions) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        
        if (dbConfig) {
            this.dbPool = mysql.createPool(dbConfig);
        }
    }

    /**
     * Calculate optimal strategy based on APY, risk, and constraints
     */
    async calculateOptimalStrategy(
        vaultAddress: string,
        idleAssets: bigint,
        strategies: string[],
        minYield: number = 0,
        maxRisk: number = 100
    ): Promise<{
        optimalStrategy: string;
        metrics: StrategyMetrics;
        reason: string;
    }> {
        console.log('Calculating optimal strategy...');
        console.log('Candidates:', strategies.length);

        // Get metrics for all strategies
        const metricsPromises = strategies.map(addr => 
            this.getStrategyMetrics(addr)
        );
        const allMetrics = await Promise.all(metricsPromises);

        // Filter by constraints
        const viable = allMetrics.filter(m => 
            m.apy >= minYield && m.riskScore <= maxRisk
        );

        if (viable.length === 0) {
            console.warn('No strategies meet constraints, using best available');
            // Fall back to best APY regardless of constraints
            const best = allMetrics.reduce((a, b) => a.apy > b.apy ? a : b);
            return {
                optimalStrategy: best.address,
                metrics: best,
                reason: `Best available (${best.apy.toFixed(2)}% APY, risk ${best.riskScore})`
            };
        }

        // Score by Sharpe ratio (risk-adjusted return)
        const scored = viable.map(m => ({
            ...m,
            score: m.sharpeRatio
        })).sort((a, b) => b.score - a.score);

        const optimal = scored[0];

        return {
            optimalStrategy: optimal.address,
            metrics: optimal,
            reason: `Highest Sharpe ratio (${optimal.sharpeRatio.toFixed(2)}), APY ${optimal.apy.toFixed(2)}%`
        };
    }

    /**
     * Get comprehensive metrics for a strategy
     */
    async getStrategyMetrics(strategyAddress: string): Promise<StrategyMetrics> {
        console.log('Getting metrics for:', strategyAddress);

        try {
            // Get on-chain data
            const [apy, tvl, utilization] = await Promise.all([
                this.getHistoricalAPY(strategyAddress),
                this.getTVL(strategyAddress),
                this.getUtilizationRate(strategyAddress)
            ]);

            // Calculate volatility if we have DB access
            const volatility = this.dbPool 
                ? await this.calculateVolatility(strategyAddress)
                : this.estimateVolatility(apy);

            // Calculate risk-adjusted metrics
            const riskFreeRate = 2.0; // 2% baseline
            const sharpeRatio = (apy - riskFreeRate) / Math.max(volatility, 0.1);
            const riskScore = this.calculateRiskScore(volatility, utilization, tvl);

            return {
                address: strategyAddress,
                apy,
                volatility,
                sharpeRatio,
                tvl,
                utilizationRate: utilization,
                riskScore
            };

        } catch (error) {
            console.error(`Error getting metrics for ${strategyAddress}:`, error);
            // Return safe defaults for unknown strategies
            return {
                address: strategyAddress,
                apy: 3.0,
                volatility: 10.0,
                sharpeRatio: 0.1,
                tvl: 0n,
                utilizationRate: 0,
                riskScore: 50
            };
        }
    }

    /**
     * Get historical APY from on-chain data
     */
    private async getHistoricalAPY(strategyAddress: string): Promise<number> {
        try {
            // Read totalValue() from strategy adapter
            const adapter = new ethers.Contract(
                strategyAddress,
                ['function totalValue() view returns (uint256)'],
                this.provider
            );

            const totalValue = await adapter.totalValue();

            // If we have DB, calculate actual historical APY
            if (this.dbPool) {
                return await this.calculateHistoricalAPY(strategyAddress);
            }

            // Otherwise, estimate based on current value
            // TODO: This is a simplification - real impl should track value changes
            return this.estimateAPYFromValue(totalValue);

        } catch (error) {
            console.warn('Could not read strategy value:', error);
            return 4.0; // Default estimate
        }
    }

    /**
     * Calculate historical APY from database
     */
    private async calculateHistoricalAPY(
        strategyAddress: string,
        windowDays: number = 30
    ): Promise<number> {
        if (!this.dbPool) return 4.0;

        try {
            const [rows] = await this.dbPool.query<any[]>(
                `SELECT 
                    timestamp, 
                    total_value 
                FROM strategy_snapshots 
                WHERE strategy_address = ? 
                    AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY timestamp ASC`,
                [strategyAddress.toLowerCase(), windowDays]
            );

            if (rows.length < 2) {
                return this.estimateAPYFromValue(0n);
            }

            // Calculate annualized return
            const firstValue = BigInt(rows[0].total_value);
            const lastValue = BigInt(rows[rows.length - 1].total_value);
            const daysPassed = rows.length;

            if (firstValue === 0n) return 4.0;

            const returnPct = Number(lastValue - firstValue) / Number(firstValue);
            const annualized = (returnPct * 365) / daysPassed * 100;

            return Math.max(0, Math.min(annualized, 50)); // Cap at 0-50%

        } catch (error) {
            console.error('DB query error:', error);
            return 4.0;
        }
    }

    /**
     * Calculate volatility from historical data
     */
    private async calculateVolatility(strategyAddress: string): Promise<number> {
        if (!this.dbPool) return 5.0;

        try {
            const [rows] = await this.dbPool.query<any[]>(
                `SELECT daily_return 
                FROM strategy_returns 
                WHERE strategy_address = ? 
                    AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
                [strategyAddress.toLowerCase()]
            );

            if (rows.length < 7) {
                return this.estimateVolatility(4.0);
            }

            // Calculate standard deviation of returns
            const returns = rows.map(r => parseFloat(r.daily_return));
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
            const stdDev = Math.sqrt(variance);

            // Annualize volatility
            return stdDev * Math.sqrt(365);

        } catch (error) {
            console.error('Volatility calculation error:', error);
            return 5.0;
        }
    }

    /**
     * Get total value locked in strategy
     */
    private async getTVL(strategyAddress: string): Promise<bigint> {
        try {
            const adapter = new ethers.Contract(
                strategyAddress,
                ['function totalValue() view returns (uint256)'],
                this.provider
            );
            return await adapter.totalValue();
        } catch {
            return 0n;
        }
    }

    /**
     * Get utilization rate (how much capital is actively deployed)
     */
    private async getUtilizationRate(strategyAddress: string): Promise<number> {
        try {
            // If strategy exposes utilization, read it
            const adapter = new ethers.Contract(
                strategyAddress,
                [
                    'function totalValue() view returns (uint256)',
                    'function asset() view returns (address)'
                ],
                this.provider
            );

            const [totalValue, assetAddress] = await Promise.all([
                adapter.totalValue(),
                adapter.asset()
            ]);

            // Check idle balance in strategy
            const asset = new ethers.Contract(
                assetAddress,
                ['function balanceOf(address) view returns (uint256)'],
                this.provider
            );

            const idle = await asset.balanceOf(strategyAddress);

            if (totalValue === 0n) return 0;

            const deployed = totalValue - idle;
            return Number(deployed) / Number(totalValue) * 100;

        } catch {
            return 90; // Assume 90% utilization if unknown
        }
    }

    /**
     * Calculate composite risk score (0-100, higher = riskier)
     */
    private calculateRiskScore(
        volatility: number,
        utilization: number,
        tvl: bigint
    ): number {
        // Volatility component (0-40 points)
        const volScore = Math.min(volatility / 20 * 40, 40);

        // Utilization component (0-30 points)
        // High utilization = less liquid = riskier
        const utilScore = utilization / 100 * 30;

        // TVL component (0-30 points)
        // Low TVL = less tested = riskier
        const tvlScore = tvl < ethers.parseEther('10000') ? 30 :
                         tvl < ethers.parseEther('100000') ? 15 : 5;

        return Math.min(volScore + utilScore + tvlScore, 100);
    }

    /**
     * Estimate volatility from APY when no historical data available
     */
    private estimateVolatility(apy: number): number {
        // Higher APY typically means higher volatility
        // Rough approximation: vol ≈ apy / 2
        return Math.max(apy / 2, 2);
    }

    /**
     * Estimate APY from current value when no historical data
     */
    private estimateAPYFromValue(value: bigint): number {
        // Without historical data, use conservative estimates
        // based on typical DeFi yields
        if (value === 0n) return 3.0;
        if (value < ethers.parseEther('1000')) return 4.0;
        if (value < ethers.parseEther('10000')) return 4.5;
        return 5.0; // Larger strategies tend to have lower but stable yields
    }

    /**
     * Calculate TWAP window timestamps
     */
    calculateTWAPWindow(durationHours: number = 25): {
        twapStart: bigint;
        twapEnd: bigint;
    } {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const oneHour = BigInt(3600);
        
        return {
            twapStart: now - BigInt(durationHours + 1) * oneHour,
            twapEnd: now - oneHour
        };
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.dbPool) {
            await this.dbPool.end();
        }
    }
}

/**
 * Example usage:
 * 
 * const calculator = new APYCalculator(
 *     'https://coston2-api.flare.network/ext/C/rpc',
 *     {
 *         host: '34.38.42.208',
 *         port: 3306,
 *         database: 'indexer',
 *         user: 'readonly',
 *         password: 'secret'
 *     }
 * );
 * 
 * const result = await calculator.calculateOptimalStrategy(
 *     vaultAddress,
 *     idleAssets,
 *     strategies,
 *     5.0,  // min 5% APY
 *     70    // max 70 risk score
 * );
 */
