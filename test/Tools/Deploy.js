const {Weth,Factory,Router,Registry,PoolRegistry,CRVFactory,Plain3Balances,SetPoolByCrvFactory, SetPlainImplementations} = require("../Core/LibSourceConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetConfigAboutCRV = async (user) => {
    let resultArray = new Array();
    let weth;
    let factory;
    let router;
    let registry;
    let poolRegistry;
    let crvFactory;
    let plain3Balances;

    if (ZEROADDRESS === user.address || undefined === user.address) {
        throw "Please enter the correct user address!";
    }

    try {
        weth = await Weth(user);
        factory = await Factory(user);
        router = await Router(user, factory, weth);
        // TODO SET ADDRESS
        registry = await Registry(user);
        poolRegistry = await PoolRegistry(user, registry);
        crvFactory = await CRVFactory(user, registry);
        plain3Balances = await Plain3Balances(user);
    }catch (err) {
        throw "Error!";
    }

    // TODO APPROVE ROUTER

    await SetPlainImplementations(crvFactory, 3, [plain3Balances]);

    resultArray.push(weth, factory, router, registry, poolRegistry, crvFactory, plain3Balances);

    return resultArray;
}

const CrvFactoryDeploy = async (crvFactory, tokenArray, amplification, fee, gas) => {
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
