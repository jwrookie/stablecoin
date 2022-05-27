const {Weth,Factory,Router,Registry,PoolRegistry,CRVFactory,Plain3Balances,} = require("../Core/LibSourceConfig");

const GraphicCrvTokenMap = new Map();

const GetCrvMap = async () => {
    return GraphicCrvTokenMap;
}

const ConfigCrvFactory = async (user) => {
    let weth;
    let factory;
    let router;
    let registry;
    let poolRegistry;
    let crvFactory;
    let plain3Balances;

    if ("object" !== typeof user || undefined === user.address) {
        throw Error("Please enter the correct user address!");
    }

    try {
        weth = await Weth(user);
        factory = await Factory(user);
        router = await Router(user, factory, weth);
        registry = await Registry(user);
        poolRegistry = await PoolRegistry(user, registry);
        crvFactory = await CRVFactory(user, registry);
        plain3Balances = await Plain3Balances(user);
    }catch (err) {
        throw Error("Error message:\t" + err);
    }

    GraphicCrvTokenMap.set("weth", weth);
    GraphicCrvTokenMap.set("factory", factory);
    GraphicCrvTokenMap.set("router", router);
    GraphicCrvTokenMap.set("registry", registry);
    GraphicCrvTokenMap.set("poolRegistry", poolRegistry);
    GraphicCrvTokenMap.set("crvFactory", crvFactory);
    GraphicCrvTokenMap.set("plain3Balances", plain3Balances);

    return GraphicCrvTokenMap;
}

module.exports = {
    GetCrvMap,
    ConfigCrvFactory
}
