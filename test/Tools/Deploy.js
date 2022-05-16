const {Weth,Factory,Router,Registry,PoolRegistry,CRVFactory,Plain3Balances} = require("../Core/LibSourceConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetConfigAboutCRV = async (user) => {
    let resultArray = new Array();

    if (ZEROADDRESS === user.address || undefined === user.address) {
        return Error("Please enter the correct user address!");
    }

    weth = await Weth(user);
    factory = await Factory(user);
    router = await Router(user, factory, weth);
    registry = await Registry(user);
    poolRegistry = await PoolRegistry(user, registry);
    crvFactory = await CRVFactory(user, registry);
    plain3Balances = await Plain3Balances(user);

    resultArray.push(weth, factory, router, registry, poolRegistry, crvFactory, plain3Balances);

    return resultArray;
}

module.exports = {
    GetConfigAboutCRV
}
