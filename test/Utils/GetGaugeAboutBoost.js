const {ethers} = require('hardhat');
const {toWei} = require("web3-utils");
const {SetGauge, SetBoost} = require("../Core/DaoConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetBoost = async (
    checkOperator, locker, factory, swapToken, rewardNumber, startBlock, period, token
) => {
    let resultArray = new Array();
    let boost;
    let gauge;

    if (0 >= rewardNumber || 0 >= startBlock || 0 >= period) {
        throw "Invaild Set value!";
    }

    console.log(checkOperator.address);
    console.log(locker.address);
    console.log(factory.address);
    console.log(swapToken.address);

    boost = await SetBoost(checkOperator, locker, factory, swapToken, rewardNumber, startBlock, period);

    await boost.createGauge(token.address, toWei(("1")), false);

    gauge = await GetGauge(boost, token);

    resultArray.push(boost, gauge);

    return resultArray;
}

const GetGauge = async (boost, token) => {
    let gaugeAddress;
    let gauge;

    console.log("boost\t" + boost.address);
    console.log("coin\t" + token.address);
    console.log(await boost.gauges(token.address));
    gaugeAddress = await boost.gauges(token.address);
    console.log(gaugeAddress)

    if (ZEROADDRESS === gaugeAddress) {
        throw "Exist invaild gauge address!"
    }

    gauge = await SetGauge(gaugeAddress);
    await token.approve(gauge.address, toWei("1"));
    return gauge;
}

module.exports = {
    GetBoost,
    GetGauge
}
