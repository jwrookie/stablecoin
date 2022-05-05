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
    let usdc = "0x488e9C271a58F5509e2868C8A758A345D28B9Db9"
   // let timeLock = " 0xf6d2Ac942b3C4a43F1936ab90249BB6d18E3b207"
    // let oracle = "0x3aB76d4344fE2106837155D96b54EAD0bb8140Cf"
    let fxs = "0x6d2138C3Aa8e20437a541AE287dD047Aed4731De"
    let frax = "0x5AF694EC26FFD0141ff385e4793fbFF89e915B57"
   let pool = "0x35a9d3b93A68a81A98896019ac446937dACe28b1"
    let lock = "0x259d2BFda49012C37BE371D0b267DfF1d47997b8"




    for (const account of accounts) {
        //console.log('Account address' + account.address)
    }

    let deployer = accounts[0]
    console.log('deployer:' + deployer.address)
    // We get the contract to deploy
    console.log('Account balance:', (await deployer.getBalance()).toString() / 10 ** 18)

    //  const MintTool = await ethers.getContractFactory('MintTool', {
    //     libraries: {
    //         PoolLibrary: "0xb9ea32450022104Cd79e258d88E662833962C8f3",
    //     },
    // });
    //
    //  mintTool = await MintTool.deploy(pool,frax, fxs,usdc);
    //
    // console.log("mintTool:" + mintTool.address)


     const LockerTool = await ethers.getContractFactory('LockerTool');

     lockerTool = await LockerTool.deploy(lock,"1800");
     console.log("lockerTool:"+lockerTool.address)


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })