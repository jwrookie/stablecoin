const {SetTimeLock, SetUniswapOracle} = require("../Core/UniswapOracleConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetUniswap = async (userAddress, stableCoinPool, factory, coinPair, weth) => {
    let tempUniswapOracle;
    let tempTimeLock = await SetTimeLock(userAddress);

    for (let i = 0; i < arguments.length; i++) {
        if (ZEROADDRESS === arguments[i] || null === arguments[i] || undefined === arguments[i]) {
            throw "Exist Invalid address!";
        }
    }

    tempUniswapOracle = await SetUniswapOracle(stableCoinPool, factory, coinPair, weth, userAddress, tempTimeLock);
    return tempUniswapOracle;
}

module.exports = {
    GetUniswap
}