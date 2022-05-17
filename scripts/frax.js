const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {toWei} = web3.utils;
// const Router = require('../test/mock/Timelock.json');
// const {BigNumber} = require('ethers');

//const Timelock = require('../test/mock/Timelock.json');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');
const {ethers, waffle} = require("hardhat");


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

async function main() {
    const accounts = await ethers.getSigners()
    const zeroAddr = "0x0000000000000000000000000000000000000000"
    let usdc = "0x1d870E0bDF106B8E515Ed0276ACa660c30a58D3A"
    // let timeLock = " 0xf6d2Ac942b3C4a43F1936ab90249BB6d18E3b207"
    // let TRA = "0x59004773A3Af6671B7e2dC47aCba3e6b1DaEab31"
    // let rusd = "0xB4434520c08D3DD00D4BE1bC9063Cd557D17e19d"
    //  let operatable = "0x0504707B0d5740f600dA1156FE014953A7442CAe"
    //  //let bond = "0x0830b7Bb803965D47a2c5Dcfcd819d7BC4B69Ebf"
    //
    //
    //  // let pool = "0x255B2A455f94957562915784fFf3dd872DFd92F2"
    //  // let bond = "0x4858585fbD412c1Eb942e1E39Ebb1e2298A4BE27"


    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)


    //  const TestERC20 = await ethers.getContractFactory("TestERC20");
    //  usdc = await TestERC20.deploy();
    //  console.log("usdc:" + usdc.address);
    //
    //
    //  busd = await TestERC20.deploy();
    //  console.log("busd:" + busd.address);
    //
    //
    //  dai = await TestERC20.deploy();
    //  console.log("dai:" + dai.address);


    const TestOracle = await ethers.getContractFactory("TestOracle");
    oracle = await TestOracle.deploy();
    console.log("oracle:" + oracle.address);

    const Operatable = await ethers.getContractFactory("Operatable");
    operatable = await Operatable.deploy();
    console.log("operatable:" + operatable.address);


    const CheckPermission = await ethers.getContractFactory("CheckPermission");
    checkPermission = await CheckPermission.deploy(operatable.address);
    console.log("checkPermission:" + checkPermission.address);

    const rusdShares = await ethers.getContractFactory('Stock');
    TRA = await rusdShares.deploy(checkPermission.address, "TRA", "TRA", oracle.address);
    console.log("TRA:" + TRA.address);

    const rusdStablecoin = await ethers.getContractFactory('RStablecoin');
    rusd = await rusdStablecoin.deploy(checkPermission.address, "rusd", "rusd");
    console.log("rusd:" + rusd.address);

    await TRA.setStableAddress(rusd.address);
    await rusd.setStockAddress(TRA.address);
    const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
    poolLibrary = await PoolLibrary.deploy();

    console.log("poolLibrary:" + poolLibrary.address);


    const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
        libraries: {
            PoolLibrary: poolLibrary.address,
        },
    });
    pool = await Pool_USDC.deploy(checkPermission.address, rusd.address, TRA.address, usdc, toWei('10000000000'));
    console.log("pool:" + pool.address)

    const MockChainLink = await ethers.getContractFactory("MockChainLink");
    chainLink = await MockChainLink.deploy();
    console.log("chainLink:" + chainLink.address);
    await chainLink.setAnswer(toWei('100'));

    const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
    chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
    console.log("chainlinkETHUSDPriceConsumer:" + chainlinkETHUSDPriceConsumer.address);

    // await rusd.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

    // await rusd.addPool(pool.address);
    // await usdc.mint(deployer.address, toWei('100000000'));

    // await rusd.approve(pool.address, toWei('1000'));
    // await TRA.approve(pool.address, toWei('1000'));
    // await usdc.approve(pool.address, toWei('1000'));


    // const  rusdStablecoin = await ethers.getContractFactory("rusdStablecoin");
    // let rusd = await rusdStablecoin.at(rusdAddr)


    // const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
    //     libraries: {
    //         rusdPoolLibrary: rusdPoolLibrary,
    //     },
    // });
    // let pool = await Pool_USDC.at(poolAddr)


    // //
    // await pool.setCollatETHOracle(uniswapOracle1.address, weth);

    // await rusd.setrusdEthOracle(uniswapOracle2.address, weth);

    // await rusd.setTRAEthOracle(uniswapOracle3.address, weth);

    // await uniswapOracle.setPeriod(1);
    //

    // const Operatable = await ethers.getContractFactory('Operatable');
    //  operatable = await Operatable.deploy();
    //  console.log("operatable:" + operatable.address)
    // const rusdBond = await ethers.getContractFactory("Bond");
    // bond = await rusdBond.deploy(checkPermission,"bond", "bond");
    // console.log("bond:" + bond.address)

    // const rusdBondIssuer = await ethers.getContractFactory('BondIssuer');
    // rusdBondIssuer = await rusdBondIssuer.deploy(checkPermission, rusd, bond);
    // console.log("rusdBondIssuer:" + rusdBondIssuer.address)

    // //  const Locker = await ethers.getContractFactory('Locker');
    // // locker = await Locker.deploy(TRA);
    // // console.log("Locker:" + locker.address)


    // await bond.addIssuer(deployer.address);
    // await bond.addIssuer(rusdBondIssuer.address);
    // await bond.issuerMint(rusdBondIssuer.address, toWei('100000'))
    // await bond.issuerMint(deployer.address, toWei('100000'))

    // await rusd.approve(rusdBondIssuer.address, toWei('1000'))
    // await bond.approve(rusdBondIssuer.address, toWei('1000'))
    // await rusd.addPool(rusdBondIssuer.address)

    // const Tool = await ethers.getContractFactory('MintTool', {
    //     libraries: {
    //         rusdPoolLibrary: rusdPoolLibrary,
    //     },
    // });

    // tool = await Tool.deploy(pool, rusd, TRA, usdc);
    // console.log("tool:" + tool.address)


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })