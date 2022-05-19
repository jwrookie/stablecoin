const {ethers} = require("hardhat");
const {MockTokenFactory} = require("../Factory/StableAndMockFactory");
const {toWei} = web3.utils;

const GetMockToken = async (deployMockTokenNumber = 1, mintUser = [], mintNumber = toWei("1")) => {
    let resultArray;

    resultArray = await MockTokenFactory(deployMockTokenNumber, mintUser, mintNumber);

    return resultArray;
}

module.exports = {
    GetMockToken
}