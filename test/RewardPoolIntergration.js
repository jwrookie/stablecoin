const {time} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {artifacts} = require('hardhat');
const {toWei} = require('web3-utils');
const {BigNumber} = require('ethers');
const {expect} = require('chai');
const { parse } = require('path');
const { advanceBlockTo } = require('@openzeppelin/test-helpers/src/time');

contract('RewardPoolIntergration', () => {
    let lastBlock;
    let startBlock;
    let poolLength;
    let pendingValue;
    let currentBlock;
    let ownerFxsValue;
    let ownerUserInfo;
    let secondUserInfo;
    let secondObejctUserInfo;
    let acquiescentToken;
    let secondObjectFxsValue;
    let ownerPandingValue;
    let ownerUserInfoAmount;
    let secondAcquiescentToken;
    let secondObejctUserInfoAmount;

    beforeEach(async function() {
        [owner, seObject] = await ethers.getSigners();
        lastBlock = await time.latestBlock();
        startBlock = parseInt(lastBlock);

        const RewardPool = await ethers.getContractFactory("RewardPool");
        const Operatable = await ethers.getContractFactory("Operatable");
        const MockToken = await ethers.getContractFactory("MockToken");

        const Oracle = await ethers.getContractFactory("TestOracle");
        oracle = await Oracle.deploy();
        const FXS = await ethers.getContractFactory("FRAXShares");
        fxs = await FXS.deploy("TemporaryStringName", "TemporaryStringSymbol", oracle.address);

        const FRAX = await ethers.getContractFactory("FRAXStablecoin");
        frax = await FRAX.deploy("TemporaryMemoryName", "TemporaryMemorySymbol");

        operatable = await Operatable.deploy();
        mockToken = await MockToken.deploy("TemporaryMockName", "TemporaryMockSymbol", 18, toWei("10"));
        secondMockToken = await MockToken.deploy("TemporaryMockName", "TemporaryMockSymbol", 18, toWei("10"));
        oracle = await Oracle.deploy();
        console.log("startBlock:" + startBlock);
        rewardPool = await RewardPool.deploy(operatable.address, fxs.address, 10000, startBlock, 100);

        poolLength = await rewardPool.poolLength();

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        await frax.addPool(rewardPool.address);
        await frax.addPool(owner.address);
    });

    it('Single user deposit and pending', async function() {
        let poolInfo;
        let structAllocPoint;
        let lastRewardBlock;
        let accTokenPerShare;
        let totalAmount;
        let userInfo;

        let firstLastBlock;
        let secondLastBlock;
        let totalAllocPoint = 1;
        let mul;
        let amount;
        let rewardDebt;

        let tokenReward;
        let targetAmount;
        let targetAccTokenPerShare;

        let firstLpTokenBalance = await mockToken.balanceOf(rewardPool.address);
        let targetLpTokenBalance;
        assert.equal(firstLpTokenBalance, 0);

        await mockToken.approve(rewardPool.address, 100000);
        await rewardPool.add(100, mockToken.address, true);

        poolInfo = await rewardPool.poolInfo(poolLength);
        userInfo = await rewardPool.userInfo(0, owner.address);
        amount = userInfo[0];
        rewardDebt = userInfo[1];
        assert.equal(userInfo[0], 0);
        assert.equal(userInfo[1], 0);

        console.log("-=-" + await fxs.balanceOf(owner.address));

        await rewardPool.deposit(poolLength, 10000);

        firstLastBlock = await time.latestBlock();
        console.log("firstTemp:" + firstLastBlock);

        await time.advanceBlockTo(parseInt(firstLastBlock) + 10);
        secondLastBlock = await time.latestBlock();
        console.log("second:" + secondLastBlock);
        assert.equal((secondLastBlock - firstLastBlock + 1), 11);

        mul = secondLastBlock - firstLastBlock;
        tokenReward = 10000 * mul * 100 / totalAllocPoint;

        targetLpTokenBalance = await mockToken.balanceOf(rewardPool.address);

        assert.equal(targetLpTokenBalance, 10000);

        accTokenPerShare = tokenReward * 1e12 / targetLpTokenBalance;

        userInfo = await rewardPool.userInfo(0, owner.address);
        amount = userInfo[0];

        targetAmount = amount * accTokenPerShare / 1e12 - rewardDebt;

        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 10);

        pendingValue = await rewardPool.pending(0, owner.address);
        expect(pendingValue).to.be.gt(0);

        await rewardPool.connect(owner).deposit(0, 0);

        poolInfo = await rewardPool.poolInfo(poolLength);
        structAllocPoint = await rewardPool.poolInfo[1];
        lastRewardBlock = await rewardPool.poolInfo[2];
        accTokenPerShare = await rewardPool.poolInfo[3];
        totalAmount = await rewardPool.poolInfo[4];

        secondUserInfo = await rewardPool.userInfo(0, owner.address);

        targetAccTokenPerShare = secondUserInfo[0];

        await rewardPool.deposit(0, 0);

        console.log(await fxs.balanceOf(owner.address));
    });

    it('Single user deposit and pending and withdraw', async function() {
        let userInfoAmount;
        let startToken;
        let moveToken;
        let poolToken;
        let endToken;

        await mockToken.approve(rewardPool.address, 100000);
        await rewardPool.add(100, mockToken.address, true);
        acquiescentToken = await mockToken.balanceOf(owner.address);

        await rewardPool.deposit(poolLength, 10000);

        poolToken = await mockToken.balanceOf(rewardPool.address);

        startToken = await mockToken.balanceOf(owner.address);

        moveToken = await mockToken.balanceOf(owner.address);

        assert.equal(startToken, (acquiescentToken - 10000));

        userInfoAmount = await rewardPool.userInfo(0, owner.address);
        let needAmount = userInfoAmount[0];

        await rewardPool.withdraw(poolLength, needAmount);

        moveToken = await mockToken.balanceOf(rewardPool.address);
        assert.equal(moveToken, 0);

        endToken = await mockToken.balanceOf(owner.address);
        assert.equal(acquiescentToken. endToken);
    });

    it('Single user and more pools', async function() {
        let firstLpToken;
        let secondLpToken;
        let firstLpTokenReward;
        let secondLpTokenReward;
        let firstUserInfo;
        let firstUserInfoAmount;
        let secondUserInfoAmount;
        let firstLpPoolToken;
        let secondLpPoolToken;
        let secondPendingValue;

        await mockToken.approve(rewardPool.address, 100000);
        await secondMockToken.approve(rewardPool.address, 100000);

        await rewardPool.add(100, mockToken.address, true);
        await rewardPool.add(2, secondMockToken.address, true);
        poolLength = await rewardPool.poolLength();
        assert.equal(poolLength, 2);

        firstLpToken = await mockToken.balanceOf(rewardPool.address);
        secondLpToken = await mockToken.balanceOf(rewardPool.address);
        assert.equal(firstLpToken, 0);
        assert.equal(secondLpToken, 0);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        secondAcquiescentToken = await secondMockToken.balanceOf(owner.address);

        expect(acquiescentToken).to.be.eq(secondAcquiescentToken);

        firstLpPoolToken = await mockToken.balanceOf(rewardPool.address);
        secondLpPoolToken = await mockToken.balanceOf(rewardPool.address);

        expect(firstLpPoolToken).to.be.eq(secondLpPoolToken);

        firstUserInfo = await rewardPool.userInfo(0, owner.address);
        firstUserInfoAmount = firstUserInfo[0];
        firstLpTokenReward = firstUserInfo[1];
        expect(firstLpTokenReward).to.be.eq(0);
        secondUserInfo = await rewardPool.userInfo(1, owner.address);
        secondUserInfoAmount = secondUserInfo[0];
        secondLpTokenReward = secondUserInfo[1];
        expect(secondLpTokenReward).to.be.eq(0);

        await rewardPool.deposit(0, 10000);
        await rewardPool.deposit(1, 10000);

        firstUserInfo = await rewardPool.userInfo(0, owner.address);
        firstUserInfoAmount = firstUserInfo[0];
        expect(firstUserInfoAmount).to.be.eq(10000);

        firstLpTokenReward = firstUserInfo[1];
        expect(firstLpTokenReward).to.be.eq(0);
        secondUserInfo = await rewardPool.userInfo(1, owner.address);
        secondUserInfoAmount = secondUserInfo[0];
        expect(secondUserInfoAmount).to.be.eq(10000);
        secondLpTokenReward = secondUserInfo[1];
        expect(secondLpTokenReward).to.be.eq(0);

        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 10);

        pendingValue = await rewardPool.pending(0, owner.address);
        expect(pendingValue).to.be.gt(0);
        currentTime = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentTime) + 1);
        secondPendingValue = await rewardPool.pending(1, owner.address);
        expect(secondPendingValue/pendingValue).to.be.lt(2);

        firstUserInfo = await rewardPool.userInfo(0, owner.address);
        firstUserInfoAmount = firstUserInfo[0];
        secondUserInfo = await rewardPool.userInfo(1, owner.address);
        secondUserInfoAmount = secondUserInfo[0];
        expect(firstUserInfoAmount).to.be.eq(secondUserInfoAmount);
    });

    it('More users and single pool', async function() {
        let seObjectPendingValue;

        acquiescentToken = await mockToken.balanceOf(owner.address);

        await mockToken.mint(seObject.address, acquiescentToken);
        secondAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(secondAcquiescentToken).to.be.eq(acquiescentToken);
        
        await mockToken.approve(rewardPool.address, 100000);
        await mockToken.connect(seObject).approve(rewardPool.address, 100000);

        await rewardPool.add(100, mockToken.address, true);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        secondAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(acquiescentToken).to.be.eq(secondAcquiescentToken);

        await rewardPool.connect(owner).deposit(0, 10000);
        await rewardPool.connect(seObject).deposit(0, 10000);
        acquiescentToken = await mockToken.balanceOf(owner.address);
        secondAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(acquiescentToken).to.be.eq(secondAcquiescentToken);

        ownerFxsValue = await fxs.connect(owner).balanceOf(rewardPool.address);

        secondObjectFxsValue = await fxs.connect(seObject).balanceOf(rewardPool.address);

        expect(secondObjectFxsValue).to.be.eq(ownerFxsValue);

        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        ownerPandingValue = await rewardPool.pending(0, owner.address);

        seObjectPendingValue = await rewardPool.pending(0, seObject.address);
        expect(ownerPandingValue/seObjectPendingValue).to.be.eq(3);

        ownerUserInfo = await rewardPool.userInfo(0, owner.address);
        ownerUserInfoAmount = ownerUserInfo[0];

        secondObejctUserInfo = await rewardPool.userInfo(0, seObject.address);
        secondObejctUserInfoAmount = secondObejctUserInfo[0];

        expect(ownerUserInfoAmount).to.be.eq(secondObejctUserInfoAmount);

        await rewardPool.connect(owner).withdraw(0, ownerUserInfoAmount);
        acquiescentToken = await mockToken.balanceOf(owner.address);

        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        await rewardPool.connect(seObject).withdraw(0, secondObejctUserInfoAmount);
        secondAcquiescentToken = await mockToken.balanceOf(seObject.address);

        expect(acquiescentToken).to.be.eq(secondAcquiescentToken);
    });

    it('More users and single pool different init value', async function() {
        let minitOwnerTokenOwn;
        let minitSecondTokenOwn;

        acquiescentToken = await mockToken.balanceOf(owner.address);
        minitOwnerTokenOwn = acquiescentToken;

        await mockToken.mint(seObject.address, acquiescentToken);
        secondAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(secondAcquiescentToken).to.be.eq(acquiescentToken);
        minitSecondTokenOwn = secondAcquiescentToken;

        await mockToken.connect(owner).approve(rewardPool.address, 100000);
        await mockToken.connect(seObject).approve(rewardPool.address, 100000);

        await rewardPool.add(100, mockToken.address, true);

        await rewardPool.connect(owner).deposit(0, 10000);
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        ownerPandingValue = await rewardPool.pending(0, owner.address);
        ownerFxsValue = await fxs.connect(owner).balanceOf(owner.address);
        await rewardPool.connect(seObject).deposit(0, 20000);
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        ownerPandingValue = await rewardPool.pending(0, seObject.address);

        secondObjectFxsValue = await fxs.connect(seObject).balanceOf(owner.address);

        expect(secondObjectFxsValue).to.be.eq(ownerFxsValue);

        await rewardPool.connect(owner).deposit(0, 0);
        await rewardPool.connect(seObject).deposit(0, 0);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        secondAcquiescentToken = await mockToken.balanceOf(seObject.address);

        ownerUserInfo = await rewardPool.userInfo(0, owner.address);
        ownerUserInfoAmount = ownerUserInfo[0];

        secondObejctUserInfo = await rewardPool.userInfo(0, seObject.address);
        secondObejctUserInfoAmount = secondObejctUserInfo[0];

        expect(secondObejctUserInfoAmount - ownerUserInfoAmount).to.be.eq(20000 - 10000);

        await rewardPool.connect(owner).withdraw(0, ownerUserInfoAmount);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        expect(acquiescentToken).to.be.eq(minitOwnerTokenOwn);

        await rewardPool.connect(seObject).withdraw(0, secondObejctUserInfoAmount);

        secondAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(secondAcquiescentToken).to.be.eq(minitSecondTokenOwn);
    });

    it('More users and more pools', async function() {
        let minitMockTokenOwnerOwn;
        let minitSecondMockTokenOwnerOwn;
        let minitMockTokenSeOwn;
        let minitSecondMockTokenSeOwn;
        let secondTokenAcquiescentToken;
        let seondTokenSeAcquiescentToken;
        let ownerTokenValueInThePool;
        let ownerSecondTokenValueInThePool;
        let ownerPendingValue;
        let ownerSecondPnedingValue;
        let secondTokenValueInThePool;
        let secondObjectSecondTokenvalueInThePool;
        let secondPendingValue;
        let secondSecondPendingValue;
        let mockLpToken;
        let secondMockLpToken;
        
        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address);
        minitMockTokenOwnerOwn = acquiescentToken;
        secondTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address);
        minitSecondMockTokenOwnerOwn = secondTokenAcquiescentToken;

        await mockToken.mint(seObject.address, minitMockTokenOwnerOwn);
        secondAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        minitMockTokenSeOwn = secondAcquiescentToken;
        await secondMockToken.mint(seObject.address, minitSecondMockTokenOwnerOwn);
        seondTokenSeAcquiescentToken = await secondMockToken.connect(seObject).balanceOf(seObject.address);
        minitSecondMockTokenSeOwn = seondTokenSeAcquiescentToken;

        expect(minitMockTokenSeOwn).to.be.eq(minitMockTokenOwnerOwn);
        expect(minitSecondMockTokenSeOwn).to.be.eq(minitSecondMockTokenOwnerOwn);

        await mockToken.connect(owner).approve(rewardPool.address, 100000);
        await secondMockToken.connect(owner).approve(rewardPool.address, 100000 * 2);

        await mockToken.connect(seObject).approve(rewardPool.address, 100000);
        await secondMockToken.connect(seObject).approve(rewardPool.address, 100000 * 2);

        ownerTokenValueInThePool = await mockToken.allowance(owner.address, rewardPool.address);
        secondTokenValueInThePool = await mockToken.allowance(seObject.address, rewardPool. address);
        ownerSecondTokenValueInThePool = await secondMockToken.allowance(owner.address, rewardPool.address);
        secondObjectSecondTokenvalueInThePool = await secondMockToken.allowance(seObject.address, rewardPool.address);

        expect(secondTokenValueInThePool).to.be.eq(ownerTokenValueInThePool);
        expect(secondObjectSecondTokenvalueInThePool).to.be.eq(ownerSecondTokenValueInThePool);
        
        mockLpToken = ownerTokenValueInThePool / 2;
        secondMockLpToken = secondTokenValueInThePool / 2;

        await rewardPool.add(100, mockToken.address, true);
        await rewardPool.add(100, secondMockToken.address, true);

        await rewardPool.connect(owner).deposit(0, mockLpToken);
        await rewardPool.connect(owner).deposit(1, secondMockLpToken);
        await rewardPool.connect(seObject).deposit(0, mockLpToken);
        await rewardPool.connect(seObject).deposit(1, secondMockLpToken);

        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address);
        secondTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address);
        expect(acquiescentToken).to.be.eq(BigNumber.from(minitMockTokenOwnerOwn).sub(mockLpToken));
        expect(secondTokenAcquiescentToken).to.be.eq(BigNumber.from(minitSecondMockTokenOwnerOwn).sub(secondMockLpToken));

        secondAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        secondTokenAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        expect(secondAcquiescentToken).to.be.eq(BigNumber.from(minitMockTokenSeOwn).sub(mockLpToken));
        expect(secondTokenAcquiescentToken).to.be.eq(BigNumber.from(minitSecondMockTokenSeOwn).sub(secondMockLpToken));

        currentBlock = await time.latestBlock();
        await advanceBlockTo(parseInt(currentBlock) + 10);

        acquiescentToken = await fxs.connect(owner).balanceOf(owner.address);
        ownerPendingValue = await rewardPool.pending(0, owner.address);
        await rewardPool.deposit(0, 0);
        acquiescentToken = await fxs.connect(owner).balanceOf(owner.address);
        console.log("Only one pool pending:" + acquiescentToken);
        await rewardPool.deposit(1, 0);
        acquiescentToken = await fxs.connect(owner).balanceOf(owner.address);
        console.log("Two pools pending:" + acquiescentToken);
        ownerSecondPnedingValue = await rewardPool.pending(1, owner.address);
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);
        secondPendingValue = await rewardPool.pending(0, seObject.address);
        await rewardPool.deposit(0, 0);
        secondAcquiescentToken = await fxs.connect(seObject).balanceOf(seObject.address);
        console.log("Seobject only one pool pending:" + secondAcquiescentToken);
        secondSecondPendingValue = await rewardPool.pending(1, seObject.address);
        await rewardPool.deposit(1, 0);
        secondAcquiescentToken = await fxs.connect(seObject).balanceOf(seObject.address);
        console.log("Seobject two pools pending:" + secondAcquiescentToken);

        await rewardPool.connect(owner).withdraw(0, mockLpToken);
        await rewardPool.connect(owner).withdraw(1, secondMockLpToken);
        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address);
        secondTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address);
        expect(acquiescentToken).to.be.eq(minitMockTokenOwnerOwn);
        expect(secondTokenAcquiescentToken).to.be.eq(minitSecondMockTokenOwnerOwn);

        await rewardPool.connect(seObject).withdraw(0, mockLpToken);
        await rewardPool.connect(seObject).withdraw(1, secondMockLpToken);
        secondAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        secondTokenAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        expect(secondAcquiescentToken).to.be.eq(minitMockTokenSeOwn);
        expect(secondTokenAcquiescentToken).to.be.eq(minitSecondMockTokenSeOwn);
    });
});