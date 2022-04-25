const {expectRevert, time} = require('@openzeppelin/test-helpers');
// const TestOwnableToken = artifacts.require('TestOwnableToken');
// // const Timelock = artifacts.require('Timelock');
// const FRAXShares = artifacts.require('FRAXShares');
// const FRAXStablecoin = artifacts.require('FRAXStablecoin');
// const Pool_USDC = artifacts.require('Pool_USDC');
// const TestERC20 = artifacts.require('TestERC20');
// const TestOracle = artifacts.require('TestOracle')
// const FraxPoolLibrary = artifacts.require('FraxPoolLibrary');
const {toWei} = web3.utils;
// const Router = require('../test/mock/Timelock.json');
// const {BigNumber} = require('ethers');

// const Timelock = require('../test/mock/Timelock.json');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');
const {ethers, waffle} = require("hardhat");


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

async function main() {
    const accounts = await ethers.getSigners()
    const zeroAddr = "0x0000000000000000000000000000000000000000"
    //let usdc = ""
    // let timeLock = " 0xf6d2Ac942b3C4a43F1936ab90249BB6d18E3b207"
    let fxs = "0x8bd1652946B614ccfe7ADdFE1d55ef8be49D5B29"
    //let frax = "0xB8Bc34A46E19B1f5d006dBf6E360d2c6cBB8FcF1"

    let operatable = "0x06146D292DAa8a517F696e21c814660cc8983c53"
    let lock = "0xfB910F65f1F540c0865a0f07b2329Fb93595D254"
    let gaugeFactory ="0xf922b7F6e0bfb07cD5e9FE1C78349E30771fAd2A"

    //


    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)


    // const Locker = await ethers.getContractFactory('Locker');
    // lock = await Locker.deploy(fxs, "7200");
    // console.log("Locker:" + lock.address)
    //
    // const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
    // gaugeFactory = await GaugeFactory.deploy();
    // console.log("gaugeFactory:" + gaugeFactory.address)

    Boost = await ethers.getContractFactory("Boost");
    boost = await Boost.deploy(
        operatable,
        lock,
        gaugeFactory,
        fxs,
        toWei('1'),
        parseInt("18723674"),
        "1000"
    );
    console.log("boost:" + boost.address)
    // //
    // await lock.setVoter(boost.address)

    // await frax.addPool(boost.address);



}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })