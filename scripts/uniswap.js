const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {toWei} = web3.utils;

// const {BigNumber} = require('ethers');

const Timelock = require('../test/Timelock.json');
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
    // let dai = "0xD4EDbFcDB6E5eBFA20e09a1B216ca5c84e4Ad889"
    //
    // let usdt = "0xfecaB3217751C1c92301F827e309ec552100dAC1"
    // let timeLock = "0x9205322Df5d5E763C3B98919c18c763A4caB7E14"
    // let factory = "0xc8476C842DFdfA3c24fb75FE8A945D1595D9Ed98"
    // let usdc = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"//usdc
    // // let tokenA = "0x17b16eAF39C055405a6Ccc41258698F048b4bA38"//usdt
    // let frax = ""
    // let fxs = ""
    let wbnb = "0xABD262d7E300B250bab890f5329E817B7768Fe3C"

     let factory = "0x664aA5c2b9A12228aEc799cC97f584a06690BdA7"
    //let pool = "0xb769c48368E5A5550f21d08F1da338bF413a777F"
    let frax = '0x5AF694EC26FFD0141ff385e4793fbFF89e915B57'
    let fxs = '0x6d2138C3Aa8e20437a541AE287dD047Aed4731De'




    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)




      // const Timelock = await ethers.getContractFactory('Timelock');
      //   timelock = await Timelock.deploy(deployer.address,0);
      //     console.log("timeLock:" + timeLock.address)
     timeLock = await deployContract(deployer, {
         bytecode: Timelock.bytecode,
         abi: Timelock.abi
     }, [deployer.address, 0]);
     console.log("timeLock:" + timeLock.address)



    const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    usdc_uniswapOracle = await UniswapPairOracle.deploy(factory, usdc, wbnb, deployer.address, timeLock.address);
    console.log("usdc_uniswapOracle:" + usdc_uniswapOracle.address)

    frax_uniswapOracle = await UniswapPairOracle.deploy(factory, frax, wbnb, deployer.address, timeLock.address);
    console.log("frax_uniswapOracle:" + frax_uniswapOracle.address)

    fxs_uniswapOracle = await UniswapPairOracle.deploy(factory, fxs, wbnb, deployer.address, timeLock.address);
    console.log("fxs_uniswapOracle:" + fxs_uniswapOracle.address)





}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })