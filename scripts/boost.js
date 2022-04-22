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
    let fxs = "0xAd510519008772007d3458502EF26D831BEDb155"
    //let frax = "0xB8Bc34A46E19B1f5d006dBf6E360d2c6cBB8FcF1"

    let operatable = "0x3724b782b8fec00cCa312a736C60dee9Be12b0aC"


    //


    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)


    const Locker = await ethers.getContractFactory('Locker');
    lock = await Locker.deploy(fxs, "300");
    console.log("Locker:" + lock.address)

    const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
    gaugeFactory = await GaugeFactory.deploy();
    console.log("gaugeFactory:" + gaugeFactory.address)

    Boost = await ethers.getContractFactory("Boost");
    boost = await Boost.deploy(
        operatable,
        lock.address,
        gaugeFactory.address,
        fxs,
        toWei('1'),
        parseInt("10570982"),
        "1000"
    );
    console.log("boost:" + boost.address)

    await lock.setVoter(boost.address)

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