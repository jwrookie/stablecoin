const {ethers} = require('hardhat');
const {RUSD,TRA,USDC} = require("../Factory/StableAndMockFactory");
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

const SetStableEthOracle = async (rusd, setConfig, ethAddress) => {
    await rusd.setStableEthOracle(setConfig.address, ethAddress.address);
}

const SetStockEthOracle = async (tra, setConfig, ethAddress) => {
    await tra.setStockEthOracle(setConfig.address, ethAddress.address);
}

const SetUniswapOracle = async (stableCoinPool, factory, coinPair, weth, user, timeLock) => {
    let argumentsLength = arguments.length;
    let argument;
    let uniswapOracle;

    for (let i = 0; i < argumentsLength; i++) {
        argument = arguments[i];
        if (ZEROADDRESS === argument.address || undefined === argument.address) {
            throw "Address zero exists!";
        }
    }

    const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    uniswapOracle = await UniswapPairOracle.deploy(
        factory.address,
        coinPairs.address,
        weth.address,
        user.address,
        timeLock.address
    )

    // TODO TYPE OF ASSERTIONS
    switch (coinPairs.address) {
        case USDC:
            await SetCollatETHOracle(stableCoinPool, uniswapOracle, weth);
            break;
        case RUSD:
            await SetStableEthOracle(coinPair, uniswapOracle, weth);
            expect(await coinPair.stableEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        case TRA:
            await SetStockEthOracle(coinPair, uniswapOracle, weth);
            expect(await coinPair.stockEthOracleAddress()).to.be.eq(uniswapOracle.address);
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