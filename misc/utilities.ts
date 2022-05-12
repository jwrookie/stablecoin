const BigNumber = require('bignumber.js');
const axios = require('axios').default;
const chalk = require('chalk');


export const lpTokenBalance = async (contract: any, wallet_address: string, version: number) => {
    try {
        if (!wallet_address || wallet_address == "") return 0;
        if (version >= 1000) return 0; // UniV3 or NFT-based. This will get tallied later
        return await (contract.methods.balanceOf(wallet_address).call()
            .then(res => {
                return contract.methods.decimals().call()
                    .then(decs => {
                        return res / (10 ** decs);
                    })
            }));
    } catch (err) {
        throw `lpTokenBalance error: ${err}`;
    }
}

export const rewardBalances = async (contract: any, wallet_address: string, reward_token_decimals: number[]) => {
    try {
        if (!wallet_address || wallet_address == "") return 0;

        // You have to use earned() here instead of rewards() because of the order in which the contract executes 
        return await (contract.methods.earned(wallet_address).call()
            .then(res => {
                if (Array.isArray(res)) {
                    try {
                        return res.map((rwd_amt, idx) => {
                            const numerator = new BigNumber(rwd_amt);
                            const denominator = new BigNumber((10 ** reward_token_decimals[idx]));
                            return (numerator).div(denominator).toNumber();
                        })
                    } catch {
                        return Array(reward_token_decimals.length).fill(0);
                    }
                } else if (typeof res === 'object' && res !== null) {
                    // This is for tuple-d results
                    try {
                        const keys = Object.keys(res);
                        return keys.map((key, idx) => {
                            return res[key] / (10 ** reward_token_decimals[idx]);
                        })
                    } catch {
                        return Array(reward_token_decimals.length).fill(0);
                    }
                } else {
                    try {
                        return [res / (10 ** reward_token_decimals[0])];
                    } catch {
                        return [0];
                    }
                }
            }));
    } catch (err) {
        throw `rewardBalances error: ${err}`;
    }
}

export const rewardRates = async (
    contract: any,
    chain: any,
    reward_tokens: string[],
    version: number
) => {
    try {
        const reward_rates: number[] = [];
        if (version >= 1000) {
            reward_rates.push(await contract.methods.rewardRate0().call());
        } else if (version >= 100 && version < 200) {
            for (let i = 0; i < reward_tokens.length; i++) {
                const rwd_amt = await contract.methods.rewardRates(i).call();
                reward_rates.push(rwd_amt);
            }
            ;
        } else if (reward_tokens.length == 2 || chain != 'ethereum') {
            reward_rates.push(await contract.methods.rewardRate0().call());
            reward_rates.push(await contract.methods.rewardRate1().call());
        } else if (reward_tokens.length == 1) {
            reward_rates.push(await contract.methods.rewardRate().call());
        }
        return reward_rates
    } catch (err) {
        throw `rewardRates error: ${err}`;
    }
}

export const tokenBalanceStakingUnlocked = async (contract: any, wallet_address: string, version: number) => {
    if (!wallet_address || wallet_address == "") return 0;
    if (version > 2) return 0;

    return await (contract.methods.unlockedBalanceOf(wallet_address).call()
        .then(res => {
            return contract.methods.stakingDecimals().call()
                .then(decs => {
                    return res / (10 ** decs);
                })
        }));
}

export const tokenBalanceStakingLocked = async (contract: any, wallet_address: string, version: number) => {
    if (!wallet_address || wallet_address == "") return 0;
    if (version > 2) {
        return await (contract.methods.lockedLiquidityOf(wallet_address).call()
            .then(res => {
                return res / (10 ** 18);
            }));
    } else {
        return await (contract.methods.lockedBalanceOf(wallet_address).call()
            .then(res => {
                return contract.methods.stakingDecimals().call()
                    .then(decs => {
                        return res / (10 ** decs);
                    })
            }));
    }
}

export const stakingBalanceBoosted = async (contract: any, wallet_address: string, version: number) => {
    if (!wallet_address || wallet_address == "") return 0;
    if (version > 2) {
        return await (contract.methods.combinedWeightOf(wallet_address).call()
            .then(res => {
                return res / (10 ** 18);
            }));
    } else {
        return await (contract.methods.boostedBalanceOf(wallet_address).call()
            .then(res => {
                return contract.methods.stakingDecimals().call()
                    .then(decs => {
                        return res / (10 ** decs);
                    })
            }));
    }
}


export const tokenBalance = async (contract: any, wallet_address: string) => {
    if (!wallet_address || wallet_address === "") return 0;
    return await (contract.methods.balanceOf(wallet_address).call()
        .then(res => {
            return contract.methods.decimals().call()
                .then(decs => {
                    return res / (10 ** decs);
                })
        }));
}


export const jsonKeySwap = (json) => {
    let ret = {};
    for (let key in json) {
        ret[json[key]] = key;
    }
    return ret;
}

export const sortUnique = (arr) => {
    if (arr.length === 0) return arr;
    arr = arr.sort(function (a, b) {
        return a * 1 - b * 1;
    });
    var ret = [arr[0]];
    for (var i = 1; i < arr.length; i++) { //Start loop at 1: arr[0] can never be a duplicate
        if (arr[i - 1] !== arr[i]) {
            ret.push(arr[i]);
        }
    }
    return ret;
}

// From https://gist.github.com/sterlu/4b44f59ea665819974ae684d7f564d9b

const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60
const BLOCKS_IN_A_YEAR = SECONDS_PER_YEAR / 14

/**
 * Formula source: http://www.linked8.com/blog/158-apy-to-apr-and-apr-to-apy-calculation-methodologies
 *
 * @param apy {Number} APY as percentage (ie. 6)
 * @param frequency {Number} Compounding frequency (times a year)
 * @returns {Number} APR as percentage (ie. 5.82 for APY of 6%)
 */
export const apyToApr = (apy, frequency = BLOCKS_IN_A_YEAR) =>
    ((1 + apy / 100) ** (1 / frequency) - 1) * frequency * 100

/**
 * Formula source: http://www.linked8.com/blog/158-apy-to-apr-and-apr-to-apy-calculation-methodologies
 *
 * @param apr {Number} APR as percentage (ie. 5.82)
 * @param frequency {Number} Compounding frequency (times a year)
 * @returns {Number} APY as percentage (ie. 6 for APR of 5.82%)
 */
export const aprToApy = (apr, frequency = BLOCKS_IN_A_YEAR) => ((1 + apr / 100 / frequency) ** frequency - 1) * 100

export const EMPTY_LENDING_AMOS_DATA = (): LendingAMOsData => {
    return {
        aave_minted: 0,
        aave_frax_free: 0,
        aave_frax_total: 0,
        cream_frax_free: 0,
        cream_minted: 0,
        cream_frax_total: 0,
        hundred_minted: 0,
        hundred_frax_total: 0,
        rari_frax_free: 0,
        rari_minted: 0,
        rari_frax_total: 0,
        rari_pool_breakdown: [],
        scream_minted: 0,
        scream_frax_total: 0,
        spirit_ola_minted: 0,
        spirit_ola_frax_total: 0,
        total_frax_free: 0,
        total_minted: 0,
        total_frax: 0,
        total_profit: 0,
    };
}