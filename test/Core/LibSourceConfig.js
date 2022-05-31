const {deployContract} = require("ethereum-waffle");
const {ZEROADDRESS} = require("../Lib/Address");
const GAS = {gasLimit: "9550000"};
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

const Weth = async (ownerAddress) => {
    // Need to create swap pairs and deassociate the mock token price with weth
    return await deployContract(ownerAddress, {
        bytecode: WETH.bytecode,
        abi: WETH.abi
    });
}

const PancakeFactory = async (ownerAddress) => {
    // Pancake factory, The purpose is to create a trading pair and go to UnisWAP to get the trading pair price
    return await deployContract(ownerAddress, {
        bytecode: FACTORY.bytecode,
        abi: FACTORY.abi
    }, [ownerAddress.address]);
}

const Router = async (ownerAddress, factory, eth) => {
    // Source: https://github.com/pancakeswap/pancake-smart-contracts/blob/master/projects/exchange-protocol/contracts/PancakeRouter.sol
    return await deployContract(ownerAddress, {
        bytecode: ROUTER.bytecode,
        abi: ROUTER.abi
    }, [factory.address, eth.address]);
}

const Registry = async (ownerAddress) => {
    // Before deploy pool registry need to deploy registry
    return await deployContract(ownerAddress, {
        bytecode: REGISTRY.bytecode,
        abi: REGISTRY.abi
    }, [ownerAddress.address]);
}

const PoolRegistry = async (ownerAddress, registry) => {
    // The pool is unregistered through the registry
    return await deployContract(ownerAddress, {
        bytecode: POOLREGISTRY.bytecode,
        abi: POOLREGISTRY.abi
    }, [registry.address, ZEROADDRESS]);
}

const PoolOfThreeCoinsFactory = async (ownerAddress, registry) => {
    // We provide our own trading pool, which can carry out the exchange of specified coins
    return await deployContract(ownerAddress, {
        bytecode: CRVFACTORY.bytecode,
        abi: FACTORYABI.abi,
    }, [ownerAddress.address, registry.address]);
}

const Plain3Balances = async (ownerAddress) => {
    // Deploy 3 coin pool
    return await deployContract(ownerAddress, {
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
            default:
                tempTokenArray.push(tempToken.address);
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

module.exports = {
    Weth,
    PancakeFactory,
    Router,
    Registry,
    PoolRegistry,
    PoolOfThreeCoinsFactory,
    Plain3Balances,
    SetPlainImplementations,
    SetThreePoolsByThreePoolFactory
}