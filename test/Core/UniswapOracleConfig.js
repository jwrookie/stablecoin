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
    await stableCoinPool.setCollatETHOracle(setConfig.address, ethAddress);
}

const SetStableEthOracle = async (stableCoin, setConfig, ethAddress) => {
    await stableCoin.setStableEthOracle(setConfig.address, ethAddress);
}

const SetStockEthOracle = async (stableCoin, setConfig, ethAddress) => {
    await stableCoin.setStockEthOracle(setConfig.address, ethAddress);
}

const SetAddLiquidity = async (pancakeRouter, tokenA, tokenB, tokenANumber, tokenBNumber, amplification, fee, operator, date) => {
    await pancakeRouter.addLiquidity(
        tokenA.address,
        tokenB.address,
        tokenANumber,
        tokenBNumber,
        amplification,
        fee,
        operator.address,
        date
    );
}

const SetUniswapPairOracle = async (pancakeFactoryAddress, tokenAAddress, tokenBAddress) => {
    const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    throw Error("1111111");
    return await UniswapPairOracle.deploy(
        pancakeFactoryAddress,
        tokenAAddress,
        tokenBAddress,
    );
}

const SetUniswapOracle = async (stableCoinPool, pancakeFactoryAddress, tokenAAddress, tokenBAddress) => {
    let GraphicMap = await GetMap();
    let uniswapOracle;

    switch (tokenAAddress) {
        case GraphicMap.get("USDC").address:
            uniswapOracle = await SetUniswapPairOracle(pancakeFactoryAddress, tokenAAddress, tokenBAddress);
            await SetCollatETHOracle(stableCoinPool, uniswapOracle, tokenBAddress);
            break;
        case GraphicMap.get("RUSD").address:
            uniswapOracle = await SetUniswapPairOracle(pancakeFactoryAddress, tokenAAddress, tokenBAddress);
            await SetStableEthOracle(GraphicMap.get("RUSD"), uniswapOracle, tokenBAddress);
            expect(await GraphicMap.get("RUSD").stableEthOracleAddress()).to.be.eq(uniswapOracle.address);
            break;
        case GraphicMap.get("TRA").address:
            uniswapOracle = await SetUniswapPairOracle(pancakeFactoryAddress, tokenAAddress, tokenBAddress);
            await SetStockEthOracle(GraphicMap.get("RUSD"), uniswapOracle, tokenBAddress);
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