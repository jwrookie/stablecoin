/**
 * @description: This is a test case about contract RewardPool
 * @author: Lucifer
 */
// Introduce some external dependencies
const {ethers} = require('ethers');
const {time} = require('@openzeppelin/test-helpers');
const { on } = require('events');
// Local dependencies
const RewardPool = artifacts.require('./contracts/dao/RewardPool.sol');
const TestERC20 = artifacts.require('./contracts/mock/TestERC20.sol');
const Operatable = artifacts.require('./contracts/tools/Operatable.sol');
const Locker = artifacts.require('./contracts/dao/Locker.sol');
// const { assert } = require('console');
// const ether = require('@openzeppelin/test-helpers/src/ether');

contract('RewardPool', ([owner, secondObject]) => {
    // The initial number
    let initNumber = 10000000
    let initSecondNumber = 20000000
    beforeEach(async () => {
        // Introduce internal dependencies through the factory approach
        // const testRewardPool = await ethers.getContractFactory('RewardPool')
        // Introduce internal dependencies through the factory approach--->This factory object is used to obtain the token
        // const testTestERC20 = await ethers.getContractFactory('TestERC20')
        // Get the factory object through this constant function deploy4
        // rewardPool = await testRewardPool.depoly(owner, testRewardPool.address, secondObject, 1, 1, 1)
        // Instantiate the parameters required by the test object
        // operatormsg object
        operatable = await Operatable.new()
        // swaptoken object
        testERC20 = await TestERC20.new()
        // token lock object
        tokenLock = await Locker.new(testERC20.address)
        rewardPool = await RewardPool.new(operatable.address, testERC20.address, tokenLock.address, 1, 1, 1)

        // Get this object currency
        await testERC20.mint(owner, 10000000)
    });
    
    /**
     * @description: This function is get length what we need
     * @param {int}index 
     * @returns 
     */
    async function getInformationLength() {
        // Second check the pool information ---> length => 1 and information change
        let targLength = await rewardPool.poolLength()
        return targLength
    }

    /**
     * @description: This is a function about get information of what we need
     * @param {int} index 
     * @returns 
     */
    async function getInformation(index = 0) {
        // Check out pool information
        let targMsg = await rewardPool.poolInfo(index)
        return targMsg
    }

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

    it('test poolLength', async () => {
        // Use assertions to determine if the output is correct
        assert.equal(await rewardPool.poolLength(), 0)
    });

    it('test setPause', async () => {
        // Before call this function pause is false
        await rewardPool.setPause()
        assert.equal(await rewardPool.paused(), true)
    });

    it('test add', async () => {
        // Declare a variable
        var needBoolean = true
        // Before call this functoin pool is zero
        assert.equal(await rewardPool.poolLength(), 0)

        // Call this function add a point
        await rewardPool.add(1, tokenLock.address, needBoolean)

        // Assertion determines whether the pool length has changed
        assert.equal(await rewardPool.poolLength(), 1)
    });

    it('test set true', async () => {
        let answerBoolean = false
        let needBoolean = true
        // When you do not call this function pool information is nil
        assert.equal(await rewardPool.poolLength(), 0)
        // Frist need add something in the pool
        await rewardPool.add(100, tokenLock.address, needBoolean)
        // Get information of this pool
        let firstInfo = await getInformation(0)

        let length = await getInformationLength()

        assert.equal(length, 1)

        // Call the function of set
        await rewardPool.set(0, 10, needBoolean)

        // Check out pool length
        let secondLength = await getInformationLength()
        assert.equal(secondLength, 1)

        // Check out pool information
        let secondInfo = await getInformation(0)

        // Call local function check test successfully
        assert.equal(await checkInfo(firstInfo, secondInfo), answerBoolean)
    });

    it('test set false', async () => {
        let sureBoolean = true
        let needBoolean = false
        // If call function set paramter is false will change fail
        // First we need add something in the pool
        await rewardPool.add(100, tokenLock.address, sureBoolean)
        
        // Get first information
        let firstInfo = await getInformation(0)

        // Call function set fail
        await rewardPool.set(0, 10, needBoolean)
        // Get second information
        let secondInfo = await getInformation(0)

        // Check whether the two messages are the same
        assert.equal(await checkInfo(firstInfo, secondInfo), needBoolean)
    });

    it('test deposit', async () => {
        let successfully = true
        let sureBoolean = true
        // Authorization number
        let authorNumber = 100000
        // In the numerical
        let needNumeerical = 10000
        // When you want to deposi you need to obtain authorization
        await testERC20.approve(rewardPool.address, authorNumber)
        // Check whether the authorization is obtained successfully
        // assert.equal(getAuthorization, successfully)

        // When you want to deposit something you need to add something in pool
        await rewardPool.add(100, testERC20.address, sureBoolean)
        // Add something in pool
        // await rewardPool.add(100, tokenLock.address, sureBoolean)
        // Call deposit function -> This function need two parameters => pid and uint
        await rewardPool.deposit(0, needNumeerical)

        // We need to get information of user to check whether it is the same as the written information
        // Pool user information and struct user information
        // let userInfoInPool = await testERC20.balanceOf(rewardPool.address)

        // Assertion determines whether the same or not
        assert.equal(await testERC20.balanceOf(rewardPool.address), needNumeerical)

        // User informatoin
        let userInfo = await rewardPool.userInfo(0, owner)
        assert.equal(userInfo.amount, needNumeerical)
    });

    it('test withdraw', async () => {
        let successfully = true
        // let sureBoolean = true
        let authorNumber = 100000
        let needNumber = 10000
        // Obtain authorization
        await testERC20.approve(rewardPool.address, authorNumber)

        // Check pool number whether the quantity is consistent with the authorized quantity
        assert.equal(await testERC20.balanceOf(owner), initNumber)

        // Add something in the pool
        await rewardPool.add(1, testERC20.address, successfully)

        // Call deploy function
        await rewardPool.deposit(0, needNumber, {from: owner})

        // Call withdraw function
        // await rewardPool.withdraw(0, needNumber)

        // Check pool number whether the quantity is consistent whit at first
        assert.equal(await testERC20.balanceOf(owner), initNumber - needNumber)
    });
    
    it('test pending', async () => {
        let successfully = true
        let fail = false
        let authorNumber = 100000
        let needNumber = 10000
        // Obtain authorization
        await testERC20.approve(rewardPool.address, authorNumber)
        // Check object number
        assert.equal(await testERC20.balanceOf(owner), initNumber)

        // Authrization pool add something
        await rewardPool.add(1, testERC20.address, fail)

        // Determine the values in the pool ---> user.amount == 0
        assert.equal(await rewardPool.pending(0, owner), 0)

        // Call functino deploy
        await rewardPool.deposit(0, needNumber, {from: owner})

        // user.amount > 0 && block.number == pool.lastRewardBlock
        assert.equal(await rewardPool.pending(0, owner), 0)

        // user.amount > 0 && block.number > pool.lastRewardBlock
        let lockBlock = await time.latestBlock()
        await time.advanceBlock(parseInt(lockBlock) + 2)
        let poolInfo = await rewardPool.poolInfo(0)
        let userInfo = await rewardPool.userInfo(0, owner)
        let totalAllocPoint = await rewardPool.totalAllocPoint()
        let tokenPerBlock = await rewardPool.tokenPerBlock()
        let mul = await (await time.latestBlock() - poolInfo.lastRewardBlock)
        let tokenReward = tokenPerBlock * mul * poolInfo.allocPoint / totalAllocPoint
        let lpSupply = await testERC20.balanceOf(rewardPool.address)
        let accTokenPerShare = poolInfo.accTokenPerShare + tokenReward * initNumber / lpSupply;
        let currPending2 = userInfo.amount * accTokenPerShare / initNumber - userInfo.rewardDebt;
        assert.equal(await rewardPool.pending(0, owner), currPending2);
    });

    it('test emergencyWithdraw', async () => {
        let successfully = true
        let fail = false
        let authorNumber = 100000
        let needNumber = 10000
        let secondNumber = 20000
        // Obtain object
        await testERC20.approve(rewardPool.address, authorNumber)
        // Instantiate the second object
        await testERC20.mint(secondObject, initSecondNumber)
        // Obtain object and send number from second object
        await testERC20.approve(rewardPool.address, secondNumber, {from: secondObject})
        // Add something in pool
        await rewardPool.add(200, testERC20.address, successfully)
        // Change each other number
        await rewardPool.deposit(0, needNumber, {from: owner})
        // await rewardPool.deposit(0, secondNumber, {from: secondObject})

        // Check each other number
        await rewardPool.emergencyWithdraw(0, {from: secondObject})
        // assert.equal(await testERC20.balanceOf(secondObject), secondNumber)
        assert.equal(await testERC20.balanceOf(rewardPool.address), needNumber)
    });
});