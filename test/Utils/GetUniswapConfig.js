const {SetTimeLock, SetUniswapOracle, SetAddLiquidity} = require("../Core/UniswapOracleConfig");
const {SetChainlinkETHUSDPriceConsumer} = require("../Core/MockTokenConfig");
const {GetCrvMap} = require("../Factory/DeployAboutCrvFactory");
const {GetMap} = require("../Factory/StableAndMockFactory");
const {ZEROADDRESS} = require("../Lib/Address");
const {toWei} = web3.utils;

const ParameterMap = {
    tokenANumber: toWei("1"),
    tokenBNumber: toWei("1"),
    amplification: 0,
    fee: 0
}

const GetUniswap = async (userAddress, stableCoinPool, factory, coinPair, weth) => {
    let tempUniswapOracle;
    let tempTimeLock = await SetTimeLock(userAddress);

    for (let i = 0; i < arguments.length; i++) {
        if (ZEROADDRESS === arguments[i] || undefined === arguments[i]) {
            throw Error("Exist Invalid address!");
        }
    }

    tempUniswapOracle = await SetUniswapOracle(stableCoinPool, factory, coinPair, weth, tempTimeLock);
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
                        ParameterMap.tokenANumber = parameter[i];
                        break;
                    case 1:
                        ParameterMap.tokenBNumber = parameter[i];
                        break;
                    case 2:
                        ParameterMap.amplification = parameter[i];
                        break;
                    case 3:
                        ParameterMap.fee = parameter[i];
                        break;
                }
            }
        }
    }

    if (undefined === coin || ZEROADDRESS === coin.address || undefined === user || ZEROADDRESS === user.address) {
        throw Error("Invalid coin or user!");
    }

    if (weth === undefined) {
        throw Error("RouterApprove: Please call function ConfigCrvFactory first!");
    }

    await coin.approve(router.address, approveNumber);
    await SetAddLiquidity(router, coin, weth, ParameterMap.tokenANumber, ParameterMap.tokenBNumber, ParameterMap.amplification, ParameterMap.fee, user, date);
}

const SetETHUSDOracle = async () => {
    let tempMap = await GetMap();
    let chainlinkETHUSDPriceConsumer = await SetChainlinkETHUSDPriceConsumer();

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