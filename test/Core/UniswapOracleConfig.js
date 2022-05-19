const {ethers} = require('hardhat');
const {GetMap} = require("../Factory/StableAndMockFactory");
const {ZEROADDRESS} = require('../Lib/Address');
const {BigNumber} = require('ethers');

const SetTimeLock = async (userAddress, timeLockDuration = 259200) => {
    if (0 >= timeLockDuration) {
        throw Error("Please input right time!");
    }
    const Timelock = await ethers.getContractFactory("Timelock");
    return await Timelock.deploy(userAddress.address, BigNumber.from(timeLockDuration));
}

const SetCollatETHOracle = async (stableCoinPool, setConfig, ethAddress) => {
    await stableCoinPool.setCollatETHOracle(setConfig.address, ethAddress.address);
}

const SetStableEthOracle = async (tokenObject, setConfig, ethAddress) => {
    await tokenObject.setStableEthOracle(setConfig.address, ethAddress.address);
}

const SetStockEthOracle = async (tokenObject, setConfig, ethAddress) => {
    await tokenObject.setStockEthOracle(setConfig.address, ethAddress.address);
}

const SetAddLiquidity = async (router, tokenA, tokenB, tokenANumber, tokenBNumber, amplification, fee, user, date) => {
    await router.addLiquidity(
        tokenA.address,
        tokenB.address,
        tokenANumber,
        tokenBNumber,
        amplification,
        fee,
        user.address,
        date
    );
}

const SetUniswapOracle = async (stableCoinPool, factory, coinPairs, weth, timeLock) => {
    let GraphicMap = await GetMap();
    let uniswapOracle;

    const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    uniswapOracle = await UniswapPairOracle.deploy(
        factory.address,
        coinPairs.address,
        weth.address,
        timeLock.address
    );

    switch (coinPairs) {
        case GraphicMap.get("USDC"):
            await SetCollatETHOracle(stableCoinPool, uniswapOracle, weth);
            break;
        case GraphicMap.get("RUSD"):
            await SetStableEthOracle(GraphicMap.get("RUSD"), uniswapOracle, weth);
            expect(await GraphicMap.get("RUSD").stableEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        case GraphicMap.get("TRA"):
            await SetStockEthOracle(GraphicMap.get("RUSD"), uniswapOracle, weth);
            expect(await GraphicMap.get("RUSD").stockEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        default:
            throw Error("Unknown token!");
    }
    return uniswapOracle;
}

module.exports = {
    SetTimeLock,
    SetUniswapOracle,
    SetAddLiquidity
}