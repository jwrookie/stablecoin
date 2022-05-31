const {
    Weth,
    PancakeFactory,
    Router,
    Registry,
    PoolRegistry,
    PoolOfThreeCoinsFactory,
    Plain3Balances,
} = require("../Core/LibSourceConfig");

const GraphicPancakeAndThreePoolTokenMap = new Map();

const GetPancakeAndThreePoolMap = async () => {
    return GraphicPancakeAndThreePoolTokenMap;
}

const PanCakeFactoryAndThreeFactoryConfig = async (user) => {
    let weth;
    let pancakeFactory;
    let router;
    let registry;
    let poolRegistry;
    let poolOfThreeCoinsFactory;
    let plain3Balances;

    if ("object" !== typeof user || "{}" === JSON.stringify(user)) {
        throw Error("Please enter the correct user object!");
    }

    try {
        weth = await Weth(user);
        pancakeFactory = await PancakeFactory(user);
        router = await Router(user, pancakeFactory, weth);
        registry = await Registry(user);
        poolRegistry = await PoolRegistry(user, registry);
        poolOfThreeCoinsFactory = await PoolOfThreeCoinsFactory(user, registry);
        plain3Balances = await Plain3Balances(user); // pool of three coins
    } catch (err) {
        throw Error("Error message:\t" + err);
    }

    GraphicPancakeAndThreePoolTokenMap.set("weth", weth);
    GraphicPancakeAndThreePoolTokenMap.set("pancakeFactory", pancakeFactory);
    GraphicPancakeAndThreePoolTokenMap.set("router", router);
    GraphicPancakeAndThreePoolTokenMap.set("registry", registry);
    GraphicPancakeAndThreePoolTokenMap.set("poolRegistry", poolRegistry);
    GraphicPancakeAndThreePoolTokenMap.set("poolOfThreeCoinsFactory", poolOfThreeCoinsFactory);
    GraphicPancakeAndThreePoolTokenMap.set("plain3Balances", plain3Balances);

    return GraphicPancakeAndThreePoolTokenMap;
}

module.exports = {
    GetPancakeAndThreePoolMap,
    PanCakeFactoryAndThreeFactoryConfig
}
