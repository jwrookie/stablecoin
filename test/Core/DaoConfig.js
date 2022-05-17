const {ethers} = require('hardhat');

const SetBoost = async (checkOperator, locker, factory, swapToken, rewardNumber, startBlock, period) => {
    const Boost = await ethers.getContractFactory("Boost");
    return await Boost.deploy(
        checkOperator.address,
        locker.address,
        factory.address,
        swapToken.address,
        rewardNumber,
        parseInt(startBlock),
        period
    );
}

const SetGauge = async (poolAddress) => {
    const Gauge = await ethers.getContractFactory("Gauge");
    return await Gauge.attach(poolAddress);
}

module.exports = {
    SetGauge,
    SetBoost
}