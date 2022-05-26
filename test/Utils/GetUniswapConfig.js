const {SetTimeLock, SetAddLiquidity} = require("../Core/UniswapOracleConfig");
const {SetChainlinkETHUSDPriceConsumer} = require("../Core/MockTokenConfig");
const {DeployUniswapFactory} = require("../Factory/UniswapPairOracleFactory");
const {CheckParameter} = require("../Tools/Check");
const {GetCrvMap} = require("../Factory/DeployAboutCrvFactory");
const {GetMap} = require("../Factory/StableAndMockFactory");
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;

const ParameterObj = {
    tokenANumber: toWei("1"),
    tokenBNumber: toWei("1"),
    amplification: 0,
    fee: 0
}

const GetUniswap = async (userAddress, stableCoinPool, factory, coinPair, grapplingCoin) => {
    let tempUniswapOracle;

    if (!await CheckParameter([userAddress, stableCoinPool, factory, coinPair, grapplingCoin])) {
        throw Error("Exist Invalid Parameters!");
    }

    let tempTimeLock = await SetTimeLock(userAddress);

    tempUniswapOracle = await DeployUniswapFactory(stableCoinPool, factory, coinPair, grapplingCoin, tempTimeLock);
    return tempUniswapOracle;
}

const RouterApprove = async (coin, approveNumber = toWei("10000"), parameter = [], user) => {
    let date = Math.round(new Date() / 1000 + 2600000);
    let crvMap = await GetCrvMap();
    let weth = crvMap.get("weth");
    let router = crvMap.get("router");

    for (let i = 0; i < parameter.length; i++) {
        if ("number" === typeof parameter[i] || "string" === typeof parameter[i]) {
            if (undefined !== parameter[i] && 0 <= parameter[i]) {
                switch (i) {
                    case 0:
                        ParameterObj.tokenANumber = parameter[i];
                        break;
                    case 1:
                        ParameterObj.tokenBNumber = parameter[i];
                        break;
                    case 2:
                        ParameterObj.amplification = parameter[i];
                        break;
                    case 3:
                        ParameterObj.fee = parameter[i];
                        break;
                }
            }
        }
    }

    if (!await CheckParameter([coin, user])) {
        throw Error("Invalid coin or user!");
    }

    if (weth === undefined) {
        throw Error("RouterApprove: Please call function ConfigCrvFactory first!");
    }

    await coin.approve(router.address, approveNumber);
    await SetAddLiquidity(router, coin, weth, ParameterObj.tokenANumber, ParameterObj.tokenBNumber, ParameterObj.amplification, ParameterObj.fee, user, date);
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
    GetUniswap,
    RouterApprove,
    SetETHUSDOracle
}