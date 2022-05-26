const {GetMap} = require("../Factory/StableAndMockFactory");
const {SetUniswapOracle} = require("../Core/UniswapOracleConfig");

const UniswapMap = new Map();

const GetUniswapMap = async () => {
    return UniswapMap;
}

const DeployUniswapFactory = async (stableCoinPool, factory, coinPairs, weth, timeLock) => {
    let tempMap = await GetMap();
    let rusd = tempMap.get("RUSD");
    let tra = tempMap.get("TRA");
    let usdc = tempMap.get("USDC");
    let usdcUniswapOracle;
    let rusdUniswapOracle;
    let traUniswapOracle;

    for (let key in tempMap) {
        if (undefined === tempMap.get(key)) {
            throw Error("Undefined Error!");
        }
    }

    switch (coinPairs) {
        case usdc:
            usdcUniswapOracle = await SetUniswapOracle(stableCoinPool, factory, coinPairs, weth, timeLock);
            UniswapMap.set("usdcUniswapOracle", usdcUniswapOracle.address);
            return usdcUniswapOracle;
        case rusd:
            rusdUniswapOracle = await SetUniswapOracle(stableCoinPool, factory, coinPairs, weth, timeLock);
            UniswapMap.set("rusdUniswapOracle", rusdUniswapOracle.address);
            return rusdUniswapOracle;
        case tra:
            traUniswapOracle = await SetUniswapOracle(stableCoinPool, factory, coinPairs, weth, timeLock);
            UniswapMap.set("traUniswapOracle", traUniswapOracle.address);
            return traUniswapOracle;
        default:
            throw Error("Coin pairs undefined!");
    }
}

module.exports = {
    GetUniswapMap,
    DeployUniswapFactory
}
