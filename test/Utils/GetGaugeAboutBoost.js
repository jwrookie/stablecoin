const {ethers} = require('hardhat');
const {SetGauge} = require("../Core/DaoConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetGauge = async (boost, coinPool) => {
    let gaugeAddress;
    let gauge;

    gaugeAddress = await boost.gauges(coinPool.address);
    gauge = await SetGauge(gaugeAddress);
    return gauge;
}

module.exports = {
    GetGauge
}
