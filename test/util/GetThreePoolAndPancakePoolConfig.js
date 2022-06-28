const {PanCakeFactoryAndThreeFactoryConfig, SetThreePoolsByThreePoolFactory, SetPlainImplementations} = require("../lib/PancakeFactoryAndThreePoolFactory");
const GAS = {gasLimit: "9550000"};
const {toWei} = web3.utils;

const DeployThreePoolFactoryAndPancakeFactory = async (user, wethDeposit = {value: toWei("100")}) => {
    let resultArray = new Array();
    const {
        weth,
        pancakeFactory,
        poolOfThreeCoinsFactory,
        plain3Balances,
        pancakeRouter
    } = await PanCakeFactoryAndThreeFactoryConfig(user); // Deploy pancake factory precondition

    await SetPlainImplementations(
        poolOfThreeCoinsFactory,
        3,
        [plain3Balances.address]
    );

    if ("object" === typeof wethDeposit && "{}" !== JSON.stringify(wethDeposit)) {
        await weth.deposit(wethDeposit);
    } else {
        throw Error("Please check weth deposit number!");
    }

    resultArray.push(
        weth,
        pancakeFactory,
        poolOfThreeCoinsFactory,
        plain3Balances,
        pancakeRouter
    );

    return resultArray;
}

const DeployThreePoolByThreePoolFactory = async (poolOfThreeCoinsFactory, poolOfThreeCoins, coinInThreePool = []) => {
    if ("object" !== typeof poolOfThreeCoins || "{}" === JSON.stringify(poolOfThreeCoins)) {
        throw Error("DeployThreePoolByThreePoolsFactory: Check ThreePool Object!");
    }

    if ("object" !== typeof poolOfThreeCoinsFactory || "{}" === JSON.stringify(poolOfThreeCoinsFactory)) {
        throw Error("DeployThreePoolByThreePoolsFactory: Check poolOfThreeCoinsFactory Object!");
    }

    await SetPlainImplementations(poolOfThreeCoinsFactory, 3, [poolOfThreeCoins.address]);

    for (let coin in coinInThreePool) {
        if ("string" !== typeof coinInThreePool[coin]) {
            throw Error("DeployThreePoolByThreePoolFactory: Invalid token address!");
        }
    }

    await SetThreePoolsByThreePoolFactory(
        poolOfThreeCoinsFactory,
        coinInThreePool,
    );

    // Get 3pool instantiation object
    let poolAddress = await poolOfThreeCoinsFactory.pool_list(0, GAS);

    return await poolOfThreeCoins.attach(poolAddress);
}

module.exports = {
    DeployThreePoolFactoryAndPancakeFactory,
    DeployThreePoolByThreePoolFactory
}
