const {ethers} = require("hardhat");
const {deployContract} = require("ethereum-waffle");

const setup = async () => {
    const [owner, dev, addr1] = await ethers.getSigners();

    const zeroAddress = "0x0000000000000000000000000000000000000000";

    const contracts = {
        CheckPermission: await ethers.getContractFactory('CheckPermission'),
        Operatable: await ethers.getContractFactory('Operatable'),
        Timelock: await ethers.getContractFactory('Timelock'),
        Stock: await ethers.getContractFactory('Stock'),
        RStablecoin: await ethers.getContractFactory('RStablecoin'),
        PoolLibrary: await ethers.getContractFactory("PoolLibrary"),
        ChainlinkETHUSDPriceConsumer: await ethers.getContractFactory('ChainlinkETHUSDPriceConsumer'),
        ChainlinkFXSUSDPriceConsumer: await ethers.getContractFactory('ChainlinkFXSUSDPriceConsumer'),
        UniswapPairOracle: await ethers.getContractFactory('UniswapPairOracle'),
        UniswapPairOracleStable: await ethers.getContractFactory('UniswapPairOracleStable'),
        TestOracle: await ethers.getContractFactory('TestOracle'),
        MockToken: await ethers.getContractFactory('MockToken'),
        MockChainLink: await ethers.getContractFactory('MockChainLink'),
    }

    return {
        ...contracts,
        owner, dev, addr1,
        zeroAddress,
    }
}

const deploy = async (owner, bytecode, abi, args = []) => {
    return await deployContract(owner, {
        bytecode: bytecode,
        abi: abi
    }, args);
}

const mockToken = async (name, symbol, decimals, total) => {
    const MockToken = await ethers.getContractFactory("MockToken");
    return await MockToken.deploy(name, symbol, decimals, total);
}

const mockTokenBatch = async (decimals, total, ...names) => {
    let arr = [];
    for (let item of names) {
        arr.push(await mockToken(item, item, decimals, total));
    }
    return arr;
}

const ethBalance = async (address) => {
    return web3.eth.getBalance(address);
}

const log = (tag, data) => {
    console.log("" + tag + ": " + data);
}

module.exports = {
    setup,
    deploy,
    mockToken,
    mockTokenBatch,
    ethBalance,
    log
}
