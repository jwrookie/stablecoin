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
   let TRA = "0xA601fC1a11432dd9B59AF8a82E8604fBb368c436"
  //  let oracle = ""
    let rusd = "0xA4E9B1b5Cdd331A946d832eC3F07B718AcBDF94c"
    //  let operatable = "0x0504707B0d5740f600dA1156FE014953A7442CAe"
    //  //let bond = "0x0830b7Bb803965D47a2c5Dcfcd819d7BC4B69Ebf"
    //
    //
    //  // let pool = "0x255B2A455f94957562915784fFf3dd872DFd92F2"
     //let bond = "0x1ecD0b3b4053D65252Bf404bAaCF8C4d5f27093c"
    //   let TRA = "0x6d2138C3Aa8e20437a541AE287dD047Aed4731De"
    //  // // const TestERC20 = await ethers.getContractFactory("TestERC20");
    //  // // let usdc = await TestERC20.attach(usdcAddr);
    //  // let factory = "0x664aA5c2b9A12228aEc799cC97f584a06690BdA7"
    //  // let tokenA = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"
    //  // let weth = "0xABD262d7E300B250bab890f5329E817B7768Fe3C"
    //  //
    //  // // let rusdAddr = "0x19cdB8EFB4Df6AAB7A6c0EABeD8Fe6cfE5351159"
    //  // // let poolAddr ="0x5ca013872bB0729134725EBa04dF3caB8d256a58"
    //  // let oracle = "0x821Ce313D3F015C4290D1035a3d0Df1153D556c3"
    //  // let rusdPoolLibrary = "0x8fd8987A3B67C0D410BaC2E404923C5a8Ee2a723"
    //  let rusd = "0x4003b8891Dc10558342Fc3feC9c1d02C5B0C8e5D"
    // let bond = "0x6Fd30E5D362E571a457C98C2E0CD0D8147b2A0C9"
  let checkPermission = "0x87465916d6168fdC9f42B8649074B0EE361Eb061"


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
    //
    //
    //
    // timeLock = await deployContract(deployer, {
    //     bytecode: Timelock.bytecode,
    //     abi: Timelock.abi
    // }, [deployer.address, 0]);
    // console.log("timeLock:" + timeLock.address)
    //
    //
    // const TimeLock = await ethers.getContractFactory("TimeLock");
    // timeLock = await TimeLock.deploy(deployer.address, 0);
    // console.log("timeLock:" + timeLock.address);

    // const TestOracle = await ethers.getContractFactory("TestOracle");
    // oracle = await TestOracle.deploy();
    // console.log("oracle:" + oracle.address);
    //
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
    // const rusdShares = await ethers.getContractFactory('Stock');
    // TRA = await rusdShares.deploy(checkPermission, "TRA", "TRA", oracle);
    // console.log("TRA:" + TRA.address);

    // const rusdStablecoin = await ethers.getContractFactory('RStablecoin');
    // rusd = await rusdStablecoin.deploy(checkPermission, "rusd", "rusd");
    // console.log("rusd:" + rusd.address);

    // // await TRA.setStableAddress(rusd.address);
    // // await rusd.setStockAddress(TRA.address);
    const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
    poolLibrary = await PoolLibrary.deploy();

    console.log("poolLibrary:" + poolLibrary.address);


    const Pool_USDC = await ethers.getContractFactory('PoolUSD', {
        libraries: {
            PoolLibrary: poolLibrary.address,
        },
    });
    pool = await Pool_USDC.deploy(checkPermission, rusd, TRA, usdc, toWei('10000000000'));
    console.log("pool:" + pool.address)
    //
    // const MockChainLink = await ethers.getContractFactory("MockChainLink");
    // chainLink = await MockChainLink.deploy();
    // console.log("chainLink:" + chainLink.address);
    // await chainLink.setAnswer(toWei('100'));
    //
    // const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
    // chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
    // console.log("chainlinkETHUSDPriceConsumer:" + chainlinkETHUSDPriceConsumer.address);

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
    // bondIssuer = await rusdBondIssuer.deploy(checkPermission, rusd, bond);
    // console.log("bondIssuer:" + bondIssuer.address)

    //  const Locker = await ethers.getContractFactory('Locker');
    // locker = await Locker.deploy(TRA);
    // console.log("Locker:" + locker.address)


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