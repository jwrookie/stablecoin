// Introducing external dependencies
const {expectRevert, time} = require('@openzeppelin/test-helpers');
const { ethers } = require('hardhat');

async function getDependencies(package:string = "MockToken"): Promise<void> {
    const MockToken = await ethers.getContractFactory(package)
}