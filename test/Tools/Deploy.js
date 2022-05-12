const {deployContract} = require("ethereum-waffle");
const {
    CRVFACTORY,
    FACTORY,
    FACTORYABI,
    POOLABI,
    WETH,
    PLAIN3BALANCE,
    POOLREGISTRY,
    REGISTRY,
    ROUTER
} = require("../Lib/QuoteMockJson");
const {ZEROADDRESS} = require("../Core/Address");

const Weth = async (ownerAddress) => {
    return await deployContract(ownerAddress, {
        bytecode: WETH.bytecode,
        abi: WETH.abi,
    });
}

const Factory = async (ownerAddress) => {
    return await deployContract(ownerAddress, {
        bytecode: FACTORY.bytecode,
        abi: FACTORY.abi
    }, [ownerAddress.address]);
}

const Router = async (ownerAddress, factory, eth) => {
    return await deployContract(ownerAddress, {
        bytecode: ROUTER.bytecode,
        abi: ROUTER.abi
    }, [factory.address, eth.address]);
}

const Registry = async (ownerAddress) => {
    return await deployContract(ownerAddress, {
        bytecode: REGISTRY.bytecode,
        abi: REGISTRY.abi
    }, [ownerAddress.address]);
}

const PoolRegistry = async (ownerAddress, registry) => {
    return await deployContract(ownerAddress, {
        bytecode: POOLREGISTRY.bytecode,
        abi: POOLREGISTRY.abi
    }, [registry.address, ZEROADDRESS]);
}

const CRVFactory = async (ownerAddress, registry) => {
    return await deployContract(owner, {
        bytecode: CRVFACTORY.bytecode,
        abi: FACTORYABI.abi,
    }, [ownerAddress.address, registry.address]);
}

const Plain3Balances = async (ownerAddress) => {
    return await deployContract(ownerAddress, {
        bytecode: PLAIN3BALANCE.bytecode,
        abi: POOLABI.abi
    });
}

const GetConfigAboutCRV = async (user) => {
    let resultArray = new Array();

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
