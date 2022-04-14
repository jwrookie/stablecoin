const {time} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {artifacts} = require('hardhat');
const {toWei} = require('web3-utils');
const {BigNumber} = require('ethers');
const {expect} = require('chai');
const { parse } = require('path');
const { advanceBlockTo } = require('@openzeppelin/test-helpers/src/time');

contract('RewardPoolIntergration', () => {
    const RewardPoolModule = "RewardPool";
    const OperatableModule = "Operatable";
    const MockTokenModule = "MockToken";
    const TestOracleModule = 'TestOracle';
    const FXSModule = "FRAXShares";
    const FRAXModule = "FRAXStablecoin";
    const tempFxsName = "TemporaryStringName";
    const tempFxsSymbol = "TemporaryStringSymbol";
    const tempFraxName = "TemporaryMemoryName";
    const tempFraxSymbol = "TemporaryMemorySymbol";
    const mockTempName = "TemporaryMockName";
    const mockTempSymbol = "TemporaryMockSymbol";
    const mockDecimal = 18;
    const mockTotal = toWei("10");
    const authorBoolean = true;
    const authorNumber = 100000;
    const lpTokenNumber = 10000;
    const allocPoint = 100;
    const tokenPerBlock = 10000;
    const period = 100;

    let lastBlock;
    let currentBlock;
    var startBlock;
    var poolLength;

    async function checkInfo(infoNo1, infoNo2) {
        if(expect(infoNo1).to.be.eq(infoNo2)) {
            return true;
        }else {
            return false;
        }
    }

    beforeEach(async function() {
        [owner, seObject] = await ethers.getSigners();
        lastBlock = await time.latestBlock();
        startBlock = parseInt(lastBlock);

        const RewardPool = await ethers.getContractFactory(RewardPoolModule);
        const Operatable = await ethers.getContractFactory(OperatableModule);
        const MockToken = await ethers.getContractFactory(MockTokenModule);

        const Oracle = await ethers.getContractFactory(TestOracleModule);
        oracle = await Oracle.deploy();
        const FXS = await ethers.getContractFactory(FXSModule);
        fxs = await FXS.deploy(tempFxsName, tempFxsSymbol, oracle.address);

        const FRAX = await ethers.getContractFactory(FRAXModule);
        frax = await FRAX.deploy(tempFraxName, tempFraxSymbol);

        operatable = await Operatable.deploy();
        mockToken = await MockToken.deploy(mockTempName, mockTempSymbol, mockDecimal, mockTotal);
        secondMockToken = await MockToken.deploy(mockTempName, mockTempSymbol, mockDecimal, mockTotal);
        oracle = await Oracle.deploy();
        console.log("startBlock:" + startBlock);
        rewardPool = await RewardPool.deploy(operatable.address, fxs.address, tokenPerBlock, startBlock, period);

        poolLength = await rewardPool.poolLength();

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        await frax.addPool(rewardPool.address);
        await frax.addPool(owner.address);
    });

    it('Single user deposit and pending', async function() {
        var poolInfo;
        var structAllocPoint;
        var lastRewardBlock;
        var accTokenPerShare;
        var totalAmount;
        var userInfo;
        var secondUserInfo;

        var firstLastBlock;
        var secondLastBlock;
        var totalAllocPoint = 1;
        var mul;
        var amount;
        var rewardDebt;

        var tokenReward;
        var targetAmount;
        var pendingValue;
        var targetAccTokenPerShare;

        var firstLpTokenBalance = await mockToken.balanceOf(rewardPool.address);
        var targetLpTokenBalance;
        assert.equal(firstLpTokenBalance, 0);

        await mockToken.approve(rewardPool.address, authorNumber);
        await rewardPool.add(allocPoint, mockToken.address, authorBoolean);

        poolInfo = await rewardPool.poolInfo(poolLength);
        userInfo = await rewardPool.userInfo(0, owner.address);
        amount = userInfo[0];
        rewardDebt = userInfo[1];
        assert.equal(userInfo[0], 0);
        assert.equal(userInfo[1], 0);

        console.log("-=-" + await fxs.balanceOf(owner.address));

        await rewardPool.deposit(poolLength, lpTokenNumber);

        firstLastBlock = await time.latestBlock();
        console.log("firstTemp:" + firstLastBlock);

        await time.advanceBlockTo(parseInt(firstLastBlock) + 10);
        secondLastBlock = await time.latestBlock();
        console.log("second:" + secondLastBlock);
        assert.equal((secondLastBlock - firstLastBlock + 1), 11);

        mul = secondLastBlock - firstLastBlock;
        tokenReward = tokenPerBlock * mul * allocPoint / totalAllocPoint;

        targetLpTokenBalance = await mockToken.balanceOf(rewardPool.address);

        assert.equal(targetLpTokenBalance, lpTokenNumber);

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
        var userInfoAmount;
        var acquiescentToken;
        var startToken;
        var moveToken;
        var poolToken;
        var endToken;

        await mockToken.approve(rewardPool.address, authorNumber);
        await rewardPool.add(allocPoint, mockToken.address, authorBoolean);
        acquiescentToken = await mockToken.balanceOf(owner.address);

        await rewardPool.deposit(poolLength, lpTokenNumber);

        poolToken = await mockToken.balanceOf(rewardPool.address);

        startToken = await mockToken.balanceOf(owner.address);

        moveToken = await mockToken.balanceOf(owner.address);

        assert.equal(startToken, (acquiescentToken - lpTokenNumber));

        userInfoAmount = await rewardPool.userInfo(0, owner.address);
        var needAmount = userInfoAmount[0];

        await rewardPool.withdraw(poolLength, needAmount);

        moveToken = await mockToken.balanceOf(rewardPool.address);
        assert.equal(moveToken, 0);

        endToken = await mockToken.balanceOf(owner.address);
        assert.equal(acquiescentToken. endToken);
    });

    it('Single user and more pools', async function() {
        var secondAllocPoint = 2;
        var tempPoolLength = 2;
        var firstLpToken;
        var secondLpToken;
        var firstLpTokenReward;
        var secondLpTokenReward;
        var firstUserInfo;
        var secondUserInfo;
        var firstUserInfoAmount;
        var secondUserInfoAmount;
        var firstLpPoolToken;
        var secondLpPoolToken;
        var acquiescentToken;
        var seAcquiescentToken;
        var pendingValue;
        var secondPendingValue;
        var needBoolean;

        await mockToken.approve(rewardPool.address, authorNumber);
        await secondMockToken.approve(rewardPool.address, authorNumber);

        await rewardPool.add(allocPoint, mockToken.address, authorBoolean);
        await rewardPool.add(secondAllocPoint, secondMockToken.address, authorBoolean);
        poolLength = await rewardPool.poolLength();
        assert.equal(poolLength, tempPoolLength);

        firstLpToken = await mockToken.balanceOf(rewardPool.address);
        secondLpToken = await mockToken.balanceOf(rewardPool.address);
        assert.equal(firstLpToken, 0);
        assert.equal(secondLpToken, 0);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        seAcquiescentToken = await secondMockToken.balanceOf(owner.address);

        expect(acquiescentToken).to.be.eq(seAcquiescentToken);

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

        await rewardPool.deposit(0, lpTokenNumber);
        await rewardPool.deposit(1, lpTokenNumber);

        firstUserInfo = await rewardPool.userInfo(0, owner.address);
        firstUserInfoAmount = firstUserInfo[0];
        expect(firstUserInfoAmount).to.be.eq(lpTokenNumber);

        firstLpTokenReward = firstUserInfo[1];
        expect(firstLpTokenReward).to.be.eq(0);
        secondUserInfo = await rewardPool.userInfo(1, owner.address);
        secondUserInfoAmount = secondUserInfo[0];
        expect(secondUserInfoAmount).to.be.eq(lpTokenNumber);
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
        needBoolean = checkInfo(firstUserInfoAmount, secondUserInfoAmount);
        console.log(needBoolean);
    });

    it('More users and single pool', async function() {
        var acquiescentToken;
        var seAcquiescentToken;
        var ownerFxsValue;
        var ownerPandingValue;
        var ownerUserInfo;
        var ownerUserInfoAmount;
        var seObjectFxsValue;
        var seObjectPendingValue;
        var seObejctUserInfo;
        var seObejctUserInfoAmount;
        var currentBlock;

        acquiescentToken = await mockToken.balanceOf(owner.address);

        await mockToken.mint(seObject.address, acquiescentToken);
        seAcquiescentToken = await mockToken.balanceOf(seObject.address);
        console.log(checkInfo(seAcquiescentToken, acquiescentToken));
        
        await mockToken.approve(rewardPool.address, authorNumber);
        await mockToken.connect(seObject).approve(rewardPool.address, authorNumber);

        await rewardPool.add(allocPoint, mockToken.address, authorBoolean);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        seAcquiescentToken = await mockToken.balanceOf(seObject.address);
        console.log(checkInfo(acquiescentToken, seAcquiescentToken));

        await rewardPool.connect(owner).deposit(0, lpTokenNumber);
        await rewardPool.connect(seObject).deposit(0, lpTokenNumber);
        acquiescentToken = await mockToken.balanceOf(owner.address);
        seAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(acquiescentToken).to.be.eq(seAcquiescentToken);

        ownerFxsValue = await fxs.connect(owner).balanceOf(rewardPool.address);

        seObjectFxsValue = await fxs.connect(seObject).balanceOf(rewardPool.address);

        expect(seObjectFxsValue).to.be.eq(ownerFxsValue);

        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        ownerPandingValue = await rewardPool.pending(0, owner.address);

        seObjectPendingValue = await rewardPool.pending(0, seObject.address);
        expect(ownerPandingValue/seObjectPendingValue).to.be.eq(3);

        ownerUserInfo = await rewardPool.userInfo(0, owner.address);
        ownerUserInfoAmount = ownerUserInfo[0];

        seObejctUserInfo = await rewardPool.userInfo(0, seObject.address);
        seObejctUserInfoAmount = seObejctUserInfo[0];

        expect(ownerUserInfoAmount).to.be.eq(seObejctUserInfoAmount);

        await rewardPool.connect(owner).withdraw(0, ownerUserInfoAmount);
        acquiescentToken = await mockToken.balanceOf(owner.address);

        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        await rewardPool.connect(seObject).withdraw(0, seObejctUserInfoAmount);
        seAcquiescentToken = await mockToken.balanceOf(seObject.address);

        expect(acquiescentToken).to.be.eq(seAcquiescentToken);
    });

    it('More users and single pool different init value', async function() {
        let minitOwnerTokenOwn;
        let minitSeTokenOwn;
        var acquiescentToken;
        var seAcquiescentToken;
        var ownerPandingValue;
        var ownerFxsValue;
        var ownerUserInfo;
        var ownerUserInfoAmount;
        var seObjectFxsValue;
        var seObejctUserInfo;
        var seObejctUserInfoAmount;
        var currentBlock;
        var ownerLpTokenValue = 10000;
        var seObjectLpTokenValue = 20000;

        acquiescentToken = await mockToken.balanceOf(owner.address);
        minitOwnerTokenOwn = acquiescentToken;

        await mockToken.mint(seObject.address, acquiescentToken);
        seAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(seAcquiescentToken).to.be.eq(acquiescentToken);
        minitSeTokenOwn = seAcquiescentToken;

        await mockToken.connect(owner).approve(rewardPool.address, authorNumber);
        await mockToken.connect(seObject).approve(rewardPool.address, authorNumber);

        await rewardPool.add(allocPoint, mockToken.address, authorBoolean);

        await rewardPool.connect(owner).deposit(0, ownerLpTokenValue);
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        ownerPandingValue = await rewardPool.pending(0, owner.address);
        ownerFxsValue = await fxs.connect(owner).balanceOf(owner.address);
        await rewardPool.connect(seObject).deposit(0, seObjectLpTokenValue);
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);

        ownerPandingValue = await rewardPool.pending(0, seObject.address);

        seObjectFxsValue = await fxs.connect(seObject).balanceOf(owner.address);

        expect(seObjectFxsValue).to.be.eq(ownerFxsValue);

        await rewardPool.connect(owner).deposit(0, 0);
        await rewardPool.connect(seObject).deposit(0, 0);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        seAcquiescentToken = await mockToken.balanceOf(seObject.address);

        ownerUserInfo = await rewardPool.userInfo(0, owner.address);
        ownerUserInfoAmount = ownerUserInfo[0];

        seObejctUserInfo = await rewardPool.userInfo(0, seObject.address);
        seObejctUserInfoAmount = seObejctUserInfo[0];

        expect(seObejctUserInfoAmount - ownerUserInfoAmount).to.be.eq(seObjectLpTokenValue - ownerLpTokenValue);

        await rewardPool.connect(owner).withdraw(0, ownerUserInfoAmount);

        acquiescentToken = await mockToken.balanceOf(owner.address);
        expect(acquiescentToken).to.be.eq(minitOwnerTokenOwn);

        await rewardPool.connect(seObject).withdraw(0, seObejctUserInfoAmount);

        seAcquiescentToken = await mockToken.balanceOf(seObject.address);
        expect(seAcquiescentToken).to.be.eq(minitSeTokenOwn);
    });

    it('More users and more pools', async function() {
        var minitMockTokenOwnerOwn;
        var minitSeMockTokenOwnerOwn;
        var minitMockTokenSeOwn;
        var minitSeMockTokenSeOwn;
        var acquiescentToken;
        var seTokenAcquiescentToken;
        var seAcquiescentToken;
        var seTokenSeAcquiescentToken;
        var ownerTokenValueInThePool;
        var ownerSeTokenValueInThePool;
        var ownerPendingValue;
        var ownerSePnedingValue;
        var seTokenValueInThePool;
        var seSeTokenvalueInThePool;
        var sePendingValue;
        var seSePendingValue;
        var currentBlock;
        var mockLpToken;
        var seMockLpToken;
        
        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address);
        minitMockTokenOwnerOwn = acquiescentToken;
        seTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address);
        minitSeMockTokenOwnerOwn = seTokenAcquiescentToken;

        await mockToken.mint(seObject.address, minitMockTokenOwnerOwn);
        seAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        minitMockTokenSeOwn = seAcquiescentToken;
        await secondMockToken.mint(seObject.address, minitSeMockTokenOwnerOwn);
        seTokenSeAcquiescentToken = await secondMockToken.connect(seObject).balanceOf(seObject.address);
        minitSeMockTokenSeOwn = seTokenSeAcquiescentToken;

        expect(minitMockTokenSeOwn).to.be.eq(minitMockTokenOwnerOwn);
        expect(minitSeMockTokenSeOwn).to.be.eq(minitSeMockTokenOwnerOwn);

        await mockToken.connect(owner).approve(rewardPool.address, authorNumber);
        await secondMockToken.connect(owner).approve(rewardPool.address, authorNumber * 2);

        await mockToken.connect(seObject).approve(rewardPool.address, authorNumber);
        await secondMockToken.connect(seObject).approve(rewardPool.address, authorNumber * 2);

        ownerTokenValueInThePool = await mockToken.allowance(owner.address, rewardPool.address);
        seTokenValueInThePool = await mockToken.allowance(seObject.address, rewardPool. address);
        ownerSeTokenValueInThePool = await secondMockToken.allowance(owner.address, rewardPool.address);
        seSeTokenvalueInThePool = await secondMockToken.allowance(seObject.address, rewardPool.address);

        expect(seTokenValueInThePool).to.be.eq(ownerTokenValueInThePool);
        expect(seSeTokenvalueInThePool).to.be.eq(ownerSeTokenValueInThePool);
        
        mockLpToken = ownerTokenValueInThePool / 2;
        seMockLpToken = seTokenValueInThePool / 2;

        await rewardPool.add(allocPoint, mockToken.address, authorBoolean);
        await rewardPool.add(allocPoint, secondMockToken.address, authorBoolean);

        await rewardPool.connect(owner).deposit(0, mockLpToken);
        await rewardPool.connect(owner).deposit(1, seMockLpToken);
        await rewardPool.connect(seObject).deposit(0, mockLpToken);
        await rewardPool.connect(seObject).deposit(1, seMockLpToken);

        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address);
        seTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address);
        expect(acquiescentToken).to.be.eq(BigNumber.from(minitMockTokenOwnerOwn).sub(mockLpToken));
        expect(seTokenAcquiescentToken).to.be.eq(BigNumber.from(minitSeMockTokenOwnerOwn).sub(seMockLpToken));

        seAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        seTokenAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        expect(seAcquiescentToken).to.be.eq(BigNumber.from(minitMockTokenSeOwn).sub(mockLpToken));
        expect(seTokenAcquiescentToken).to.be.eq(BigNumber.from(minitSeMockTokenSeOwn).sub(seMockLpToken));

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
        ownerSePnedingValue = await rewardPool.pending(1, owner.address);
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 1);
        sePendingValue = await rewardPool.pending(0, seObject.address);
        await rewardPool.deposit(0, 0);
        seAcquiescentToken = await fxs.connect(seObject).balanceOf(seObject.address);
        console.log("Seobject only one pool pending:" + seAcquiescentToken);
        seSePendingValue = await rewardPool.pending(1, seObject.address);
        await rewardPool.deposit(1, 0);
        seAcquiescentToken = await fxs.connect(seObject).balanceOf(seObject.address);
        console.log("Seobject two pools pending:" + seAcquiescentToken);

        await rewardPool.connect(owner).withdraw(0, mockLpToken);
        await rewardPool.connect(owner).withdraw(1, seMockLpToken);
        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address);
        seTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address);
        expect(acquiescentToken).to.be.eq(minitMockTokenOwnerOwn);
        expect(seTokenAcquiescentToken).to.be.eq(minitSeMockTokenOwnerOwn);

        await rewardPool.connect(seObject).withdraw(0, mockLpToken);
        await rewardPool.connect(seObject).withdraw(1, seMockLpToken);
        seAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        seTokenAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address);
        expect(seAcquiescentToken).to.be.eq(minitMockTokenSeOwn);
        expect(seTokenAcquiescentToken).to.be.eq(minitSeMockTokenSeOwn);
    });
});