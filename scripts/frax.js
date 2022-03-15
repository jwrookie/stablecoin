const {expectRevert, time} = require('@openzeppelin/test-helpers');
const TestOwnableToken = artifacts.require('TestOwnableToken');
// const Timelock = artifacts.require('Timelock');
const FRAXShares = artifacts.require('FRAXShares');
const FRAXStablecoin = artifacts.require('FRAXStablecoin');
const Pool_USDC = artifacts.require('Pool_USDC');
const TestERC20 = artifacts.require('TestERC20');
const TestOracle = artifacts.require('TestOracle')
const FraxPoolLibrary = artifacts.require('FraxPoolLibrary');
const {toWei} = web3.utils;

// const {BigNumber} = require('ethers');

const Timelock = require('../contracts/tools/Timelock.json');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');
const {ethers, waffle} = require("hardhat");



function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

async function main() {
    const accounts = await ethers.getSigners()
    const zeroAddr = "0x0000000000000000000000000000000000000000"
    let usdc = "0x42d903C9503c22a83a92e216F088d8BaDff0c699"
    let timeLock = "0x4e5726cB91A518B55c02E67822925e947bE56F46"
    let oracle = "0x3aB76d4344fE2106837155D96b54EAD0bb8140Cf"
    let fxs = "0x5f21E792Ed72CA189e3eF00a851Ee453E546D46c"
    let frax = "0x7142ca13A98B68f8b58Fe931a551dfACE4aFeA62"

    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString()/10**18)


    // const TestERC20 = await ethers.getContractFactory("TestERC20");
    // usdc = await TestERC20.deploy();
    // console.log("usdc:" + usdc.address);

   // timeLock = await deployContract(deployer, {
   //      bytecode: Timelock.bytecode,
   //      abi: Timelock.abi
   //  }, [deployer.address, 0]);
   //  console.log("timeLock:" + timeLock.address)


    // const TimeLock = await ethers.getContractFactory("TimeLock");
    // timeLock = await TimeLock.deploy(deployer.address, 0);
    // console.log("timeLock:" + timeLock.address);

    //    const TestOracle = await ethers.getContractFactory("TestOracle");
    // oracle = await TestOracle.deploy();
    // console.log("oracle:" + oracle.address);

    // const FRAXShares = await ethers.getContractFactory("FRAXShares");
    // fxs = await FRAXShares.deploy("Test","Test",oracle);
    // console.log("fxs:" + fxs.address);
    //
    // const FRAXStablecoin = await ethers.getContractFactory("FRAXStablecoin");
    // frax = await FRAXStablecoin.deploy( "usdc", "usdc");
    // console.log("frax:" + frax.address);


    const FraxPoolLibrary = await ethers.getContractFactory("FraxPoolLibrary");
    fraxPoolLibrary = await FraxPoolLibrary.deploy();
    console.log("fraxPoolLibrary:" + fraxPoolLibrary.address);


    const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });
    pool = await Pool_USDC.deploy(frax,fxs,usdc,100);
    console.log("pool:" + pool.address);



}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })