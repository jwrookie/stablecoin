const {SetTimeLock, SetUniswapOracle} = require("../Core/UniswapOracleConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetUniswap = async (userAddress, stableCoinPool, factory, coinPair, weth, user) => {
    let tempTimeLock = await SetTimeLock(userAddress);

    for (let i = 0; i < arguments.length; i++) {
        if (ZEROADDRESS === arguments[i] || null === arguments[i] || undefined === arguments[i]) {
            throw "Exist Invalid address!";
        }
    }

    await SetUniswapOracle(stableCoinPool, factory, coinPair, weth, user, tempTimeLock);
}

module.exports = {
    GetUniswap
}