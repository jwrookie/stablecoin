const {ethers} = require('hardhat');

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
    return await UniswapPairOracle.deploy(
        pancakeFactoryAddress,
        tokenAAddress,
        tokenBAddress,
    );
}

module.exports = {
    SetUniswapPairOracle,
    SetAddLiquidity
}