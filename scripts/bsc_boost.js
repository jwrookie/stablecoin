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
   // let TRA = "0x511Ab81D33da3a3029E09a03cEe5748204535aAf"
    // let rusd = "0x195862BFe2E63984cb0C2021C3A86bC4d567D9fb"
    // // //
    // // // let operatable = "0xb9F6ED924F0b46fA9912eBc62BcBeB64FbFcC005"
    let checkPermission = "0x87465916d6168fdC9f42B8649074B0EE361Eb061"
    let lock = "0x8AB82A88072307862152BE773404D7Fa127720CE"
    //let gaugeFactory = "0xCa49ddf72D355e38cb9102a5C95DD0D4F73c810F"
    // let boost = ""
    let swapMining = "0x5E1e0D50EbE7A314AA95BB9071041Aaf9D491493"
   // let weth9 = "0xB296bAb2ED122a85977423b602DdF3527582A3DA"

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

    // const Boost = await ethers.getContractFactory("Boost");
    // boost = await Boost.deploy(
    //     checkPermission,
    //     lock,
    //     gaugeFactory,
    //     TRA,
    //     toWei('1'),
    //     parseInt("11548899"),
    //     "2592000"
    // );
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
    // const SwapRouter = await ethers.getContractFactory('SwapRouter');
    // swapRouter = await SwapRouter.deploy(checkPermission, weth9);
    // console.log("swapRouter:" + swapRouter.address);
    //
    // const SwapMining = await ethers.getContractFactory('SwapMining');
    // swapMining = await SwapMining.deploy(
    //     checkPermission,
    //     lock,
    //     TRA,
    //     deployer.address,
    //     swapRouter.address,
    //     toWei('1'),
    //     "11548999",
    //     "259200"
    // );
    // console.log("swapMining:" + swapMining.address);
    // await swapRouter.setSwapMining(swapMining.address);
    //
    const SwapController = await ethers.getContractFactory('SwapController');
    swapController = await SwapController.deploy(
        checkPermission,
        swapMining,
        lock,
        "1200");

    console.log("swapController:" + swapController.address)

    //await boost.addController(gaugeController.address);
    //await swapMining.addController(swapController.address);
    // // await lock.removeBoosts(boost.address)
    // await lock.addBoosts(boost.address);
    // await lock.addBoosts(swapMining.address);
    // await lock.addBoosts(gaugeController.address);
    // await lock.addBoosts(swapController.address);

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