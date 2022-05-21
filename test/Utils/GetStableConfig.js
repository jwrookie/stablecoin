const {ethers} = require('hardhat');
const {TokenFactory, GetMap} = require("../Factory/StableAndMockFactory");
const {ZEROADDRESS} = require("../Lib/Address");

const GetRusdAndTra = async () => {
    let resultArray;

    resultArray = await TokenFactory();

    let tempMap = await GetMap();

    if (undefined !== tempMap.get("RUSD") || undefined !== tempMap.get("TRA")) {
        await SetRusdAndTraConfig(tempMap.get("RUSD"), tempMap.get("TRA"));
    }else {
        throw Error("Please check token factory and check rusd and tra contract!");
    }

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

const StableCoinPool = async (usdc, poolCelling) => {
    let tempMap = await GetMap();

    if (0 >= poolCelling || undefined === usdc) {
        throw Error("Invalid pool celling or contract!");
    }

    let fraxPoolLibrary = await SetFraxPoolLib();

    let PoolUsdc = await SetPoolAddress(fraxPoolLibrary);

    switch (undefined) {
        case tempMap.get("CHECKOPERA"):
            throw Error("Please call the function GetRusdAndTra first!");
            break;
        case tempMap.get("RUSD"):
            throw Error("Please call the function GetRusdAndTra first!");
            break;
        case tempMap.get("TRA"):
            throw Error("Please call the function GetRusdAndTra first!");
            break;
        default:
            break;
    }

    return await PoolUsdc.deploy(
        tempMap.get("CHECKOPERA").address,
        tempMap.get("RUSD").address,
        tempMap.get("TRA").address,
        usdc.address,
        poolCelling
    );
}

module.exports = {
    StableCoinPool,
    GetRusdAndTra,
    SetRusdAndTraConfig
}