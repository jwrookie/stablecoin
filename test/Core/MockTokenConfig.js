const {ethers} = require('hardhat');
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

const SetMockToken = async (mintNumber = toWei("1")) => {
    const MockToken = await ethers.getContractFactory("MockToken");
    return await MockToken.deploy("token0", "token0", 18, mintNumber);
}

const MintMockToken = async (mockToken, user, mintNumber = toWei("1")) => {
    await mockToken.mint(user, mintNumber);
}

const SetMockChainLink = async () => {
    const MockChainLink = await ethers.getContractFactory("MockChainLink");
    return await MockChainLink.deploy();
}

const SetChainlinkETHUSDPriceConsumer = async () => {
    let mockChainLink;

    const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
    mockChainLink = await SetMockChainLink();
    return await ChainlinkETHUSDPriceConsumer.deploy(mockChainLink.address);
}

module.exports = {
    SetMockToken,
    SetChainlinkETHUSDPriceConsumer,
    MintMockToken
}