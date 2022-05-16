const {ethers} = require('hardhat');
const {SetOracle, SetOperatable, SetRusd, SetTra, SetCheckPermission} = require("../Core/StableConfig");
const {ZEROADDRESS} = require("../Lib/Address");

const GetRusdAndTra = async () => {
    let resultArray = new Array();

    oracle = await SetOracle();
    operatable = await SetOperatable();
    checkOpera = await SetCheckPermission(operatable);
    rusd = await SetRusd(operatable);
    tra = await SetTra(operatable, oracle);

    resultArray.push(oracle, operatable, checkOpera, rusd, tra);

    return resultArray;
}

const SetRusdAndTraConfig = async (rusd, tra) => {
    if (ZEROADDRESS === rusd.address || ZEROADDRESS === tra.address) {
        return Error("Invaild Token!");
    }
    await tra.setStableAddress(rusd.address);
    await rusd.setStockAddress(tra.address);
}

const StableCoinPool = async (operater, rusd, tra, usdc, poolCelling) => {
    let stableCoinPool;

    if (0 >= poolCelling) {
        return Error("Invaild pool celling!");
    }
    const FraxPoolLibrary = await ethers.getContractFactory("PoolLibrary");
    fraxPoolLibrary = await FraxPoolLibrary.deploy();
    const PoolUsdc = await ethers.getContractFactory("Pool_USDC", {
        libraries: {
            PoolLibrary: fraxPoolLibrary.address,
        },
    });
    stableCoinPool = await PoolUsdc.deploy(
        operater.address,
        rusd.address,
        tra.address,
        usdc.address,
        poolCelling
    );
    return stableCoinPool;
}

module.exports = {
    StableCoinPool,
    GetRusdAndTra,
    SetRusdAndTraConfig
}