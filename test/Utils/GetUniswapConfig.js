const {SetTimeLock, SetAddLiquidity} = require("../Core/UniswapOracleConfig");
const {SetChainlinkETHUSDPriceConsumer} = require("../Core/MockTokenConfig");
const {DeployUniswapByPancakeFactory} = require("../Factory/UniswapPairOracleFactory");
const {CheckParameter} = require("../Tools/Check");
const {GetMap} = require("../Factory/StableAndMockFactory");
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;

const ParameterObj = {
    tokenANumber: toWei("1"),
    tokenBNumber: toWei("1"),
    amplification: 0,
    fee: 0
}

const GetUniswapByPancakeFactory = async (userAddress, stableCoinPool, pancakeFactoryAddress, pariOfCoins = []) => {
    let tempUniswapOracle;

    if (!await CheckParameter([userAddress])) {
        throw Error("Exist Invalid Parameters!");
    }

    let tempTimeLock = await SetTimeLock(userAddress);

    tempUniswapOracle = await DeployUniswapByPancakeFactory(stableCoinPool, pancakeFactoryAddress, pariOfCoins[0], pariOfCoins[1], tempTimeLock);
    return tempUniswapOracle;
}

const AddLiquidityByPancakeRouter = async (pancakeFactory, pairOfCoin = [], pancakeRouter, approveNumber = toWei("10000"), coinLiquidity = [], operator) => {
    let date = Math.round(new Date() / 1000 + 2600000);

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
                        ParameterObj.tokenANumber = coinLiquidity[i];
                        break;
                    case 1:
                        ParameterObj.tokenBNumber = coinLiquidity[i];
                        break;
                    case 2:
                        ParameterObj.amplification = coinLiquidity[i];
                        break;
                    case 3:
                        ParameterObj.fee = coinLiquidity[i];
                        break;
                }
            }
        }
    }

    await pancakeFactory.createPair(pairOfCoin[0].address, pairOfCoin[1].address);
    await pairOfCoin[0].approve(pancakeRouter.address, ParameterObj.tokenANumber);
    await pairOfCoin[1].approve(pancakeRouter.address, ParameterObj.tokenBNumber);
    await SetAddLiquidity(pancakeRouter, pairOfCoin[0], pairOfCoin[1], ParameterObj.tokenANumber, ParameterObj.tokenBNumber, ParameterObj.amplification, ParameterObj.fee, operator, date);
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