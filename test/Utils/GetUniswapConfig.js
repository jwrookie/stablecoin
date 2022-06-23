const {SetChainlinkETHUSDPriceConsumer} = require("../Src/MockTokenConfig");
const {CheckParameter} = require("./Check");
const {BigNumber} = require('ethers');
const {ethers} = require('hardhat');
const {toWei} = web3.utils;

const SetAddLiquidity = async (pancakeRouter, tokenA, tokenB, tokenANumber, tokenBNumber, amplification, fee, operator, date) => {
    await pancakeRouter.addLiquidity(
        tokenA.address,
        tokenB.address,
        tokenANumber,
        tokenBNumber,
        amplification,
        fee,
        operator.address,
        date
    );
}

const SetUniswapPairOracle = async (pancakeFactoryAddress, tokenAAddress, tokenBAddress) => {
    const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    return await UniswapPairOracle.deploy(
        pancakeFactoryAddress,
        tokenAAddress,
        tokenBAddress,
    );
}

const GetUniswapByPancakeFactory = async (pancakeFactoryAddress, pairOfCoins = []) => {
    let tempUniswapOracle;

    for (let i = 0; i < 2; i++) {
        if ("string" !== typeof pairOfCoins[i]) {
            throw Error("GetUniswapByPancakeFactory: Type Error!");
        }
    }

    if ("string" !== typeof pancakeFactoryAddress) {
        throw Error("GetUniswapByPancakeFactory: Type Error!");
    }

    await CheckParameter([pancakeFactoryAddress, pairOfCoins[0], pairOfCoins[1]]);

    tempUniswapOracle = await SetUniswapPairOracle(pancakeFactoryAddress, pairOfCoins[0], pairOfCoins[1]);

    return tempUniswapOracle;
}

const AddLiquidityByPancakeRouter = async (pancakeFactory, pairOfCoin = [], pancakeRouter, approveNumber = toWei("10000"), liquidityOfCoins = [], operator) => {
    let date = Math.round(new Date() / 1000 + 260000000);
    let parameterObj = new Map();
    let pancakeRouterFactory = await pancakeRouter.factory();

    if (pancakeRouterFactory !== pancakeFactory.address) {
        throw Error("AddLiquidityByPancakeRouter: Routers that need to be deployed!");
    }

    parameterObj.set("tokenANumber", toWei("1"));
    parameterObj.set("tokenBNumber", toWei("1"));
    parameterObj.set("amplification", 0);
    parameterObj.set("fee", 0);

    for (let i = 0; i < pairOfCoin.length; i++) {
        if ("object" !== typeof pairOfCoin[i] || "{}" === JSON.stringify(pairOfCoin[i])) {
            throw Error("AddLiquidityByPancakeRouter: Check pairOfCoin!");
        }
    }

    for (let i = 0; i < liquidityOfCoins.length; i++) {
        if ("number" === typeof liquidityOfCoins[i] || "string" === typeof liquidityOfCoins[i]) {
            if (undefined !== liquidityOfCoins[i] && "" !== liquidityOfCoins[i] && 0 <= liquidityOfCoins[i]) {
                switch (i) {
                    case 0:
                        parameterObj.set("tokenANumber", liquidityOfCoins[i]);
                        break;
                    case 1:
                        parameterObj.set("tokenBNumber", liquidityOfCoins[i]);
                        break;
                    case 2:
                        parameterObj.set("amplification", liquidityOfCoins[i]);
                        break;
                    case 3:
                        parameterObj.set("fee", liquidityOfCoins[i]);
                        break;
                }
            }
        }
    }

    if (approveNumber < parameterObj.get("tokenANumber") || approveNumber < parameterObj.get("tokenBNumber")) {
        throw Error("AddLiquidityByPancakeRouter: Transaction will be fail!");
    }

    await pancakeFactory.createPair(pairOfCoin[0].address, pairOfCoin[1].address);
    await pairOfCoin[0].approve(pancakeRouter.address, approveNumber);
    await pairOfCoin[1].approve(pancakeRouter.address, approveNumber);
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

// Constants for various precisions
const SetETHUSDOracle = async (stableCoinObject, setAnswerValue = toWei("1")) => {
    let chainlinkETHUSDPriceConsumer;

    if ("object" !== typeof stableCoinObject || "{}" === JSON.stringify(stableCoinObject)) {
        throw Error("SetETHUSDOracle: Need stable coin object to set oracle!");
    }

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

    await stableCoinObject.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);
}

module.exports = {
    GetUniswapByPancakeFactory,
    AddLiquidityByPancakeRouter,
    SetETHUSDOracle
}