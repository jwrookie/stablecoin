const {Weth,Factory,Router,Registry,PoolRegistry,CRVFactory,Plain3Balances} = require("../Core/LibSourceConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetConfigAboutCRV = async (user) => {
    let resultArray = new Array();

    if (ZEROADDRESS === user.address || undefined === user.address) {
        throw "Please enter the correct user address!";
    }

    let weth = await Weth(user);
    let factory = await Factory(user);
    let router = await Router(user, factory, weth);
    let registry = await Registry(user);
    let poolRegistry = await PoolRegistry(user, registry);
    let crvFactory = await CRVFactory(user, registry);
    let plain3Balances = await Plain3Balances(user);

    resultArray.push(weth, factory, router, registry, poolRegistry, crvFactory, plain3Balances);

    return resultArray;
}

module.exports = {
    GetConfigAboutCRV
}
