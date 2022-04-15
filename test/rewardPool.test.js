const {ethers} = require("hardhat");
const {time} = require('@openzeppelin/test-helpers');
const { on } = require('events');
const { artifacts } = require('hardhat');
const { toWei } = require("web3-utils");
const {BigNumber} = require('ethers');
const { expect } = require("chai");
const RewardPool = artifacts.require('./contracts/dao/RewardPool.sol');
const MockToken = artifacts.require('./contracts/mock/MockToken.sol');
const Operatable = artifacts.require('./contracts/tools/Operatable.sol');
const Locker = artifacts.require('./contracts/dao/Locker.sol');

contract('RewardPool', ([owner, secondObject]) => {
    let needBoolean = true;
    let rejectBoolean = false;
    let firstInfo;
    let authorNumber = 100000;
    let needNumber = 10000;

    beforeEach(async () => {
        const Oracle = await ethers.getContractFactory('TestOracle');
        testOracle = await Oracle.deploy();
        const FXS = await ethers.getContractFactory('FRAXShares');
        fxs = await FXS.deploy("HelloWorld", "newObject", testOracle.address);

        const FRAX = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAX.deploy("fraxNo1", "fraxNo2");

        operatable = await Operatable.new();
        mockToken = await MockToken.new("HelloWorld", "newObject", 18, toWei('10'));
        tokenLock = await Locker.new(mockToken.address, parseInt(await time.duration.days(1)));
        let lastBlock = await time.latestBlock();

        rewardPool = await RewardPool.new(operatable.address, fxs.address, 100000, parseInt(lastBlock), 10);

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);
        await frax.addPool(rewardPool.address);
        await frax.addPool(owner);
    });

    async function checkInfo(infoNo1, infoNo2) {
        if(infoNo1 == infoNo2) {
            return true;
        }else {
            return false;
        }
    }

    it('test poolLength', async () => {
        assert.equal(await rewardPool.poolLength(), 0);
    });

    it('test setPause', async () => {
        await rewardPool.setPause();
        assert.equal(await rewardPool.paused(), true);
    });

    it('test add', async () => {
        assert.equal(await rewardPool.poolLength(), 0);

        await rewardPool.add(1, tokenLock.address, needBoolean);

        assert.equal(await rewardPool.poolLength(), 1);
    });

    it('test set true', async () => {
        assert.equal(await rewardPool.poolLength(), 0);
        await rewardPool.add(100, tokenLock.address, needBoolean);
        firstInfo = await rewardPool.poolInfo(0);

        let length = await rewardPool.poolLength();

        assert.equal(length, 1);

        await rewardPool.set(0, 10, needBoolean);

        let secondLength = await rewardPool.poolLength();
        assert.equal(secondLength, 1);

        let secondInfo = await rewardPool.poolInfo(0);

        assert.equal(await checkInfo(firstInfo, secondInfo), rejectBoolean);
    });

    it('test set false', async () => {
        await rewardPool.add(100, tokenLock.address, needBoolean);
        
        firstInfo = await rewardPool.poolInfo(0);

        await rewardPool.set(0, 10, rejectBoolean);
        let secondInfo = await rewardPool.poolInfo(0);

        assert.equal(await checkInfo(firstInfo, secondInfo), rejectBoolean);
    });

    it('test deposit', async () => {
        await mockToken.approve(rewardPool.address, authorNumber);

        await rewardPool.add(100, mockToken.address, needBoolean);

        await rewardPool.deposit(0, needNumber);

        assert.equal(await mockToken.balanceOf(rewardPool.address), needNumber);

        let userInfo = await rewardPool.userInfo(0, owner);
        assert.equal(userInfo.amount, needNumber);
    });

    it('test withdraw', async () => {
        await frax.approve(rewardPool.address, toWei('10'));
        await fxs.approve(rewardPool.address, toWei('10'));

        await mockToken.approve(rewardPool.address, authorNumber);

        await rewardPool.add(100, mockToken.address, needBoolean);

        await rewardPool.deposit(0, needNumber, {from: owner});
        console.log("balanceOf"+await mockToken.balanceOf(owner));

        let nowTime = await time.latestBlock();
        await time.advanceBlockTo(parseInt(nowTime) + 10);
        
        await rewardPool.withdraw(0, needNumber);
        console.log("balanceOf"+await mockToken.balanceOf(owner));
    });
    
    it('test pending', async () => {
        await mockToken.approve(rewardPool.address, authorNumber);

        await rewardPool.add(1, mockToken.address, rejectBoolean);

        assert.equal(await rewardPool.pending(0, owner), 0);

        await rewardPool.deposit(0, needNumber, {from: owner});

        assert.equal(await rewardPool.pending(0, owner), 0);

        let lockBlock = await time.latestBlock();
        await time.advanceBlock(parseInt(lockBlock) + 2);
        let poolInfo = await rewardPool.poolInfo(0);
        let userInfo = await rewardPool.userInfo(0, owner);
        let totalAllocPoint = await rewardPool.totalAllocPoint();
        let tokenPerBlock = await rewardPool.tokenPerBlock();
        let mul = await (await time.latestBlock() - poolInfo.lastRewardBlock);
        let tokenReward = tokenPerBlock * mul * poolInfo.allocPoint / totalAllocPoint;
        let lpSupply = await mockToken.balanceOf(rewardPool.address);
        let accTokenPerShare = poolInfo.accTokenPerShare + tokenReward * 10000000 / lpSupply;
        let currPending2 = userInfo.amount * accTokenPerShare / 10000000 - userInfo.rewardDebt;
        assert.equal(await rewardPool.pending(0, owner), currPending2);
    });

    it('test emergencyWithdraw', async () => {
        let secondNumber = 20000;

        await mockToken.approve(rewardPool.address, authorNumber);

        await mockToken.mint(secondObject, 20000000);

        await mockToken.approve(rewardPool.address, secondNumber, {from: secondObject});

        await rewardPool.add(200, mockToken.address, needBoolean);

        await rewardPool.deposit(0, needNumber, {from: owner});
        await rewardPool.deposit(0, secondNumber, {from: secondObject});

        await rewardPool.emergencyWithdraw(0, {from: secondObject});

        assert.equal(await mockToken.balanceOf(rewardPool.address), needNumber);
    });
});