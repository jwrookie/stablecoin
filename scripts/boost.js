const {expectRevert, time} = require('@openzeppelin/test-helpers');
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
   let fxs = "0x6d2138C3Aa8e20437a541AE287dD047Aed4731De"
    let frax = "0x5AF694EC26FFD0141ff385e4793fbFF89e915B57"

   let operatable = "0xb9F6ED924F0b46fA9912eBc62BcBeB64FbFcC005"
   // let lock = "0x259d2BFda49012C37BE371D0b267DfF1d47997b8"
   //  let gaugeFactory ="0x51586D1ea03d5e85591274F0eC14e596F39941a4"



    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)


    // const TestOracle = await ethers.getContractFactory("TestOracle");
    // oracle = await TestOracle.deploy();
    // console.log("oracle:" + oracle.address);
    //
    //  const Operatable = await ethers.getContractFactory('Operatable');
    //  operatable = await Operatable.deploy();
    //  console.log("operatable:" + operatable.address)
    //
    // const FRAXShares = await ethers.getContractFactory('Stock');
    // fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);
    // console.log("fxs:" + fxs.address);
    //
    // const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
    // frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");
    // console.log("frax:" + frax.address);
    //
    // await fxs.setFraxAddress(frax.address);
    // await frax.setStockAddress(fxs.address);
    //
    const Locker = await ethers.getContractFactory('Locker');
    lock = await Locker.deploy(operatable,fxs, "1800");
    console.log("Locker:" + lock.address)

    const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
    gaugeFactory = await GaugeFactory.deploy();
    console.log("gaugeFactory:" + gaugeFactory.address)

   //  Boost = await ethers.getContractFactory("Boost");
   //  boost = await Boost.deploy(
   //      operatable,
   //      lock,
   //      gaugeFactory,
   //      fxs,
   //      toWei('1'),
   //      parseInt("18871451"),
   //      "2592000"
   //  );
   // console.log("boost:" + boost.address)

    // await lock.addBoosts(boost.address)
    // await fxs.addPool(boost.address);




}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })