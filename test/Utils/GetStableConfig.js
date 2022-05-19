const {ethers} = require('hardhat');
const {TokenFactory} = require("../Factory/StableAndMockFactory");
const {ZEROADDRESS} = require("../Lib/Address");

const GetRusdAndTra = async () => {
    let resultArray;

    resultArray = await TokenFactory();

    return resultArray;
}

const SetRusdAndTraConfig = async (rusd, tra) => {
    if (ZEROADDRESS === rusd.address || ZEROADDRESS === tra.address) {
        throw Error("Invalid token!");
    }
    await tra.setStableAddress(rusd.address);
    await rusd.setStockAddress(tra.address);
}

const SetFraxPoolLib = async () => {
    const FraxPoolLibrary = await ethers.getContractFactory("PoolLibrary");
    return await FraxPoolLibrary.deploy();
}

const SetPoolAddress = async (poolLib) => {
    if (undefined === poolLib || null === poolLib || ZEROADDRESS === poolLib.address) {
        throw Error("Input right address!");
    }

    return await ethers.getContractFactory("PoolUSD", {
        libraries: {
            PoolLibrary: poolLib.address,
        },
    });
}

const StableCoinPool = async (checkPermission, rusd, tra, usdc, poolCelling) => {
    if (0 >= poolCelling) {
        throw Error("Invalid pool celling!");
    }

    let fraxPoolLibrary = await SetFraxPoolLib();

    let PoolUsdc = await SetPoolAddress(fraxPoolLibrary);

    return await PoolUsdc.deploy(
        checkPermission.address,
        rusd.address,
        tra.address,
        usdc.address,
        poolCelling
    );
}

module.exports = {
    StableCoinPool,
    GetRusdAndTra,
    SetRusdAndTraConfig
}