const {ethers} = require('hardhat');
const {GetMap} = require("../Factory/StableAndMockFactory");
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

const SetUniswapPairOracle = async (factory, coinPairs, weth, timeLock) => {
    const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    return await UniswapPairOracle.deploy(
        factory.address,
        coinPairs.address,
        weth.address
    );
}

const SetUniswapOracle = async (stableCoinPool, factory, coinPairs, weth, timeLock) => {
    let GraphicMap = await GetMap();
    let uniswapOracle;

    switch (coinPairs) {
        case GraphicMap.get("USDC"):
            uniswapOracle = await SetUniswapPairOracle(factory, coinPairs, weth);
            await SetCollatETHOracle(stableCoinPool, uniswapOracle, weth);
            break;
        case GraphicMap.get("RUSD"):
            uniswapOracle = await SetUniswapPairOracle(factory, coinPairs, weth);
            await SetStableEthOracle(GraphicMap.get("RUSD"), uniswapOracle, weth);
            expect(await GraphicMap.get("RUSD").stableEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        case GraphicMap.get("TRA"):
            uniswapOracle = await SetUniswapPairOracle(factory, coinPairs, weth);
            await SetStockEthOracle(GraphicMap.get("RUSD"), uniswapOracle, weth);
            expect(await GraphicMap.get("RUSD").stockEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        default:
            throw Error("Can not find oracle what you want!");
    }
    return uniswapOracle;
}

module.exports = {
    SetTimeLock,
    SetUniswapOracle,
    SetAddLiquidity
}