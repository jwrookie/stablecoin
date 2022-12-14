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
    let checkPermission = "0x43c992c1f499e259514a8409e2472Fa770D8da26"
    let lock = "0x44b7632BC9fc9E15BF316795538419779D4AC9C5"
    let gaugeFactory = "0x1e8c65b91A2ECc2Fd7d1eB9e48DFa6DaC0394713"
    let swapMining = "0xcc10B8a5f18bd81979B8CE83c9A14C02F72397b7"
    let weth9 = "0xB296bAb2ED122a85977423b602DdF3527582A3DA"
    //  let oracle = "0x2B2065Ad161636447fe1eeeE59650E70De881c16"
    let Ken = "0xf7AAd56342e0de796001453416D168159D476f21"

    //let swapRouter = ""


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
    // frax = await FRAXStablecoin.deploy(checkPermission, "frax", "frax");
    // console.log("frax:" + frax.address);

    //  const FRAXShares = await ethers.getContractFactory('Stock');
    // KEN = await FRAXShares.deploy(checkPermission, "KEN", "KEN", oracle);
    // console.log("KEN:" + KEN.address);


    // await TRA.setStableAddress(frax.address);
    // await frax.setStockAddress(TRA.address);
    //
    //
    // const Locker = await ethers.getContractFactory('Locker');
    // lock = await Locker.deploy(checkPermission, KEN.address, "604800");
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
    //     Ken,
    //     toWei('1'),
    //     parseInt("12269080"),
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
    //     "300");
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
    //     Ken,
    //     deployer.address,
    //     swapRouter.address,
    //     toWei('1'),
    //     "12301202",
    //     "259200"
    // );
    // console.log("swapMining:" + swapMining.address);
    // await swapRouter.setSwapMining(swapMining.address);

    // const SwapController = await ethers.getContractFactory('SwapController');
    // swapController = await SwapController.deploy(
    //     checkPermission,
    //     swapMining,
    //     lock,
    //     "300");
    //
    // console.log("swapController:" + swapController.address)

    // await boost.addController(gaugeController.address);
    // await swapMining.addController(swapController.address);
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