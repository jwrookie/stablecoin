const {BigNumber} = require("ethers");
const {CheckParameter} = require("./Check");
const {TokenFactory, GetMap, SetFraxPoolLib, SetPoolAddress} = require("../lib/StableAndMockFactory");
const {ZEROADDRESS} = require("../lib/Address");

const GetRusdAndTra = async () => {
    let tempArray = new Array();

    const {
        rusd,
        tra,
        operatable,
        checkOpera,
        oracle
    } = await TokenFactory();

    await SetRusdAndTraConfig(rusd, tra);

    tempArray.push(rusd,
        tra,
        operatable,
        checkOpera,
        oracle);

    return tempArray;
}

const SetRusdAndTraConfig = async (rusd, tra) => {
    if (ZEROADDRESS === rusd.address || ZEROADDRESS === tra.address) {
        throw Error("Invalid token!");
    }
    await tra.setStableAddress(rusd.address);
    await rusd.setStockAddress(tra.address);
}

const StableCoinPool = async (guaranteeAddress, poolCelling) => {
    let tempMap = await GetMap();
    let poolCell;

    if ("string" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling);
    } else if ("number" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling.toString())
    }

    let fraxPoolLibrary = await SetFraxPoolLib();

    let PoolUsdc = await SetPoolAddress(fraxPoolLibrary);

    await CheckParameter([tempMap.get("CHECKOPERA"), tempMap.get("RUSD"), tempMap.get("TRA"), guaranteeAddress]);

    return await PoolUsdc.deploy(
        tempMap.get("CHECKOPERA").address,
        tempMap.get("RUSD").address,
        tempMap.get("TRA").address,
        guaranteeAddress,
        poolCell
    );
}

const StableCoinPoolFreeParameter = async (checkoperaAddress, rusdAddress, traAddress, guaranteeAddress, poolCelling) => {
    let poolCell;

    if ("string" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling);
    } else if ("number" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling.toString())
    }

    await CheckParameter([checkoperaAddress, rusdAddress, traAddress, guaranteeAddress]);

    let fraxPoolLibrary = await SetFraxPoolLib();

    let PoolUsdc = await SetPoolAddress(fraxPoolLibrary);

    return await PoolUsdc.deploy(
        checkoperaAddress,
        rusdAddress,
        traAddress,
        guaranteeAddress,
        poolCell
    );
}

module.exports = {
    StableCoinPool,
    GetRusdAndTra,
    SetRusdAndTraConfig,
    StableCoinPoolFreeParameter
}