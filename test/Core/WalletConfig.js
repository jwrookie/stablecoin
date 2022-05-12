const {ethers} = require("hardhat");

const Signers = async () => {
    return await ethers.getSigners();
}

module.exports = {
    Signers
}