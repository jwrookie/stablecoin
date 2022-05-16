const {ethers} = require('hardhat');

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

module.exports = {
    SetOracle,
    SetOperatable,
    SetCheckPermission,
    SetRusd,
    SetTra
}