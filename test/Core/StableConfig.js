const {ethers} = require('hardhat');
const {ZEROADDRESS} = require("../Lib/Address");

const SetOracle = async () => {
    const TestOracle = await ethers.getContractFactory("TestOracle");
    return await TestOracle.deploy();
}

const SetOperatable = async () => {
    const TestOperatable = await ethers.getContractFactory("Operatable");
    return await TestOperatable.deploy();
}

const SetCheckPermission = async (operatable) => {
    const CheckOperator = await ethers.getContractFactory("CheckPermission");
    return await CheckOperator.deploy(operatable.address);
}

const SetRusd = async (operatable) => {
    RStableCoin = await ethers.getContractFactory("RStablecoin");
    return await RStableCoin.deploy(operatable.address, "Rusd", "Rusd");
}

const SetTra = async (operatable, oracle) => {
    const Stock = await ethers.getContractFactory("Stock");
    return await Stock.deploy(operatable.address, "Tra", "Tra", oracle.address);
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


// Question Invalid Address
const SetPoolLib = async (poolLib) => {
    let poolLibAddress = JSON.stringify(poolLib);

    if (ZEROADDRESS === poolLibAddress || "" === poolLibAddress) {
        throw Error("SetPoolLib: Check address!");
    }

    return await ethers.getContractFactory("PoolUSD", {
        libraries: {
            PoolLibrary: poolLibAddress,
        },
    });
}

module.exports = {
    SetOracle,
    SetOperatable,
    SetCheckPermission,
    SetRusd,
    SetTra,
    SetFraxPoolLib,
    SetPoolAddress,
    SetPoolLib
}