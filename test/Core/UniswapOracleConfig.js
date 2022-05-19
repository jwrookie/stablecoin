const {ethers} = require('hardhat');
const {GraphicToken} = require("../Factory/StableAndMockFactory");
const {ZEROADDRESS} = require('../Lib/Address');
const {BigNumber} = require('ethers');

const SetTimeLock = async (userAddress, timeLockDuration = 259200) => {
    if (0 >= timeLockDuration) {
        throw "Please input right time!";
    }
    const Timelock = await ethers.getContractFactory("Timelock");
    return await Timelock.deploy(userAddress.address, BigNumber.from(timeLockDuration));
}

const SetCollatETHOracle = async (stableCoinPool, setConfig, ethAddress) => {
    await stableCoinPool.setCollatETHOracle(setConfig.address, ethAddress.address);
}

const SetStableEthOracle = async (setConfig, ethAddress) => {
    await GraphicToken.RUSDOBJECT.setStableEthOracle(setConfig.address, ethAddress.address);
}

const SetStockEthOracle = async (setConfig, ethAddress) => {
    await GraphicToken.RUSDOBJECT.setStockEthOracle(setConfig.address, ethAddress.address);
}

const SetUniswapOracle = async (stableCoinPool, factory, coinPairs, weth, user, timeLock) => {
    let uniswapOracle;

    const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    uniswapOracle = await UniswapPairOracle.deploy(
        factory.address,
        coinPairs.address,
        weth.address,
        user.address,
        timeLock.address
    );

    switch (coinPairs.address) {
        case GraphicToken.USDC:
            await SetCollatETHOracle(stableCoinPool, uniswapOracle, weth);
            break;
        case GraphicToken.RUSD:
            await SetStableEthOracle(uniswapOracle, weth);
            expect(await GraphicToken.RUSDOBJECT.stableEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        case GraphicToken.TRA:
            await SetStockEthOracle(uniswapOracle, weth);
            expect(await GraphicToken.RUSDOBJECT.stockEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        default:
            throw "Unknown token!";
    }
    return uniswapOracle;
}

module.exports = {
    SetTimeLock,
    SetUniswapOracle
}