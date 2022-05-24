const {SetTimeLock, SetUniswapOracle, SetAddLiquidity} = require("../Core/UniswapOracleConfig");
const {SetChainlinkETHUSDPriceConsumer} = require("../Core/MockTokenConfig");
const {GetCrvMap} = require("../Factory/DeployAboutCrvFactory");
const {GetMap} = require("../Factory/StableAndMockFactory");
const {ZEROADDRESS} = require("../Lib/Address");
const {toWei} = web3.utils;

const ParameterObj = {
    tokenANumber: toWei("1"),
    tokenBNumber: toWei("1"),
    amplification: 0,
    fee: 0
}

const GetUniswap = async (userAddress, stableCoinPool, factory, coinPair, grapplingCoin) => {
    let tempUniswapOracle;
    let tempArray = new Array();

    tempArray.push(
        userAddress,
        stableCoinPool,
        factory,
        coinPair,
        grapplingCoin
    );

    for (let i = 0; i < tempArray.length; i++) {
        if ("object" !== typeof tempArray[i] || undefined === tempArray[i].address) {
            throw Error("Exist Invalid Parameters!");
        }
    }

    let tempTimeLock = await SetTimeLock(userAddress);

    tempUniswapOracle = await SetUniswapOracle(stableCoinPool, factory, coinPair, grapplingCoin, tempTimeLock);
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

    if (undefined === coin || ZEROADDRESS === coin.address || undefined === user || ZEROADDRESS === user.address) {
        throw Error("Invalid coin or user!");
    }

    if (weth === undefined) {
        throw Error("RouterApprove: Please call function ConfigCrvFactory first!");
    }

    await coin.approve(router.address, approveNumber);
    await SetAddLiquidity(router, coin, weth, ParameterObj.tokenANumber, ParameterObj.tokenBNumber, ParameterObj.amplification, ParameterObj.fee, user, date);
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