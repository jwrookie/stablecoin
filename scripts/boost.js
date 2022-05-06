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
    let fxs = "0x34BAf8b683FD126C43425d78d87D05C57e4a2249"
    let frax = "0xa0fec666998754149132F2B49DAeEE484B522df7"
    //
    // let operatable = "0xb9F6ED924F0b46fA9912eBc62BcBeB64FbFcC005"
    let checkPermission ="0x38f25721242a18c138f0675574052f2F80Ba2391"
    let lock = "0x92fD7F6824BE5D68F287AE9FEAb346258321c678"
    // let gaugeFactory ="0x1BC954908BE0aBF8F1f4b8562CD467541179Ca3c"
    let boost = "0xde907957FCB48118E042039dEb4C1EA42D4c0D73"

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


    // const Operatable = await ethers.getContractFactory("Operatable");
    // operatable = await Operatable.deploy();
    //  console.log("operatable:" + operatable.address);
    //
    //
    // const CheckPermission = await ethers.getContractFactory("CheckPermission");
    // checkPermission = await CheckPermission.deploy(operatable.address);
    //  console.log("checkPermission:" + checkPermission.address);
    //
    // const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
    // frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");
    // console.log("frax:" + frax.address);
    //
    //  const FRAXShares = await ethers.getContractFactory('Stock');
    // fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);
    // console.log("fxs:" + fxs.address);
    //
    //
    // await fxs.setFraxAddress(frax.address);
    // await frax.setStockAddress(fxs.address);


    // const Locker = await ethers.getContractFactory('Locker');
    // lock = await Locker.deploy(checkPermission, fxs, "1800");
    // console.log("Locker:" + lock.address)
    //
    // const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
    // gaugeFactory = await GaugeFactory.deploy(checkPermission);
    // console.log("gaugeFactory:" + gaugeFactory.address)

    //  Boost = await ethers.getContractFactory("Boost");
    //  boost = await Boost.deploy(
    //      checkPermission,
    //      lock,
    //      gaugeFactory,
    //      fxs,
    //      toWei('1'),
    //      parseInt("19063655"),
    //      "2592000"
    //  );
    // console.log("boost:" + boost.address)


      // const GaugeController = await ethers.getContractFactory('GaugeController');
      //   gaugeController = await GaugeController.deploy(
      //       checkPermission,
      //       boost,
      //       lock,
      //       "1200");
      //
      //   console.log("gaugeController:" + gaugeController.address)

     const SwapController = await ethers.getContractFactory('SwapController');
        swapController = await SwapController.deploy(
            checkPermission,
            boost,
            lock,
            "1200");

        console.log("swapController:" + swapController.address)

        // await boost.addController(gaugeController.address);
        // // await lock.removeBoosts(boost.address)
        // await lock.addBoosts(gaugeController.address);

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