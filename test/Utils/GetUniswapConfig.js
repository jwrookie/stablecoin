const {SetAddLiquidity} = require("../Core/UniswapOracleConfig");
const {SetChainlinkETHUSDPriceConsumer} = require("../Core/MockTokenConfig");
const {DeployUniswapByPancakeFactory} = require("../Factory/UniswapPairOracleFactory");
const {GetMap} = require("../Factory/StableAndMockFactory");
const {CheckParameter} = require("../Tools/Check");
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;

const GetUniswapByPancakeFactory = async (stableCoinPool, pancakeFactoryAddress, pairOfCoins = []) => {
    let tempUniswapOracle;

    await CheckParameter([stableCoinPool, pairOfCoins[0], pairOfCoins[1]]);

    tempUniswapOracle = await DeployUniswapByPancakeFactory(stableCoinPool, pancakeFactoryAddress, pairOfCoins[0], pairOfCoins[1]);
    return tempUniswapOracle;
}

const AddLiquidityByPancakeRouter = async (pancakeFactory, pairOfCoin = [], pancakeRouter, approveNumber = toWei("10000"), coinLiquidity = [], operator) => {
    let date = Math.round(new Date() / 1000 + 2600000);
    let parameterObj = new Map();

    parameterObj.set("tokenANumber", toWei("1"));
    parameterObj.set("tokenBNumber", toWei("1"));
    parameterObj.set("amplification", 0);
    parameterObj.set("fee", 0);

    for (let i = 0; i < pairOfCoin.length; i++) {
        if ("object" !== typeof pairOfCoin[i] || "{}" === JSON.stringify(pairOfCoin[i])) {
            throw Error("AddLiquidityByPancakeRouter: Check pairOfCoin!");
        }
    }

    for (let i = 0; i < coinLiquidity.length; i++) {
        if ("number" === typeof coinLiquidity[i] || "string" === typeof coinLiquidity[i]) {
            if (undefined !== coinLiquidity[i] && 0 <= coinLiquidity[i]) {
                switch (i) {
                    case 0:
                        parameterObj.set("tokenANumber", coinLiquidity[i]);
                        break;
                    case 1:
                        parameterObj.set("tokenBNumber", coinLiquidity[i]);
                        break;
                    case 2:
                        parameterObj.set("amplification", coinLiquidity[i]);
                        break;
                    case 3:
                        parameterObj.set("fee", coinLiquidity[i]);
                        break;
                }
            }
        }
    }

    await pancakeFactory.createPair(pairOfCoin[0].address, pairOfCoin[1].address);
    await pairOfCoin[0].approve(pancakeRouter.address, parameterObj.get("tokenANumber"));
    await pairOfCoin[1].approve(pancakeRouter.address, parameterObj.get("tokenBNumber"));
    await SetAddLiquidity(
        pancakeRouter,
        pairOfCoin[0],
        pairOfCoin[1],
        parameterObj.get("tokenANumber"),
        parameterObj.get("tokenBNumber"),
        parameterObj.get("amplification"),
        parameterObj.get("fee"),
        operator,
        date
    );
}

const SetETHUSDOracle = async (setAnswerValue = toWei("1")) => {
    let tempMap = await GetMap();
    let chainlinkETHUSDPriceConsumer;

    switch (typeof setAnswerValue) {
        case "number":
            chainlinkETHUSDPriceConsumer = await SetChainlinkETHUSDPriceConsumer(BigNumber.from(setAnswerValue.toString()));
            break;
        case "string":
            chainlinkETHUSDPriceConsumer = await SetChainlinkETHUSDPriceConsumer(BigNumber.from(setAnswerValue));
            break;
        default:
            throw Error("Unknow type of parameter!");
    }

    if (undefined === tempMap.get("RUSD")) {
        throw Error("Need to set rusd first!");
    }

    await tempMap.get("RUSD").setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);
}

module.exports = {
    GetUniswapByPancakeFactory,
    AddLiquidityByPancakeRouter,
    SetETHUSDOracle
}