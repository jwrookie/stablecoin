/**
 * @description: This is a test case about contract RewardPool intergration
 * @author: Lucifer
 */
/** Introducing external modules */
const {time} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {artifacts} = require('hardhat');
const {toWei} = require('web3-utils');
const {BigNumber} = require('ethers');
const {expect} = require('chai');
const { parse } = require('path');
/** Introducing local modules */
// const RewardPool = artifacts.require('./contracts/dao/RewardPool.sol');
// const MockToken = artifacts.require('./contracts/mock/MockToken.sol');
// const Operatable = artifacts.require('./contracts/tools/Operatable.sol');
// const Oracle = artifacts.require('./contracts/mock/TestOracle.sol');
// const FXS = artifacts.require('./contracts/token/FXS/FXS.sol');

contract('RewardPoolIntergration', () => {
    // Some module name
    let RewardPoolModule = "RewardPool";
    let OperatableModule = "Operatable";
    let MockTokenModule = "MockToken";
    let TestOracleModule = 'TestOracle';
    let FXSModule = "FRAXShares";
    let FRAXModule = "FRAXStablecoin";
    let lastBlock

    // Declare some variables
    var startBlock
    var tempFxsName = "TemporaryStringName";
    var tempFxsSymbol = "TemporaryStringSymbol";
    var tempFraxName = "TemporaryMemoryName";
    var tempFraxSymbol = "TemporaryMemorySymbol";
    var mockTempName = "TemporaryMockName";
    var mockTempSymbol = "TemporaryMockSymbol";
    var mockDecimal = 18;
    var mockTotal = toWei("10");
    var poolLength

    // Declare public variable
    var authorBoolean = true
    var authorNumber = 100000
    var lpTokenNumber = 10000
    var allocPoint = 1

    // About reward pool instantiation
    var tokenPerBlock = 10000;
    var period = 100;
    
    /**
     * @description: This is a function to check two informations
     * @param {struct} infoNo1 
     * @param {struct} infoNo2 
     * @returns 
     */
    async function checkInfo(infoNo1, infoNo2) {
        if(expect(infoNo1).to.be.eq(infoNo2)) {
            return true
        }else {
            return false
        }
    }

    /**
     * @description: Get the lastes block
     * @returns The last block
     */
    async function getCurrentBlock() {
        return await time.latestBlock()
    }

    /**
     * @description: Move block
     * @param {time} blockNumber 
     * @param {number} moveBlock 
     */
    async function moveBlock(blockNumber, moveBlock) {
        await time.advanceBlockTo(parseInt(blockNumber) + moveBlock)
    }

    beforeEach(async function() {
        [owner, seObject] = await ethers.getSigners();
        // This function must asynchronous
        lastBlock = await time.latestBlock();
        startBlock = parseInt(lastBlock);

        /** Introducing local modules */
        const RewardPool = await ethers.getContractFactory(RewardPoolModule);
        const Operatable = await ethers.getContractFactory(OperatableModule);
        // Introducing mock token to approve
        const MockToken = await ethers.getContractFactory(MockTokenModule);

        // Instantiation contract oracle
        const Oracle = await ethers.getContractFactory(TestOracleModule);
        oracle = await Oracle.deploy();
        // Instantiation contract FXS need oracle
        const FXS = await ethers.getContractFactory(FXSModule);
        fxs = await FXS.deploy(tempFxsName, tempFxsSymbol, oracle.address);

        const FRAX = await ethers.getContractFactory(FRAXModule);
        frax = await FRAX.deploy(tempFraxName, tempFraxSymbol);

        // Instantiation some objects what we need
        operatable = await Operatable.deploy();
        mockToken = await MockToken.deploy(mockTempName, mockTempSymbol, mockDecimal, mockTotal);
        // Deploy another token
        secondMockToken = await MockToken.deploy(mockTempName, mockTempSymbol, mockDecimal, mockTotal);
        oracle = await Oracle.deploy();
        console.log("startBlock:" + startBlock);
        rewardPool = await RewardPool.deploy(operatable.address, fxs.address, tokenPerBlock, startBlock, period);

        // Set some variable value
        poolLength = await rewardPool.poolLength()

        // Set some values to wait for the event to fire
        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        // Create two pools
        await frax.addPool(rewardPool.address);
        await frax.addPool(owner.address);
    });

    it('Single user deposit and pending', async function() {
        var poolInfo
        var structAllocPoint
        var lastRewardBlock
        var accTokenPerShare
        var totalAmount
        var userInfo
        var secondUserInfo

        // About pending
        var firstLastBlock
        var secondLastBlock
        var totalAllocPoint = 1
        var mul
        var amount
        var rewardDebt

        // Target value
        var tokenReward
        var targetAmount
        var pendingValue
        var targetAccTokenPerShare

        // The first coin in the pool
        var firstLpTokenBalance = await mockToken.balanceOf(rewardPool.address)
        var targetLpTokenBalance
        assert.equal(firstLpTokenBalance, 0)

        // First need to grant permissions to pools
        await mockToken.approve(rewardPool.address, authorNumber)
        // Add lp token
        await rewardPool.add(allocPoint, mockToken.address, authorBoolean)

        // poolInfo = await rewardPool.poolInfo(poolLength)
        // var total = await poolInfo[2]

        poolInfo = await rewardPool.poolInfo(poolLength)
        // If you only call add function user info is 0 0
        userInfo = await rewardPool.userInfo(0, owner.address)
        amount = userInfo[0]
        rewardDebt = userInfo[1]
        assert.equal(userInfo[0], 0)
        assert.equal(userInfo[1], 0)

        // console.log(userInfo[0])
        // console.log(userInfo[1])
        // console.log("==========")

        console.log("-=-" + await fxs.balanceOf(owner.address))

        // Call deposit function add a token which parameters are pid and lp token
        await rewardPool.deposit(poolLength, lpTokenNumber)

        // Written function pending calculation method
        firstLastBlock = await time.latestBlock()
        console.log("firstTemp:" + firstLastBlock)

        // Record the latest block for the first time
        await time.advanceBlockTo(parseInt(firstLastBlock) + 10)
        secondLastBlock = await time.latestBlock()
        console.log("second:" + secondLastBlock)
        assert.equal((secondLastBlock - firstLastBlock + 1), 11)

        // You need to evaluate the result before calling pending
        /** Because user amount > 0 so we need to check first "if" */
        mul = secondLastBlock - firstLastBlock
        tokenReward = tokenPerBlock * mul * allocPoint / totalAllocPoint

        targetLpTokenBalance = await mockToken.balanceOf(rewardPool.address)

        assert.equal(targetLpTokenBalance, lpTokenNumber)

        // Call balanceOf function to get the number of mock token in the pool
        accTokenPerShare = tokenReward * 1e12 / targetLpTokenBalance

        // Second time to 
        userInfo = await rewardPool.userInfo(0, owner.address)
        amount = userInfo[0]

        console.log("-=-")
        console.log(amount)

        targetAmount = amount * accTokenPerShare / 1e12 - rewardDebt

        console.log("-=-")
        console.log(targetAmount)

        // Call pending
        pendingValue = await rewardPool.pending(0, owner.address)
        expect(pendingValue).to.be.not.eq(0)

        poolInfo = await rewardPool.poolInfo(poolLength)
        structAllocPoint = await rewardPool.poolInfo[1]
        lastRewardBlock = await rewardPool.poolInfo[2]
        accTokenPerShare = await rewardPool.poolInfo[3]
        totalAmount = await rewardPool.poolInfo[4]

        // poolInfo = await rewardPool.poolInfo(poolLength)

        secondUserInfo = await rewardPool.userInfo(0, owner.address)

        // Get user information
        targetAccTokenPerShare = secondUserInfo[0]

        console.log("-=-")
        console.log(targetAccTokenPerShare)

        // Get pending
        await rewardPool.deposit(0, 0)

        console.log(await fxs.balanceOf(owner.address))
    });

    it('Single user deposit and pending and withdraw', async function() {
        var userInfoAmount
        var acquiescentToken
        var startToken
        var moveToken
        var poolToken
        var endToken

        // First need to grant permissions to pools
        await mockToken.approve(rewardPool.address, authorNumber)
        // Add lp token
        await rewardPool.add(allocPoint, mockToken.address, authorBoolean)
        // We need to check how much token the user own
        acquiescentToken = await mockToken.balanceOf(owner.address)

        // Deposit tokens into the pool
        await rewardPool.deposit(poolLength, lpTokenNumber)

        // Chek out the token in the pool
        poolToken = await mockToken.balanceOf(rewardPool.address)

        startToken = await mockToken.balanceOf(owner.address)
        // Check out the token of user
        moveToken = await mockToken.balanceOf(owner.address)

        assert.equal(startToken, (acquiescentToken - lpTokenNumber))

        userInfoAmount = await rewardPool.userInfo(0, owner.address)
        var needAmount = userInfoAmount[0]

        console.log("-=-" + userInfoAmount)
        // Call withdraw function
        await rewardPool.withdraw(poolLength, needAmount)

        // Check out the token in the pool
        moveToken = await mockToken.balanceOf(rewardPool.address)
        assert.equal(moveToken, 0)

        endToken = await mockToken.balanceOf(owner.address)
        assert.equal(acquiescentToken. endToken)
    });

    it('Single user and more pools', async function() {
        // Declare local variable
        var secondAllocPoint = 2
        var tempPoolLength = 2
        var firstLpToken
        var secondLpToken
        var firstLpTokenReward
        var secondLpTokenReward
        var firstUserInfo
        var secondUserInfo // How much amount user own
        var firstUserInfoAmount
        var secondUserInfoAmount
        var firstLpPoolToken
        var secondLpPoolToken
        var acquiescentToken
        var seAcquiescentToken
        var pendingValue
        var secondPendingValue
        var currentTime
        var needBoolean

        // Two kind of authorization token
        await mockToken.approve(rewardPool.address, authorNumber)
        await secondMockToken.approve(rewardPool.address, authorNumber)

        // Add lp token
        await rewardPool.add(allocPoint, mockToken.address, authorBoolean)
        await rewardPool.add(secondAllocPoint, secondMockToken.address, authorBoolean)
        poolLength = await rewardPool.poolLength()
        assert.equal(poolLength, tempPoolLength)

        // Get the token in the pool
        firstLpToken = await mockToken.balanceOf(rewardPool.address)
        secondLpToken = await mockToken.balanceOf(rewardPool.address)
        assert.equal(firstLpToken, 0)
        assert.equal(secondLpToken, 0)

        // We need to check how much token the user own
        acquiescentToken = await mockToken.balanceOf(owner.address)
        seAcquiescentToken = await secondMockToken.balanceOf(owner.address)

        // Use expect to assertion results
        expect(acquiescentToken).to.be.eq(seAcquiescentToken); // assert.equal(acquiescentToken, seAcquiescentToken)

        // Check the token in the pool
        firstLpPoolToken = await mockToken.balanceOf(rewardPool.address)
        secondLpPoolToken = await mockToken.balanceOf(rewardPool.address)

        // Expect to assertion results
        expect(firstLpPoolToken).to.be.eq(secondLpPoolToken)

        // Get user information
        firstUserInfo = await rewardPool.userInfo(0, owner.address)
        firstUserInfoAmount = firstUserInfo[0]
        firstLpTokenReward = firstUserInfo[1] // At that time no pending
        expect(firstLpTokenReward).to.be.eq(0)
        secondUserInfo = await rewardPool.userInfo(1, owner.address)
        secondUserInfoAmount = secondUserInfo[0]
        secondLpTokenReward = secondUserInfo[1]
        expect(secondLpTokenReward).to.be.eq(0)

        // Start to deposit token into pool ---> pid, amount
        await rewardPool.deposit(0, lpTokenNumber)
        await rewardPool.deposit(1, lpTokenNumber)

        // Check user info
        firstUserInfo = await rewardPool.userInfo(0, owner.address)
        firstUserInfoAmount = firstUserInfo[0]
        expect(firstUserInfoAmount).to.be.eq(lpTokenNumber)
        // Get user reward
        firstLpTokenReward = firstUserInfo[1]
        expect(firstLpTokenReward).to.be.eq(0)
        secondUserInfo = await rewardPool.userInfo(1, owner.address)
        secondUserInfoAmount = secondUserInfo[0]
        expect(secondUserInfoAmount).to.be.eq(lpTokenNumber)
        secondLpTokenReward = secondUserInfo[1]
        expect(secondLpTokenReward).to.be.eq(0)

        // Call function pending
        pendingValue = await rewardPool.pending(0, owner.address)
        // If pending value not equal zero that mean call the function pending successful
        expect(pendingValue).to.be.not.eq(0)
        /** Wait a moment */
        // Get the current time
        currentTime = await time.latestBlock()
        // Wait a block
        await time.advanceBlockTo(parseInt(currentTime) + 1)
        // At that time secondPendingValue is twice as much as pendingValue
        secondPendingValue = await rewardPool.pending(1, owner.address)
        expect(secondPendingValue/pendingValue).to.be.eq(2)
        // Check user info
        firstUserInfo = await rewardPool.userInfo(0, owner.address)
        firstUserInfoAmount = firstUserInfo[0]
        secondUserInfo = await rewardPool.userInfo(1, owner.address)
        secondUserInfoAmount = secondUserInfo[0]
        // User information is equal
        needBoolean = checkInfo(firstUserInfoAmount, secondUserInfoAmount)
        // Console should be true
        console.log(needBoolean)
    });

    it('More users and single pool', async function() {
        /** There is only one variable we need to control */
        var acquiescentToken
        var seAcquiescentToken
        var ownerPandingValue
        var ownerUserInfo
        var ownerUserInfoAmount
        var seObjectPendingValue
        var seObejctUserInfo
        var seObejctUserInfoAmount
        var currentBlock

        acquiescentToken = await mockToken.balanceOf(owner.address)

        // The first time you need to mint coins for the user
        await mockToken.mint(seObject.address, acquiescentToken)
        seAcquiescentToken = await mockToken.balanceOf(seObject.address)
        console.log(checkInfo(seAcquiescentToken, acquiescentToken))
        
        // Authorization token by owner.address
        await mockToken.approve(rewardPool.address, authorNumber)
        await mockToken.connect(seObject).approve(rewardPool.address, authorNumber)

        await rewardPool.add(allocPoint, mockToken.address, authorBoolean)

        // Check how much token the user own
        acquiescentToken = await mockToken.balanceOf(owner.address)
        seAcquiescentToken = await mockToken.balanceOf(seObject.address)
        console.log(checkInfo(acquiescentToken, seAcquiescentToken))

        await rewardPool.connect(owner).deposit(0, lpTokenNumber)
        await rewardPool.connect(seObject).deposit(0, lpTokenNumber)
        acquiescentToken = await mockToken.balanceOf(owner.address)
        seAcquiescentToken = await mockToken.balanceOf(seObject.address)
        // When two users deposit the same number of tokens into the same pool, the remaining results are the same
        expect(acquiescentToken).to.be.eq(seAcquiescentToken)

        // At the same time to call pending
        ownerPandingValue = await rewardPool.pending(0, owner.address)
        // Wait a moment
        currentBlock = await time.latestBlock()
        await time.advanceBlockTo(parseInt(currentBlock) + 1)

        // Get second user pending
        seObjectPendingValue = await rewardPool.pending(0, seObject.address)
        expect(ownerPandingValue/seObjectPendingValue).to.be.eq(2)

        // Get owner amount
        ownerUserInfo = await rewardPool.userInfo(0, owner.address)
        ownerUserInfoAmount = ownerUserInfo[0]

        // Get seObject amount
        seObejctUserInfo = await rewardPool.userInfo(0, seObject.address)
        seObejctUserInfoAmount = seObejctUserInfo[0]

        // The amount value for both users should be equal
        expect(ownerUserInfoAmount).to.be.eq(seObejctUserInfoAmount)

        // Call the function withdraw
        await rewardPool.connect(owner).withdraw(0, ownerUserInfoAmount)
        acquiescentToken = await mockToken.balanceOf(owner.address)

        // Wait a moment
        currentBlock = await time.latestBlock()
        await time.advanceBlockTo(parseInt(currentBlock) + 1)

        // Call the function withdraw
        await rewardPool.connect(seObject).withdraw(0, seObejctUserInfoAmount)
        seAcquiescentToken = await mockToken.balanceOf(seObject.address)

        // The own value for both users should be equal
        expect(acquiescentToken).to.be.eq(seAcquiescentToken)
    });

    it('More users and single pool different init value', async function() {
        /** There is only one variable we need to control */
        let minitOwnerTokenOwn
        let minitSeTokenOwn
        var acquiescentToken
        var seAcquiescentToken
        var ownerPandingValue
        var ownerUserInfo
        var ownerUserInfoAmount
        var seObjectPendingValue
        var seObejctUserInfo
        var seObejctUserInfoAmount
        var currentBlock
        var ownerLpTokenValue = 10000
        var seObjectLpTokenValue = 20000

        acquiescentToken = await mockToken.balanceOf(owner.address)
        minitOwnerTokenOwn = acquiescentToken

        // The first time you need to mint coins for the user
        await mockToken.mint(seObject.address, acquiescentToken)
        // Get second object own
        seAcquiescentToken = await mockToken.balanceOf(seObject.address)
        expect(seAcquiescentToken).to.be.eq(acquiescentToken)
        minitSeTokenOwn = seAcquiescentToken

        // Authorization token by owner.address
        await mockToken.connect(owner).approve(rewardPool.address, authorNumber)
        // Authorization token by seObject.address
        await mockToken.connect(seObject).approve(rewardPool.address, authorNumber)

        // Add the same pool
        await rewardPool.add(allocPoint, mockToken.address, authorBoolean)

        // Deposit different values
        await rewardPool.connect(owner).deposit(0, ownerLpTokenValue)
        currentBlock = await time.latestBlock()
        await time.advanceBlockTo(parseInt(currentBlock) + 1)

        // Owner get pending
        ownerPandingValue = await rewardPool.pending(0, owner.address)
        await rewardPool.connect(seObject).deposit(0, seObjectLpTokenValue)

        // Get owner token own
        acquiescentToken = await mockToken.balanceOf(owner.address)
        seAcquiescentToken = await mockToken.balanceOf(seObject.address)

        // console.log(acquiescentToken)
        // console.log(seAcquiescentToken)

        // Do the difference accuracy problem
        // expect(acquiescentToken - seAcquiescentToken).to.be.eq(BigNumber.from(seObjectLpTokenValue).sub(ownerLpTokenValue))

        // Wait a moment
        currentBlock = await time.latestBlock()
        await time.advanceBlockTo(parseInt(currentBlock) + 1)
        seObjectPendingValue = await rewardPool.pending(0, seObject.address)
        expect(seObjectPendingValue).to.be.not.eq(ownerPandingValue)

        // Get owner info
        ownerUserInfo = await rewardPool.userInfo(0, owner.address)
        ownerUserInfoAmount = ownerUserInfo[0]

        // Get seObject user info
        seObejctUserInfo = await rewardPool.userInfo(0, seObject.address)
        seObejctUserInfoAmount = seObejctUserInfo[0]

        expect(seObejctUserInfoAmount - ownerUserInfoAmount).to.be.eq(seObjectLpTokenValue - ownerLpTokenValue)

        // Call the function withdraw
        await rewardPool.connect(owner).withdraw(0, ownerUserInfoAmount)

        // Check owner own
        acquiescentToken = await mockToken.balanceOf(owner.address)
        expect(acquiescentToken).to.be.eq(minitOwnerTokenOwn)

        // Call the function withdraw
        await rewardPool.connect(seObject).withdraw(0, seObejctUserInfoAmount)

        //Check seObject own
        seAcquiescentToken = await mockToken.balanceOf(seObject.address)
        expect(seAcquiescentToken).to.be.eq(minitSeTokenOwn)
    });

    it('More users and more pools', async function() {
        var minitMockTokenOwnerOwn
        var minitSeMockTokenOwnerOwn
        var minitMockTokenSeOwn
        var minitSeMockTokenSeOwn
        var acquiescentToken
        var seTokenAcquiescentToken
        var seAcquiescentToken
        var seTokenSeAcquiescentToken
        var ownerTokenValueInThePool
        var ownerSeTokenValueInThePool
        var ownerPendingValue
        var ownerSePnedingValue
        var seTokenValueInThePool
        var seSeTokenvalueInThePool
        var sePendingValue
        var seSePendingValue
        var currentBlock
        var mockLpToken
        var seMockLpToken
        
        // Check how much coins owner own
        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address)
        minitMockTokenOwnerOwn = acquiescentToken
        seTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address)
        minitSeMockTokenOwnerOwn = seTokenAcquiescentToken

        // The first time you need to mint coins for the user
        await mockToken.mint(seObject.address, minitMockTokenOwnerOwn)
        seAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address)
        minitMockTokenSeOwn = seAcquiescentToken
        await secondMockToken.mint(seObject.address, minitSeMockTokenOwnerOwn)
        seTokenSeAcquiescentToken = await secondMockToken.connect(seObject).balanceOf(seObject.address)
        minitSeMockTokenSeOwn = seTokenSeAcquiescentToken

        // Check that they are equal
        expect(minitMockTokenSeOwn).to.be.eq(minitMockTokenOwnerOwn)
        expect(minitSeMockTokenSeOwn).to.be.eq(minitSeMockTokenOwnerOwn)

        // Authorization token by owner.address
        await mockToken.connect(owner).approve(rewardPool.address, authorNumber)
        await secondMockToken.connect(owner).approve(rewardPool.address, authorNumber * 2)

        // Authorization token by seObject.address
        await mockToken.connect(seObject).approve(rewardPool.address, authorNumber)
        await secondMockToken.connect(seObject).approve(rewardPool.address, authorNumber * 2)

        // Obtain the number of corresponding authorization tokens in the pool
        ownerTokenValueInThePool = await mockToken.allowance(owner.address, rewardPool.address)
        seTokenValueInThePool = await mockToken.allowance(seObject.address, rewardPool. address)
        ownerSeTokenValueInThePool = await secondMockToken.allowance(owner.address, rewardPool.address)
        seSeTokenvalueInThePool = await secondMockToken.allowance(seObject.address, rewardPool.address)

        expect(seTokenValueInThePool).to.be.eq(ownerTokenValueInThePool)
        expect(seSeTokenvalueInThePool).to.be.eq(ownerSeTokenValueInThePool)
        
        mockLpToken = ownerTokenValueInThePool / 2
        seMockLpToken = seTokenValueInThePool / 2

        // Call the function add
        await rewardPool.add(allocPoint, mockToken.address, authorBoolean)
        await rewardPool.add(allocPoint, secondMockToken.address, authorBoolean)

        // Call the function pending by owner
        await rewardPool.connect(owner).deposit(0, mockLpToken)
        await rewardPool.connect(owner).deposit(1, seMockLpToken)
        await rewardPool.connect(seObject).deposit(0, mockLpToken)
        await rewardPool.connect(seObject).deposit(1, seMockLpToken)

        // Check the token in owner
        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address)
        seTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address)
        expect(acquiescentToken).to.be.eq(BigNumber.from(minitMockTokenOwnerOwn).sub(mockLpToken))
        expect(seTokenAcquiescentToken).to.be.eq(BigNumber.from(minitSeMockTokenOwnerOwn).sub(seMockLpToken))

        // Check the token in seObject
        seAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address)
        seTokenAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address)
        expect(seAcquiescentToken).to.be.eq(BigNumber.from(minitMockTokenSeOwn).sub(mockLpToken))
        expect(seTokenAcquiescentToken).to.be.eq(BigNumber.from(minitSeMockTokenSeOwn).sub(seMockLpToken))

        // Call the function pending
        ownerPendingValue = await rewardPool.pending(0, owner.address)
        // console.log(ownerPendingValue)
        // currentBlock = getCurrentBlock()
        // console.log(parseInt(currentBlock))
        // moveBlock(currentBlock, 100)
        ownerSePnedingValue = await rewardPool.pending(1, owner.address)
        // Wait a moment
        currentBlock = await time.latestBlock()
        await time.advanceBlockTo(parseInt(currentBlock) + 1)
        sePendingValue = await rewardPool.pending(0, seObject.address)
        seSePendingValue = await rewardPool.pending(1, seObject.address)

        // Call the function withdraw by owner.address
        await rewardPool.connect(owner).withdraw(0, mockLpToken)
        await rewardPool.connect(owner).withdraw(1, seMockLpToken)
        // Chek the token in owner
        acquiescentToken = await mockToken.connect(owner).balanceOf(owner.address)
        seTokenAcquiescentToken = await secondMockToken.connect(owner).balanceOf(owner.address)
        expect(acquiescentToken).to.be.eq(minitMockTokenOwnerOwn)
        expect(seTokenAcquiescentToken).to.be.eq(minitSeMockTokenOwnerOwn)

        // Call the function withdraw by seObject.address
        await rewardPool.connect(seObject).withdraw(0, mockLpToken)
        await rewardPool.connect(seObject).withdraw(1, seMockLpToken)
        // Chekck the token in seObject
        seAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address)
        seTokenAcquiescentToken = await mockToken.connect(seObject).balanceOf(seObject.address)
        expect(seAcquiescentToken).to.be.eq(minitMockTokenSeOwn)
        expect(seTokenAcquiescentToken).to.be.eq(minitSeMockTokenSeOwn)
    });
});