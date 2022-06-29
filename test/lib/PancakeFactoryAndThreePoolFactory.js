const CRVFACTORY = require('../mock/mockPool/factory.json');
const FACTORYABI = require('../mock/mockPool/factory_abi.json');
const PLAIN3BALANCE = require('../mock/mockPool/Plain3Balances.json');
const POOLABI = require('../mock/mockPool/3pool_abi.json');
const REGISTRY = require('../mock/mockPool/Registry.json');
const POOLREGISTRY = require('../mock/mockPool/PoolRegistry.json');
const FACTORY = require('../mock/PancakeFactory.json');
const ROUTER = require('../mock/PancakeRouter.json');
const WETH = require('../mock/WETH9.json');
const {deployContract} = require("ethereum-waffle");
const {ZEROADDRESS} = require("./Address");
const GAS = {gasLimit: "9550000"};

const Weth = async (deployer) => {
    // Need to create swap pairs and deassociate the mock token price with weth
    return await deployContract(deployer, {
        bytecode: WETH.bytecode,
        abi: WETH.abi
    });
}

const PancakeFactory = async (deployer) => {
    // Pancake factory, The purpose is to create a trading pair and go to UnisWAP to get the trading pair price
    return await deployContract(deployer, {
        bytecode: FACTORY.bytecode,
        abi: FACTORY.abi
    }, [deployer.address]);
}

const Router = async (deployer, factory, eth) => {
    // Source: https://github.com/pancakeswap/pancake-smart-contracts/blob/master/projects/exchange-protocol/contracts/PancakeRouter.sol
    return await deployContract(deployer, {
        bytecode: ROUTER.bytecode,
        abi: ROUTER.abi
    }, [factory.address, eth.address]);
}

const Registry = async (deployer) => {
    // Before deploy pool registry need to deploy registry
    return await deployContract(deployer, {
        bytecode: REGISTRY.bytecode,
        abi: REGISTRY.abi
    }, [deployer.address]);
}

const PoolRegistry = async (deployer, registry) => {
    // The pool is unregistered through the registry
    return await deployContract(deployer, {
        bytecode: POOLREGISTRY.bytecode,
        abi: POOLREGISTRY.abi
    }, [registry.address, ZEROADDRESS]);
}

const PoolOfThreeCoinsFactory = async (deployer, registry) => {
    // We provide our own trading pool, which can carry out the exchange of specified coins
    return await deployContract(deployer, {
        bytecode: CRVFACTORY.bytecode,
        abi: FACTORYABI.abi,
    }, [deployer.address, registry.address]);
}

const Plain3Balances = async (deployer) => {
    // Deploy 3 coin pool
    return await deployContract(deployer, {
        bytecode: PLAIN3BALANCE.bytecode,
        abi: POOLABI.abi
    });
}

const SetPlainImplementations = async (poolOfThreeCoinsFactory, coinsInPoolNumber, poolArray = []) => {
    let coinsArray = new Array();
    let pool;

    for (let i = 0; i < 10; i++) {
        pool = poolArray[i];
        if (undefined === pool) {
            coinsArray.push(ZEROADDRESS);
        }else {
            coinsArray.push(pool);
        }
    }

    await poolOfThreeCoinsFactory.set_plain_implementations(coinsInPoolNumber, coinsArray);
}

const SetThreePoolsByThreePoolFactory = async (threePoolsFactory, tokenArray = []) => {
    let tempTokenArray = new Array();
    let tempToken;

    for (let i = 0; i < 4; i++) {
        tempToken = tokenArray[i];
        switch (tempToken) {
            case undefined:
                if (i === 3) {
                    tempTokenArray.push(ZEROADDRESS);
                }else {
                    throw Error("Exist Invalid Token!");
                }
                break;
            case ZEROADDRESS:
                throw Error("Exist Zero Address!");
            case "":
                throw Error("Exist Empty Address!");
            default:
                tempTokenArray.push(tempToken);
                break;
        }
    }

    await threePoolsFactory.deploy_plain_pool(
        "3pool",
        "3pool",
        tempTokenArray,
        "2000", // amplification
        "4000000", // fee
        0, // Asset types
        0, // Index
        GAS
    );
}

const PanCakeFactoryAndThreeFactoryConfig = async (user) => {
    let weth;
    let pancakeFactory;
    let pancakeRouter;
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
        pancakeRouter = await Router(user, pancakeFactory, weth);
        registry = await Registry(user);
        poolRegistry = await PoolRegistry(user, registry);
        poolOfThreeCoinsFactory = await PoolOfThreeCoinsFactory(user, registry);
        plain3Balances = await Plain3Balances(user); // pool of three coins
    } catch (err) {
        throw Error("Error message:\t" + err);
    }

    return {
        weth,
        pancakeFactory,
        pancakeRouter,
        registry,
        poolRegistry,
        poolOfThreeCoinsFactory,
        plain3Balances
    };
}

module.exports = {
    SetPlainImplementations,
    SetThreePoolsByThreePoolFactory,
    PanCakeFactoryAndThreeFactoryConfig
}
