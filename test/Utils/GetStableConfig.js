const {BigNumber} = require("ethers");
const {TokenFactory, GetMap} = require("../Factory/StableAndMockFactory");
const {SetFraxPoolLib, SetPoolAddress, SetPoolLib} = require("../Core/StableConfig");
const {CheckParameter} = require("../Tools/Check");
const {ZEROADDRESS} = require("../Lib/Address");

const GetRusdAndTra = async () => {
    let resultArray;

    resultArray = await TokenFactory();

    let tempMap = await GetMap();

    if (await CheckParameter([tempMap.get("RUSD"), tempMap.get("TRA")])) {
        await SetRusdAndTraConfig(tempMap.get("RUSD"), tempMap.get("TRA"));
    } else {
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

const StableCoinPool = async (usdc, poolCelling) => {
    let tempMap = await GetMap();
    let poolCell;

    if ("string" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling);
    } else if ("number" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling.toString())
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
        poolCell
    );
}

const StableCoinPoolFreeParameter = async (checkoperaAddress, rusdAddress, traAddress, guaranteeAddress, poolCelling) => {
    let tempArray = new Array();
    let poolCell;

    if ("string" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling);
    } else if ("number" === typeof poolCelling) {
        poolCell = BigNumber.from(poolCelling.toString())
    }

    tempArray.push(checkoperaAddress, rusdAddress, traAddress, guaranteeAddress);

    for (let index in tempArray) {
        if ("string" !== typeof tempArray[index]
            || "" === tempArray[index]
            || ZEROADDRESS === tempArray[index]
            || undefined === tempArray[index]) {
            throw Error("StableCoinPoolFreeParameter: Check parameters!");
        }
    }

    let fraxPool = await SetFraxPoolLib();

    let PoolUsdc = await SetPoolLib(fraxPool.address);

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