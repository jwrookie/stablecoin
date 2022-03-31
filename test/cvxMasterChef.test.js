const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('ConvexMasterChef', () => {
    beforeEach(async () => {
       [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();

        const CvxLockerV2 = await ethers.getContractFactory('CvxLockerV2');
        lock = await CvxLockerV2.deploy({gasLimit: "9400000"});





    });

    it('lock info  ', async () => {
        console.log("lock:"+lock.address);


    });




});
