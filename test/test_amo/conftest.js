const {ethers} = require("hardhat");
const {time} = require("@openzeppelin/test-helpers");
const $ = require("../lib/common");
const Plain3Pool = require("../mock/mockPool/Plain3Balances.json");
const Plain3PoolAbi = require("../mock/mockPool/3pool_abi.json");
const Registry = require("../mock/mockPool/Registry.json");
const PoolRegistry = require("../mock/mockPool/PoolRegistry.json");
const Factory = require("../mock/mockPool/factory.json");
const FactoryAbi = require("../mock/mockPool/factory_abi.json");
const {toWei} = require("web3-utils");

const getStablecoinPool = async function (poolLibrary, checkPermission, frax, fxs, usdc) {
    const PoolUSD = await ethers.getContractFactory("PoolUSD", {
        libraries: {
            PoolLibrary: poolLibrary.address,
        }
    });
    return await PoolUSD.deploy(
        checkPermission.address,
        frax.address,
        fxs.address,
        usdc.address,
        toWei("10000000000"));
}

const getPlain3Pool = async function (frax, usdc, usdt) {
    const {owner, zeroAddress} = await $.setup();

    const plain3Pool = await $.deploy(owner, Plain3Pool.bytecode, Plain3PoolAbi.abi);

    const registry = await $.deploy(owner, Registry.bytecode, Registry.abi, [owner.address]);
    const poolRegistry = await $.deploy(owner, PoolRegistry.bytecode, PoolRegistry.abi, [registry.address, zeroAddress])

    await registry.set_address(0, poolRegistry.address);

    const factory = await $.deploy(owner, Factory.bytecode, FactoryAbi.abi, [owner.address, poolRegistry.address]);

    await factory.set_plain_implementations(3, [
        plain3Pool.address,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
        zeroAddress,
    ]);
    await factory.deploy_plain_pool(
        "3pool",
        "3pool",
        [frax.address, usdc.address, usdt.address, zeroAddress],
        "200",
        "4000000",
        0, 0
    );
    const pool3Addr = await factory.pool_list(0, {gasLimit: "9500000"});
    return await plain3Pool.attach(pool3Addr);
}

const getUniswapPairOracle = async function (factory, tokenA, tokenB) {
    const {owner, Timelock, UniswapPairOracle} = await $.setup();

    const _duration = await time.duration.days(5);
    const timelock = await Timelock.deploy(owner.address, parseInt(_duration));

    const oracle = await UniswapPairOracle.deploy(factory.address, tokenA.address, tokenB.address);

    if (!(await oracle.canUpdate())) {
        await time.increase(time.duration.hours(1));
    }
    await oracle.update();

    return oracle;
}

module.exports = {
    getStablecoinPool,
    getUniswapPairOracle,
    getPlain3Pool
}