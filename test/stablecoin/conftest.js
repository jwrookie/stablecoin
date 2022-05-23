const {ethers} = require("hardhat");
const {time} = require("@openzeppelin/test-helpers");
const $ = require("./common");

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
        1000);
}

const getUniswapPairOracle = async function (factory, tokenA, tokenB) {
    const {owner, Timelock, UniswapPairOracle} = await $.setup();

    const _duration = await time.duration.days(5);
    const timelock = await Timelock.deploy(owner.address, parseInt(_duration));

    const oracle = await UniswapPairOracle.deploy(factory.address, tokenA.address, tokenB.address, timelock.address);

    if (!(await oracle.canUpdate())) {
        await time.increase(time.duration.hours(1));
    }
    await oracle.update();

    return oracle;
}

module.exports = {
    getStablecoinPool,
    getUniswapPairOracle
}