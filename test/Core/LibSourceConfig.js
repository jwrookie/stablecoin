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

const Factory = async (ownerAddress) => {
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

const CRVFactory = async (ownerAddress, registry) => {
    // We provide our own trading pool, which can carry out the exchange of specified coins
    return await deployContract(owner, {
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

const SetPlainImplementations = async (crvFactory, coinInPoolNumber, poolArray = []) => {
    let factoryArray = new Array();
    let pool;

    if (0 === poolArray.length) {
        throw Error("Error, Must add a 3pool!");
    }

    for (let i = 0; i < 10; i++) {
        pool = poolArray[i];
        if (undefined === pool) {
            factoryArray.push(ZEROADDRESS);
        }else {
            factoryArray.push(pool.address);
        }
    }

    await crvFactory.set_plain_implementations(coinInPoolNumber, factoryArray);
}

const SetPoolByCrvFactory = async (crvFactory, tokenArray = [], amplification = 0, fee = 0, gas = GAS) => {
    let tempTokenArray = new Array();
    let tempToken;

    if (0 > fee || 0 > gas) {
        throw Error("More fee or gas!");
    }

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

    await crvFactory.deploy_plain_pool(
        "3pool",
        "3pool",
        tempTokenArray,
        "2000",
        "4000000",
        amplification,
        fee,
        gas
    );
}

module.exports = {
    Weth,
    Factory,
    Router,
    Registry,
    PoolRegistry,
    CRVFactory,
    Plain3Balances,
    SetPlainImplementations,
    SetPoolByCrvFactory
}