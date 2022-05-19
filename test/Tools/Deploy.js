const {SetPoolByCrvFactory, SetPlainImplementations} = require("../Core/LibSourceConfig");
const {ConfigCrvFactory, GetCrvMap} = require("../Factory/DeployAboutCrvFactory");
const {toWei} = web3.utils;
const {ZEROADDRESS} = require("../Lib/Address");

const GetConfigAboutCRV = async (user) => {
    let resultArray = new Array();
    let crvFactoryMap = await ConfigCrvFactory(user);
    let weth = crvFactoryMap.get("weth");
    let router = crvFactoryMap.get("router");

    await SetPlainImplementations(crvFactoryMap.get("crvFactory"), 3, [crvFactoryMap.get("plain3Balances")]);

    await weth.deposit({value: toWei("10")});
    await weth.approve(router.address, toWei("10000"));

    resultArray.push(
        crvFactoryMap.get("weth"),
        crvFactoryMap.get("factory"),
        crvFactoryMap.get("router"),
        crvFactoryMap.get("registry"),
        crvFactoryMap.get("poolRegistry"),
        crvFactoryMap.get("crvFactory"),
        crvFactoryMap.get("plain3Balances"));

    return resultArray;
}

const CrvFactoryDeploy = async (crvFactory, tokenArray, {amplification, fee, gas} = {}) => {
    let recording = await GetCrvMap();

    if (recording.get("crvFactory") === undefined || recording.get("crvFactory") === ZEROADDRESS) {
        throw Error("Please call function GetConfigAboutCRV first!");
    }

    if (recording.get("crvFactory") !== crvFactory) {
        throw Error("Please set right crvFactory, which value is the same as that configured");
    }

    await SetPoolByCrvFactory(
        crvFactory,
        tokenArray,
        amplification,
        fee,
        gas
    );
}

module.exports = {
    GetConfigAboutCRV,
    CrvFactoryDeploy
}
