const {GetMap} = require("../Factory/StableAndMockFactory");
const {CheckParameter} = require("../Tools/Check");
const {SetUniswapOracle} = require("../Core/UniswapOracleConfig");

const UniswapMap = new Map();

const GetUniswapMap = async () => {
    return UniswapMap;
}

const DeployUniswapByPancakeFactory = async (stableCoinPool, pancakeFactoryAddress, tokenAAddress, tokenBAddress) => {
    let tempMap = await GetMap();
    let rusd = tempMap.get("RUSD");
    let tra = tempMap.get("TRA");
    let usdc = tempMap.get("USDC");
    let usdcUniswapOracle;
    let rusdUniswapOracle;
    let traUniswapOracle;

    await CheckParameter([rusd, tra, usdc]);

    switch (tokenAAddress) {
        case usdc.address:
            usdcUniswapOracle = await SetUniswapOracle(stableCoinPool, pancakeFactoryAddress, tokenAAddress, tokenBAddress);
            UniswapMap.set("usdcUniswapOracle", usdcUniswapOracle.address);
            return usdcUniswapOracle;
        case rusd.address:
            rusdUniswapOracle = await SetUniswapOracle(stableCoinPool, pancakeFactoryAddress, tokenAAddress, tokenBAddress);
            UniswapMap.set("rusdUniswapOracle", rusdUniswapOracle.address);
            return rusdUniswapOracle;
        case tra.address:
            traUniswapOracle = await SetUniswapOracle(stableCoinPool, pancakeFactoryAddress, tokenAAddress, tokenBAddress);
            UniswapMap.set("traUniswapOracle", traUniswapOracle.address);
            return traUniswapOracle;
        default:
            throw Error("Pairs of coins undefined!");
    }
}

module.exports = {
    GetUniswapMap,
    DeployUniswapByPancakeFactory
}
