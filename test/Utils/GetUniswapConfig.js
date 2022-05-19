const {SetTimeLock, SetUniswapOracle, SetAddLiquidity} = require("../Core/UniswapOracleConfig");
const {GetCrvMap} = require("../Factory/DeployAboutCrvFactory");
const {toWei} = web3.utils;
const {ZEROADDRESS} = require("../Lib/Address");

const GetUniswap = async (userAddress, stableCoinPool, factory, coinPair, weth) => {
    let tempUniswapOracle;
    let tempTimeLock = await SetTimeLock(userAddress);

    for (let i = 0; i < arguments.length; i++) {
        if (ZEROADDRESS === arguments[i] || null === arguments[i] || undefined === arguments[i]) {
            throw Error("Exist Invalid address!");
        }
    }

    tempUniswapOracle = await SetUniswapOracle(stableCoinPool, factory, coinPair, weth, userAddress, tempTimeLock);
    return tempUniswapOracle;
}

const RouterApprove = async (
    coin, {approveNumber = toWei("10000"), tokenANumber = toWei("1"), tokenBNumber = toWei("1"), amplification = 0, fee = 0} = {}, user
) => {
    let date = Math.round(new Date() / 1000 + 2600000);
    let crvMap = await GetCrvMap();
    let weth = crvMap.get("weth");
    let router = crvMap.get("router");

    if (undefined === coin || ZEROADDRESS === coin.address || undefined === user || ZEROADDRESS === user.address) {
        throw Error("Invalid coin or user!");
    }

    if (weth === undefined) {
        throw Error("RouterApprove: Please call function ConfigCrvFactory first!");
    }

    await coin.approve(router.address, approveNumber);
    await SetAddLiquidity(router, coin, weth, tokenANumber, tokenBNumber, amplification, fee, user, date);
}

module.exports = {
    GetUniswap,
    RouterApprove
}