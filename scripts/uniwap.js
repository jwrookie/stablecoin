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

//const Timelock = require('../contracts/tools/Timelock.json');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');
const {ethers, waffle} = require("hardhat");


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

async function main() {
    const accounts = await ethers.getSigners()
    const zeroAddr = "0x0000000000000000000000000000000000000000"
    // let usdc = "0x42d903C9503c22a83a92e216F088d8BaDff0c699"
    // let dai = "0xD4EDbFcDB6E5eBFA20e09a1B216ca5c84e4Ad889"
    //
    // let usdt = "0xfecaB3217751C1c92301F827e309ec552100dAC1"
    let timeLock = "0x7E923e174895f2b49118aF90C6692db7C1F6C69C"
    let factory = "0x664aA5c2b9A12228aEc799cC97f584a06690BdA7"
    let tokenA  = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"
    let tokenB = "0xABD262d7E300B250bab890f5329E817B7768Fe3C"


    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)



     const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        uniswapOracle = await UniswapPairOracle.deploy(factory,tokenA,tokenB,deployer.address,timeLock);
          console.log("uniswapOracle:" + uniswapOracle.address)

     await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address)

    // timeLock = await deployContract(deployer, {
    //      bytecode: Timelock.bytecode,
    //      abi: Timelock.abi
    //  }, [deployer.address, 0]);
    //  console.log("timeLock:" + timeLock.address)






}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })