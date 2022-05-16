const {ethers} = require('hardhat');

const SetGauge = async (poolAddress) => {
    const Gauge = await ethers.getContractFactory("Gauge");
    return await Gauge.attach(poolAddress);
}

module.exports = {
    SetGauge
}