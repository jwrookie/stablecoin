const {expectRevert, time} = require('@openzeppelin/test-helpers');
//const TestOwnableToken = artifacts.require('TestOwnableToken');
// const Timelock = artifacts.require('Timelock');
// const FRAXShares = artifacts.require('FRAXShares');
// const FRAXStablecoin = artifacts.require('FRAXStablecoin');
// const Pool_USDC = artifacts.require('Pool_USDC');
// const TestERC20 = artifacts.require('TestERC20');
// const TestOracle = artifacts.require('TestOracle')
// const FraxPoolLibrary = artifacts.require('FraxPoolLibrary');
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
    let usdc = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"
   // let timeLock = " 0xf6d2Ac942b3C4a43F1936ab90249BB6d18E3b207"
  //  let fxs = "0x9903C08A1Ec72AF241AB29BA4B83326E7B4c68c6"
  let frax = "0x49FFC1e03D04986f646583E59D6e21ac193a4713"

   // let pool = "0x255B2A455f94957562915784fFf3dd872DFd92F2"
  let fxb = "0x4858585fbD412c1Eb942e1E39Ebb1e2298A4BE27"
   //  let fxs = "0x2C4Dc61958e1090B9c64C21d8607BE81f7c5cD4D"
    // // const TestERC20 = await ethers.getContractFactory("TestERC20");
    // // let usdc = await TestERC20.attach(usdcAddr);
    // // let factory = "0x664aA5c2b9A12228aEc799cC97f584a06690BdA7"
    // // let tokenA = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"
    // // let weth = "0xABD262d7E300B250bab890f5329E817B7768Fe3C"
    //
    // // let fraxAddr = "0x19cdB8EFB4Df6AAB7A6c0EABeD8Fe6cfE5351159"
    // // let poolAddr ="0x5ca013872bB0729134725EBa04dF3caB8d256a58"
 // let oracle = "0x821Ce313D3F015C4290D1035a3d0Df1153D556c3"
   // let fraxPoolLibrary = "0x8fd8987A3B67C0D410BaC2E404923C5a8Ee2a723"







    // const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
    // let fraxAddr = "0x189F19990FA4728e986525aD521A6e4361B646AE"
   // let fraxPoolLibrary = "0x77748f6518C4BbCd1beDeD1132eD11A66F745750"
    //frax = await FRAXStablecoin.attach(fraxAddr)

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

    // const FRAXShares = await ethers.getContractFactory("FRAXShares");
    // fxs = await FRAXShares.deploy("fxs", "fxs", oracle);
    // console.log("fxs:" + fxs.address);
    //
    // const FRAXStablecoin = await ethers.getContractFactory("FRAXStablecoin");
    // frax = await FRAXStablecoin.deploy("frax", "frax");
    // console.log("frax:" + frax.address);
    //
    // await fxs.setFraxAddress(frax.address);
    // await frax.setFXSAddress(fxs.address);
    //
    //
    // const FraxPoolLibrary = await ethers.getContractFactory("FraxPoolLibrary");
    // fraxPoolLibrary = await FraxPoolLibrary.deploy();
    // console.log("fraxPoolLibrary:" + fraxPoolLibrary.address);
    //
    //
    // const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
    //     libraries: {
    //         FraxPoolLibrary: fraxPoolLibrary.address,
    //     },
    // });
    // pool = await Pool_USDC.deploy(frax.address, fxs.address, usdc, toWei('100000'));
    // console.log("pool:" + pool.address);
    //
    // const MockChainLink = await ethers.getContractFactory("MockChainLink");
    // chainLink = await MockChainLink.deploy();
    // console.log("chainLink:" + chainLink.address);
    // await chainLink.setAnswer(toWei('100'));
    //
    //
    // const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
    // chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
    // console.log("chainlinkETHUSDPriceConsumer:" + chainlinkETHUSDPriceConsumer.address);

    // await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);


    // await usdc.mint(deployer.address, toWei('100000000'));
    //
    // await frax.approve(pool.address, toWei('1000'));
    // await fxs.approve(pool.address, toWei('1000'));
    // await usdc.approve(pool.address, toWei('1000'));
    //await frax.addPool(pool.address);


     // const  FRAXStablecoin = await ethers.getContractFactory("FRAXStablecoin");
   // let frax = await FRAXStablecoin.at(fraxAddr)


    // const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
    //     libraries: {
    //         FraxPoolLibrary: fraxPoolLibrary,
    //     },
    // });
    //let pool = await Pool_USDC.at(poolAddr)
    //
    // const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
    // uniswapOracle = await UniswapPairOracle.deploy(factory, tokenA, weth, deployer.address, timeLock);
    // console.log("uniswapOracle:" + uniswapOracle.address)

    //
    // await pool.setCollatETHOracle(uniswapOracle.address, weth);
    //
    // await frax.setFRAXEthOracle(uniswapOracle.address, weth);
    //
    // await frax.setFXSEthOracle(uniswapOracle.address, weth);
    //
    // await uniswapOracle.setPeriod(1);
    //
    // const FraxBond = await ethers.getContractFactory("FraxBond");
    // fxb = await FraxBond.deploy("fxb", "fxb");
    // console.log("fxb:" + fxb.address)

    const FraxBondIssuer = await ethers.getContractFactory('FraxBondIssuer');
    fraxBondIssuer = await FraxBondIssuer.deploy(frax, fxb);
    console.log("fraxBondIssuer:" + fraxBondIssuer.address)

    //  const Locker = await ethers.getContractFactory('Locker');
    // locker = await Locker.deploy(fxs);
    // console.log("Locker:" + locker.address)


    // await fxb.addIssuer(deployer.address);
    // await fxb.addIssuer(fraxBondIssuer.address);
    // await fxb.issuer_mint(fraxBondIssuer.address, toWei('100000'))
    // await fxb.issuer_mint(deployer.address, toWei('100000'))
    //
    // await frax.approve(fraxBondIssuer.address, toWei('1000'))
    // await fxb.approve(fraxBondIssuer.address, toWei('1000'))
    // await frax.addPool(fraxBondIssuer.address)

    // let pool = "0x9eC310e671618c9195018d02bFBd71e96d61A3c9"
    // let fxs = "0x03cE829Bc52e48A1c0472a2e4c86B13dDc66fE0D"
    //   const Tool = await ethers.getContractFactory('Tool');
    // tool = await Tool.deploy(pool,frax, fxs,usdc);
    // console.log("tool:" + tool.address)

    //  const Tool = await ethers.getContractFactory('Tool', {
    //     libraries: {
    //         FraxPoolLibrary: fraxPoolLibrary.address,
    //     },
    // });
    //
    //  tool = await Tool.deploy(frax, fxs,usdc,toWei('100'));
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