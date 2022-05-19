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
    // let TRA = "0x707E9Dc22a38d7E14318Fea24EFe6848dd5D7bE9"
    // let rusd = "0x4003b8891Dc10558342Fc3feC9c1d02C5B0C8e5D"
    // // //
    // // // let operatable = "0xb9F6ED924F0b46fA9912eBc62BcBeB64FbFcC005"
    // let checkPermission = "0x87465916d6168fdC9f42B8649074B0EE361Eb061"
    // let lock = "0x8AB82A88072307862152BE773404D7Fa127720CE"
    // let gaugeFactory ="0xCF183377bd729c30f05bC013c221C4585105C9F7"
    // let boost = ""
    let weth9 = "0xABD262d7E300B250bab890f5329E817B7768Fe3C"

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
    // TRA = await FRAXShares.deploy(operatable.address, "TRA", "TRA", oracle.address);
    // console.log("TRA:" + TRA.address);
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
    // TRA = await FRAXShares.deploy(checkPermission.address, "TRA", "TRA", oracle.address);
    // console.log("TRA:" + TRA.address);
    //
    //
    // await TRA.setStableAddress(frax.address);
    // await frax.setStockAddress(TRA.address);
    //
    //
    // const Locker = await ethers.getContractFactory('Locker');
    // lock = await Locker.deploy(checkPermission, TRA, "1800");
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
    //      TRA,
    //      toWei('1'),
    //      parseInt("19353185"),
    //      "2592000"
    //  );
    // console.log("boost:" + boost.address)
    //
    //
    // const GaugeController = await ethers.getContractFactory('GaugeController');
    // gaugeController = await GaugeController.deploy(
    //     checkPermission,
    //     boost.address,
    //     lock,
    //     "1200");
    //
    // console.log("gaugeController:" + gaugeController.address)
    const SwapRouter = await ethers.getContractFactory('SwapRouter');
    swapRouter = await SwapRouter.deploy(checkPermission, weth9);
    console.log("swapRouter:" + swapRouter.address);


    // const SwapMining = await ethers.getContractFactory('SwapMining');
    // swapMining = await SwapMining.deploy(
    //     checkPermission,
    //     lock,
    //     TRA,
    //     deployer.address,
    //     swapRouter.address,
    //     toWei('1'),
    //     "19353195",
    //     "259200"
    // );
    // console.log("swapMining:" + swapMining.address);
    // await swapRouter.setSwapMining(swapMining.address);
    //
    //
    // const SwapController = await ethers.getContractFactory('SwapController');
    // swapController = await SwapController.deploy(
    //     checkPermission,
    //     swapMining.address,
    //     lock,
    //     "1200");
    //
    // console.log("swapController:" + swapController.address)

    // await boost.addController(gaugeController.address);
    // // await lock.removeBoosts(boost.address)
    // await lock.addBoosts(gaugeController.address);

    // await lock.addBoosts(boost.address)
    // await TRA.addPool(boost.address);


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })