const {SetPoolByCrvFactory, SetPlainImplementations} = require("../Core/LibSourceConfig");
const {ConfigCrvFactory, GetCrvMap} = require("../Factory/DeployAboutCrvFactory");
const {CheckParameter} = require("./Check");
const {ZEROADDRESS} = require("../Lib/Address");
const GAS = {gasLimit: "9550000"};
const {toWei} = web3.utils;

const GetCRV = async (user) => {
    let resultArray = new Array();
    let crvFactoryMap = await ConfigCrvFactory(user); // Deploy crv factory precondition
    let weth = crvFactoryMap.get("weth");
    let router = crvFactoryMap.get("router");

    await SetPlainImplementations(crvFactoryMap.get("crvFactory"), 3, [crvFactoryMap.get("plain3Balances")]);

    await weth.deposit({value: toWei("10")});
    await weth.approve(router.address, toWei("10000"));

    resultArray.push(
        crvFactoryMap.get("weth"),
        crvFactoryMap.get("factory"),
        crvFactoryMap.get("registry"),
        crvFactoryMap.get("poolRegistry"),
        crvFactoryMap.get("router")
    );

    return resultArray;
}

const DeployThreePoolByCrvFactory = async (tokenArray, {amplification, fee, gas} = {}) => {
    let recording = await GetCrvMap();

    if (recording.get("crvFactory") === undefined || recording.get("crvFactory") === ZEROADDRESS) {
        throw Error("Please call function GetConfigAboutCRV first!");
    }

    await SetPoolByCrvFactory(
        recording.get("crvFactory"),
        tokenArray,
        amplification,
        fee,
        gas
    );

    // Get 3pool instantiation object
    let poolAddress = await recording.get("crvFactory").pool_list(0, GAS);

    if (!await CheckParameter([recording.get("plain3Balances")])) {
        throw Error("Please check function ConfigCrvFactory!");
    }

    return await recording.get("plain3Balances").attach(poolAddress);
}

module.exports = {
    GetCRV,
    DeployThreePoolByCrvFactory
}
