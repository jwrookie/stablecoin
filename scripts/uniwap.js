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
    let timeLock = "0x9205322Df5d5E763C3B98919c18c763A4caB7E14"
    let factory = "0x664aA5c2b9A12228aEc799cC97f584a06690BdA7"
    //let tokenA = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"//usdc
   // let tokenA = "0x17b16eAF39C055405a6Ccc41258698F048b4bA38"//usdt
   //   let tokenA = "0x6E99889DE9585d77ae8889CB07CccE2d8Ff7A5DF"//frax
    let tokenA = "0xEF70CAbcFd003F9fD56cfF75e6b6c300069Bc5Af"//fxs
    let tokenB = "0xABD262d7E300B250bab890f5329E817B7768Fe3C"
    let fraxAddr = "0x19cdB8EFB4Df6AAB7A6c0EABeD8Fe6cfE5351159"


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


    // timeLock = await deployContract(deployer, {
    //      bytecode: Timelock.bytecode,
    //      abi: Timelock.abi
    //  }, [deployer.address, 0]);
    //  console.log("timeLock:" + timeLock.address)

    //
    // let frax = await FRAXStablecoin.at(fraxAddr)
    //
    // const FraxBond = await ethers.getContractFactory("FraxBond");
    // fxb = await FraxBond.deploy("fxb", "fxb");
    // console.log("fxb:" + fxb.address)
    //
    // const FraxBondIssuer = await ethers.getContractFactory('FraxBondIssuer');
    // fraxBondIssuer = await FraxBondIssuer.deploy(frax.address, fxb.address);
    // console.log("fraxBondIssuer:" + fraxBondIssuer.address)
    //
    // await fxb.addIssuer(deployer.address);
    // await fxb.addIssuer(fraxBondIssuer.address);
    // //await fxb.issuer_mint(fraxBondIssuer.address, toWei('100000'))
    // await fxb.issuer_mint(deployer.address, toWei('1000000'))
    //
    // await frax.approve(fraxBondIssuer.address, toWei('1000'))
    // await fxb.approve(fraxBondIssuer.address, toWei('1000'))
    // await frax.addPool(fraxBondIssuer.address)


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })