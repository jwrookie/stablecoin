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
    let usdc = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"
    // let timeLock = " 0xf6d2Ac942b3C4a43F1936ab90249BB6d18E3b207"
     let fxs = "0xaB029cDE7003a469f48D1D0B3d2be18CD6A8FC47"
    //let frax = "0xB8Bc34A46E19B1f5d006dBf6E360d2c6cBB8FcF1"

   let  operatable = "0xfC1111970050c3Ce49f77C666a0aa9C0126e6991"
let checkOper = "0x3bC28fEA7bE7a8946E9B97d8F2B1f8cE95b93eE8"
let lock = "0x33F05350555a614AF727B444221F9720eC4C11A1"
let gaugeFactory = "0x9c4A47bd3485A4A8443fE022Ef372Dda6a8a26d6"


    // let pool = "0x255B2A455f94957562915784fFf3dd872DFd92F2"
    // let fxb = "0x594AF48EB0f4515d49dE3Bdc7909C886Ce998df4"
    //let fxs = "0x2C4Dc61958e1090B9c64C21d8607BE81f7c5cD4D"
    // // const TestERC20 = await ethers.getContractFactory("TestERC20");
    // // let usdc = await TestERC20.attach(usdcAddr);
    // // let factory = "0x664aA5c2b9A12228aEc799cC97f584a06690BdA7"
    // // let tokenA = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"
    // // let weth = "0xABD262d7E300B250bab890f5329E817B7768Fe3C"
    //


    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)


   // Operatable = await ethers.getContractFactory("Operatable");
    // operatable = await Operatable.deploy();
    //  console.log("operatable:" + operatable.address)
    //
    // CheckOper = await ethers.getContractFactory("CheckOper");
    // checkOper = await CheckOper.deploy(operatable.address);
    // console.log("checkOper:" + checkOper.address)
    //
    // const Locker = await ethers.getContractFactory('Locker');
    // lock = await Locker.deploy(usdc, "7200");
    // console.log("Locker:" + lock.address)
    //
    // const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
    // gaugeFactory = await GaugeFactory.deploy();
    //  console.log("gaugeFactory:" + gaugeFactory.address)

    Boost = await ethers.getContractFactory("Boost");
    boost = await Boost.deploy(
        checkOper,
        lock,
        gaugeFactory,
        fxs,
        toWei('1'),
        parseInt("18375499 "),
        "1000"
    );
     console.log("boost:" + boost.address)

    // await frax.addPool(boost.address);
    // await frax.addPool(owner.address);
    // await lock.setVoter(boost.address);




}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })