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
    let usdc = "0x1d870E0bDF106B8E515Ed0276ACa660c30a58D3A"
    // let timeLock = " 0xf6d2Ac942b3C4a43F1936ab90249BB6d18E3b207"
    // let oracle = "0x3aB76d4344fE2106837155D96b54EAD0bb8140Cf"
    let fxs = "0x120818ffb5b291aEe8e5034D1c37b1AfAe7d677a"
    let frax = "0x27ede5894cdae5b077aA74dD17112ECFe4574054"
    let pool = "0xfD30d193cC339c527825032a08d8F111Be07E8bd"
    let lock = "0x8AB82A88072307862152BE773404D7Fa127720CE"
    // let swapMining = "0x27D801020b531154003ba9f31598FbBf3C0A1d01"


    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)

    //  const MintTool = await ethers.getContractFactory('MintTool', {
    //     libraries: {
    //         PoolLibrary: "0x6b60Ba3E76CaAD657D4A01dEd8Ee2c315ccF281A",
    //     },
    // });
    //
    //  mintTool = await MintTool.deploy(pool,frax, fxs,usdc);

    // console.log("mintTool:" + mintTool.address)


    // const LockerTool = await ethers.getContractFactory('LockerTool');
    //
    // lockerTool = await LockerTool.deploy(lock,"1800");
    // console.log("lockerTool:"+lockerTool.address)


    const CalcTool = await ethers.getContractFactory('CalcTool', {
        libraries: {
            PoolLibrary: "0x81FF9cE868cDB22d30b5533F181Bf941cD44CCb9",
        },
    });

    calcTool = await CalcTool.deploy(
        pool,
        frax,
        fxs,
        usdc,
        lock,
        "1800");
    console.log("calcTool:" + calcTool.address)

    // const CalcMiningReward = await ethers.getContractFactory('CalcMiningReward');
    //
    // calcMiningReward = await CalcMiningReward.deploy(swapMining);
    // console.log("calcMiningReward:"+calcMiningReward.address)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })