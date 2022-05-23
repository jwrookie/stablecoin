const {ethers} = require('hardhat');
const {toWei} = require("web3-utils");
const {ZEROADDRESS} = require("../Lib/Address");
const {GetMap} = require("../Factory/StableAndMockFactory");
const {SetGauge, SetBoost} = require("../Core/DaoConfig");

const GetBoost = async (
    locker, factory, swapToken, rewardNumber, startBlock, period, token = []
) => {
    let resultArray = new Array();
    let tempMap = await GetMap();
    let boost;
    let gauge;
    let tempToken;

    if (0 >= rewardNumber || 0 >= startBlock || 0 >= period) {
        throw Error("Invalid Set value!");
    }

    if (undefined === tempMap.get("CHECKOPERA")) {
        throw Error("Please call the function TokenFactory first!");
    }

    boost = await SetBoost(tempMap.get("CHECKOPERA"), locker, factory, swapToken, rewardNumber, startBlock, period);

    if (undefined !== boost) {
        resultArray.push(boost);
    }

    for (let i = 0; i < token.length; i++) {
        tempToken = token[i];
        await boost.createGauge(tempToken.address, toWei(("1")), false);
        gauge = await GetGauge(boost, tempToken);
        resultArray.push(gauge);
    }

    return resultArray;
}

const GetGauge = async (boost, token) => {
    let gaugeAddress;
    let gauge;

    gaugeAddress = await boost.gauges(token.address);

    if (ZEROADDRESS === gaugeAddress) {
        throw Error("Exist invalid gauge address!");
    }

    gauge = await SetGauge(gaugeAddress);
    await token.approve(gauge.address, toWei("1"));
    return gauge;
}

module.exports = {
    GetBoost,
    GetGauge
}
