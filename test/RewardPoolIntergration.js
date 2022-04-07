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
/** Introducing local modules */
// const RewardPool = artifacts.require('./contracts/dao/RewardPool.sol');
// const MockToken = artifacts.require('./contracts/mock/MockToken.sol');
// const Operatable = artifacts.require('./contracts/tools/Operatable.sol');
// const Oracle = artifacts.require('./contracts/mock/TestOracle.sol');
// const FXS = artifacts.require('./contracts/token/FXS/FXS.sol');

contract('RewardPoolIntergration', ([owner, seObject]) => {
    // Some module name
    let RewardPoolModule = "RewardPool";
    let OperatableModule = "Operatable";
    let MockTokenModule = "MockToken";
    let TestOracleModule = 'TestOracle';
    let FXSModule = "FRAXShares";
    let FRAXModule = "FRAXStablecoin";

    // Declare some variables
    var tempFxsName = "TemporaryStringName";
    var tempFxsSymbol = "TemporaryStringSymbol";
    var tempFraxName = "TemporaryMemoryName";
    var tempFraxSymbol = "TemporaryMemorySymbol";
    var mockTempName = "TemporaryMockName";
    var mockTempSymbol = "TemporaryMockSymbol";
    var mockDecimal = 100;
    var mockTotal = toWei("10");

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
        if(infoNo1 == infoNo2) {
            return true
        }else {
            return false
        }
    }

    beforeEach(async function() {
        // This function must asynchronous
        let lastBlock = await time.latestBlock();
        var startBlock = parseInt(lastBlock);

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
        oracle = await Oracle.deploy();
        console.log("startBlock:" + startBlock);
        rewardPool = await RewardPool.deploy(operatable.address, fxs.address, tokenPerBlock, startBlock, period);

        // Set some values to wait for the event to fire
        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        // Create two pools
        await frax.addPool(rewardPool.address);
        await frax.addPool(owner);
    });

    it('Single user deposit and pending', async function() {
        // Introducing variable
        var authorBoolean = true
        var authorNumber = 100000
        var lpTokenNumber = 10000
        var allocPoint = 1
        var poolLength = await rewardPool.poolLength()
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
        userInfo = await rewardPool.userInfo(0, owner)
        amount = userInfo[0]
        rewardDebt = userInfo[1]
        assert.equal(userInfo[0], 0)
        assert.equal(userInfo[1], 0)

        // console.log(userInfo[0])
        // console.log(userInfo[1])
        // console.log("==========")

        console.log("-=-" + await fxs.balanceOf(owner))

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
        userInfo = await rewardPool.userInfo(0, owner)
        amount = userInfo[0]

        console.log("-=-")
        console.log(amount)

        targetAmount = amount * accTokenPerShare / 1e12 - rewardDebt

        console.log("-=-")
        console.log(targetAmount)

        // Call pending
        pendingValue = await rewardPool.pending(0, owner)

        poolInfo = await rewardPool.poolInfo(poolLength)
        structAllocPoint = await rewardPool.poolInfo[1]
        lastRewardBlock = await rewardPool.poolInfo[2]
        accTokenPerShare = await rewardPool.poolInfo[3]
        totalAmount = await rewardPool.poolInfo[4]

        // poolInfo = await rewardPool.poolInfo(poolLength)

        secondUserInfo = await rewardPool.userInfo(0, owner)

        // Get user information
        targetAccTokenPerShare = secondUserInfo[0]

        console.log("-=-")
        console.log(targetAccTokenPerShare)

        // Get pending
        await rewardPool.deposit(0, 0)

        console.log(await fxs.balanceOf(owner))
    });

    it('Single user deposit and pending and withdraw', async function() {
        // Introducing variable
        var authorBoolean = true
        var authorNumber = 100000
        var lpTokenNumber = 10000
        var poolLength = await rewardPool.poolLength()
        var allocPoint = 1
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
        acquiescentToken = await mockToken.balanceOf(owner)

        // Deposit tokens into the pool
        await rewardPool.deposit(poolLength, lpTokenNumber)

        // Chek out the token in the pool
        poolToken = await mockToken.balanceOf(rewardPool.address)

        startToken = await mockToken.balanceOf(owner)
        // Check out the token of user
        moveToken = await mockToken.balanceOf(owner)

        assert.equal(startToken, (acquiescentToken - lpTokenNumber))

        userInfoAmount = await rewardPool.userInfo(0, owner)
        var needAmount = userInfoAmount[0]

        console.log("-=-" + userInfoAmount)
        // Call withdraw function
        await rewardPool.withdraw(poolLength, needAmount)

        // Check out the token in the pool
        moveToken = await mockToken.balanceOf(rewardPool.address)
        assert.equal(moveToken, 0)

        endToken = await mockToken.balanceOf(owner)
        assert.equal(acquiescentToken. endToken)
    });
});