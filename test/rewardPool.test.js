const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('RewardPool', () => {
    beforeEach(async () => {

        [owner, dev, addr1] = await ethers.getSigners();
        // TestERC20 = await ethers.getContractFactory("TestERC20");
        // usdc = await TestERC20.deploy();
        // busd = await TestERC20.deploy();
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");
        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));

        CheckOper = await ethers.getContractFactory("CheckOper");
        checkOper = await CheckOper.deploy(operatable.address);

        // Locker = await ethers.getContractFactory("Locker");
        //
        // lock = await Locker.deploy(frax.address);

        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock)
        const RewardPool = await ethers.getContractFactory("RewardPool");
        rewardPool = await RewardPool.deploy(checkOper.address, fxs.address, "100000", parseInt(lastBlock), 10);

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);
        await frax.addPool(rewardPool.address)
        await frax.addPool(owner.address)
        //await fxs.poolMint(rewardPool.address,toWei('100'))


    });

    it('should withdraw correct', async () => {
        await frax.approve(rewardPool.address, toWei('10'));
        await fxs.approve(rewardPool.address, toWei('10'));
        await usdc.approve(rewardPool.address, toWei('10'));
        await usdc.mint(dev.address, toWei('1'))

        await frax.connect(dev).approve(rewardPool.address, toWei('10'));
        await fxs.connect(dev).approve(rewardPool.address, toWei('10'));
        await usdc.connect(dev).approve(rewardPool.address, toWei('10'));
        //expect(await usdc.balanceOf(owner.address)).to.be.eq(toWei('10'))

        await rewardPool.add("200", usdc.address, true);

        console.log("fxs:" + await fxs.balanceOf(dev.address))

        //   await rewardPool.deposit(0, "100000");
        await rewardPool.connect(dev).deposit(0, "100000");
        expect(await usdc.balanceOf(rewardPool.address)).to.be.eq("100000")

        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);

        console.log("fxs:" + await fxs.balanceOf(dev.address))
        //
        console.log("awount:" + await rewardPool.pending(0, dev.address))
        //
        await time.advanceBlockTo(parseInt(stratBlock) + 10);
        await rewardPool.connect(dev).deposit(0, 0);
          console.log("fxs:" + await fxs.balanceOf(dev.address))
        // await rewardPool.connect(dev).withdraw(0, "1");


        // expect(await usdc.balanceOf(owner.address)).to.be.eq(toWei('10'));


        // await fxs.poolMint(owner.address,toWei('1'))

    });


});