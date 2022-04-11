/**
 * @description: This is the unit test case for the locker contract
 * @author: Lucifer
 * @data: 2022/04/09 10:30
 */
/** Introducing external modules */
const { time, balance } = require('@openzeppelin/test-helpers');
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { toWei } = require('web3-utils');
const { BigNumber } = require('ethers');
const { type } = require('os');

contract('Locker', async () => {
    /**
     * This contract we need two object to which is implement interface ERC721 or ERC165
     */
    // Introducing constant
    const TESTERC20 = "TestERC20";
    const LOCKER = "Locker";
    const ERC721_INTERFACE_BYTE = 0x01ffc9a7;
    // const LOCK_INFO_NAME = "veNFT";
    // const SYMBOL = "veNFT";
    // const VERSION = "1.0.0";
    // const DECIMALS = 18;
    const SUPPLY = 1000; // This parameter is a value about reward pool
    const APPROVE_NUMBER = "1000";

    // Intfoducing varibale
    let TestERC20
    let Locker
    let firstTestERC20;
    let seTestERC20;
    let thTestERC20;
    let durationTime;
    let lock;
    
    /**
     * To mint some object
     * @param {Contract} object 
     * @param {Address} addressName 
     * @param {Any} toWei
     * @returns 
     */
    async function mintAddress(object, addressName, toWei) {
        return object.mint(addressName, toWei)
    } 

    /**
     * Get duration time
     * @param {Number} dayNumber 
     * @returns 
     */
    async function getDurationTime(dayNumber) {
        if(0 >= durationTime || durationTime > 100) {
            return
        }
        return parseInt(time.duration.days(dayNumber))
    }

    /**
     * This is a function about change time to int
     * @param {TimeBlock} block 
     * @returns 
     */
    async function changeTimeBlock() {
        var block
        block = time.latestBlock()
        return parseInt(block)
    }

    async function changeTime() {
        var timeInt
        timeInt = time.latest()
        return parseInt(timeInt)
    }

    /**
     * This is a function about check information equal information
     * @param {Any} anyThing 
     * @param {Any} value 
     * @returns 
     */
    async function checkInfoEq(anyThing, value) {
        if("" == anyThing || null == anyThing) {
            return
        }
        if("" == value || null == value) {
            return
        }
        if(expect(value).to.be.eq(value)) {
            return true
        }else{
            return false
        }
    }

    /**
     * This is a function about check information big than another
     * @param {Any} anyThing 
     * @param {Any} value 
     * @returns 
     */
    async function checkInfoGt(anyThing, value) {
        if("" == anyThing || null == anyThing) {
            return
        }
        if("" == value || null == value) {
            return
        }
        if(expect(value).to.be.gt(anyThing)) {
            return true
        }else{
            return false
        }
    }

    /**
     * This is a function about check information less than another
     * @param {Any} anyThing
     * @param {Any} value 
     * @returns 
     */
    async function checkInfoLt(anyThing, value) {
        if("" == anyThing || null == anyThing) {
            return
        }
        if("" == value || null == value) {
            return
        }
        if(expect(value).to.be.lt(anyThing)) {
            return true
        }else{
            return false
        }
    }

    beforeEach(async function() {
        [owner, seObject] = await ethers.getSigners();
        TestERC20 = await ethers.getContractFactory(TESTERC20);
        Locker = await ethers.getContractFactory(LOCKER);
        // Deploy contract
        firstTestERC20 = await TestERC20.deploy();
        seTestERC20 = await TestERC20.deploy();
        thTestERC20 = await TestERC20.deploy();

        // Mint value
        mintAddress(firstTestERC20, owner.address, toWei("1"));
        mintAddress(seTestERC20, owner.address, toWei("1"));
        mintAddress(thTestERC20, owner.address, toWei("1"));

        // Mint some initial value
        durationTime = getDurationTime(1);
        lock = await Locker.deploy(firstTestERC20.address, durationTime);
    });

    it('test function supportsInterface', async function() {
        var supportBool
        supportBool = await lock.supportsInterface(ERC721_INTERFACE_BYTE)
        console.log(checkInfoEq(supportBool, true))
    });

    it('test get_last_user_slope', async function() {
        /**
         * This function need tokenid, when you want to get tokenid you need to call the function of create_lock
         * When you instantiation the contract of locker you will get a point info
         * If you want to get point info you need to access contract properties point_history
         */
        // Evrytime will execute before each so we can access contract properties
        var lockMap
        var lockSlop
        var lockMapTimeStamp
        var lockMapBlcok
        var currentBlock
        var currentTime
        var tokenId
        var arName
        var nftCount

        lockMap = await lock.point_history(0) // You will get a struct
        lockMapTimeStamp = lockMap[2]
        lockMapBlcok = lockMap[3]
        currentBlock = await time.latestBlock()
        currentTime = await time.latest()

        // Assertion comparison result
        console.log("PointTs::\t" + lockMapTimeStamp)
        console.log("CurrentT::\t" + currentTime)
        console.log("PointBlk::\t" + lockMapBlcok)
        console.log("CurrentBlk::\t" + currentBlock)

        // When you call create_lock you need to approve
        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        tokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        console.log("tokenId::\t" + tokenId) // But this is a object so we need to change the paramter to 1

        // Call the function of test
        // await lock.get_last_user_slope(tokenId)
        await lock.get_last_user_slope(1)

        // Check user point slope
        lockMap = await lock.point_history(0)
        lockSlop = lockMap[1]
        assert.equal(lockSlop, 0)

        // Token id type change to object
        arName = await lock.ownerOf(1)
        console.log("address::\t" + arName) // This return value is a hash value

        nftCount = await lock.balanceOf(arName)
        assert.equal(nftCount, 1)
    });

    it('test user_point_history__ts', async function() {
        var lockMap
        var lockMapTimeStamp
        var functionReturnTimeStamp
        var tokenId

        lockMap = await lock.point_history(0) // You will get a struct
        lockMapTimeStamp = lockMap[2] // This is index of time stamp in the struct point

        // Approve
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        tokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint

        // Call the function of test
        functionReturnTimeStamp = await lock.user_point_history__ts(1, 2)

        console.log(checkInfoEq(functionReturnTimeStamp, lockMapTimeStamp))
    });

    it('test locked__end', async function() {
        var balanceMap
        var balanceMapEnd
        var functionReturnEnd
        var tokenId

        // When you create a lock will change lockbalance end value
        // Approve
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        tokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint

        // Get lockerbalance struct
        balanceMap = await lock.locked(1)
        balanceMapEnd = balanceMap[1]

        // Call the function of locked__end
        functionReturnEnd = await lock.locked__end(1)

        console.log(checkInfoEq(balanceMapEnd, functionReturnEnd))
    });

    it('test balanceOf、ownerOf', async function() {
        var tokenId
        var arName
        var nftCount

        // Approve
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        tokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint

        // Token id type change to object
        arName = await lock.ownerOf(1)
        console.log("address::\t" + arName) // This return value is a hash value

        nftCount = await lock.balanceOf(arName)

        assert.equal(nftCount, 1)
    });

    it('test approve、getApprove、isApprovedOrOwner', async function() {
        /**
         * You need to craete lock twice, because this function definition can not empower yourself
         * Focus on the one modifled map ---> idToApproves
         */
        var firstTokenId
        var firstTokenAddress
        var secondTokenId
        var secondTokenAddress
        var poolTokenAddress
        var needBoolean

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        durationTime = getDurationTime(1)
        secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2
        /**
         *  Each user can authorize the pool only once
         */

        // We use the second token to authorize the first token
        firstTokenAddress = await lock.ownerOf(1)
        console.log("FTokenAddress::\t" + firstTokenAddress)
        secondTokenAddress = await lock.ownerOf(2)

        /**
         * You must ensure that this address is present in the lock pool and is not self-authorized
         * This parameter is the authorized object
         */
        await lock.approve(secondTokenAddress, 1)

        // Check approves address
        poolTokenAddress = await lock.getApproved(1)
        console.log("STokenAddress::\t" + poolTokenAddress)

        // Determine whether authorization is granted so we know approve object in approves
        needBoolean = await lock.isApprovedOrOwner(secondTokenAddress, 1)
        console.log(checkInfoEq(needBoolean, true))
    });

    it('test function about voter', async function() {
        var firstTokenId
        var secondTokenId
        var initFirstVoteBoolean
        var firstVoteBoolean
        var initSecondVoteBoolea
        var seVoteBoolean
        var seAddress

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        durationTime = getDurationTime(1)
        secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2

        // Change your voting status
        initFirstVoteBoolean = await lock.voted(1)
        assert.equal(initFirstVoteBoolean, false)

        // Call the function of voting
        await lock.voting(1)
        firstVoteBoolean = await lock.voted(1)
        assert.equal(firstVoteBoolean, true)

        // Call the function of abstain
        await lock.abstain(1)
        firstVoteBoolean = await lock.voted(1)
        assert.equal(firstVoteBoolean, false)

        // Call again
        await lock.voting(1)

        // Get second locke object vote
        initSecondVoteBoolea = await lock.voted(2)
        assert.equal(initSecondVoteBoolea, false)

        // Convert authorization
        // Call the function idToOwner
        seAddress = await lock.ownerOf(2)
        console.log(seAddress)
        await lock.setVoter(seAddress)
        assert.equal(await lock.voter(), seAddress)

        // Call the function voted
        seVoteBoolean = await lock.connect(seObject).voted(2)
        console.log(seVoteBoolean)
        // seVoteBoolean = await lock.voted(2)
        // console.log(seVoteBoolean)
    });

    it('test attach、detach', async function() {
        var firstTokenId
        var firAtt
        var firDet
        var secondTokenId
        var seAtt
        var seDet
        var type

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        durationTime = getDurationTime(1)
        secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2
        type = typeof firstTokenId
        console.log(type)
        type = typeof secondTokenId
        console.log(type)

        // Get attachments info
        firAtt = await lock.attachments(0)
        seAtt = await lock.attachments(1)
        assert.equal(firAtt, 0)
        assert.equal(seAtt, 0)

        // Call the function attach
        await lock.attach(1)
        firAtt = await lock.attachments(0)
        console.log(firAtt)

        // Call the function detach
        // firDet = await lock.detach(0) // Panic is thrown because the array is not declared
        // seDet = await lock.detach(1)
    });

    it('test checkPoint、_checkPoint', async function() {
        /**
         * Create a lock and call the function
         * This function need to know before call the function --->lastPointBlk, lastPointTs, durationTime, t_i, slope_changes[t_i]
         */
        const Day = 86400 // This time is a const
        const NUMBER = 1e18; // To calculate the slope
        var firstTokenId
        var secondTokenId
        var lockMap
        var lastPointBias
        var lastPointSlope
        var lastPointBlk
        var lastPointTs
        var durationTime
        var t_i
        var blockSlope
        var lockBalanceMap
        var lockBalanceAmount
        var lockBalanceEnd
        var latestBlock
        var latestTs
        var userPointEpoch

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        // await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        // durationTime = getDurationTime(1)
        // secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2

        // Get value
        lockMap = await lock.point_history(0)
        lastPointBias = lockMap[0]
        assert.equal(lastPointBias, 0)
        lastPointSlope = lockMap[1]
        lastPointBlk = lockMap[3]
        lastPointTs = lockMap[2]
        latestBlock = await time.latestBlock()
        latestTs = await time.latest()
        blockSlope = (NUMBER * latestBlock - lastPointBlk) / (latestTs - lastPointTs)
        console.log("slope::\t" + parseInt(blockSlope))
        durationTime = getDurationTime(1)
        console.log(checkInfoEq(durationTime, Day))
        lockBalanceMap = await lock.locked(1)
        lockBalanceAmount = lockBalanceMap[0]
        lockBalanceEnd = lockBalanceMap[1]
        t_i = (lastPointTs / durationTime) * durationTime
        console.log("t_i::\t" + parseInt(t_i))
        await lock.get_last_user_slope(1)
        userPointEpoch = lock.user_point_epoch(1)
        console.log(userPointEpoch)

        // Call the function
        await lock.checkpoint()
        lockMap = await lock.point_history(1)
        console.log(lockMap)
        lockMap = await lock.point_history(0)
        console.log(lockMap)
    }); // Unfinished--->Check_point function is very important

    it('test block_number', async function() {
        var firstTokenId
        var latestBlock
        var returnBlock

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint

        // Get the time block
        latestBlock = await time.latestBlock()

        // Call the function
        returnBlock = await lock.block_number()

        console.log(checkInfoEq(latestBlock, returnBlock))
    });

    it('test deposit_for', async function() {
        /**
         * This function is a deposite token to another value
         * The function changes the value of LockedBalnace, locked
         */
        var firstTokenId
        var lockBalanceMap
        var lockBalanceAmount
        var initLockBalanceAmount
        var lockBalanceEnd
        var initLockBalanceEnd

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint

        // Get lock amount and lock end --->get lock amount use lock index, get lock end use the function of get lock end
        lockBalanceMap = await lock.locked(1)
        lockBalanceAmount = lockBalanceMap[0]
        initLockBalanceAmount = lockBalanceAmount
        lockBalanceEnd = lockBalanceMap[1]
        initLockBalanceEnd = lockBalanceEnd

        // Call the function
        await lock.deposit_for(1, 1)
        lockBalanceMap = await lock.locked(1)
        lockBalanceAmount = lockBalanceMap[0]
        lockBalanceEnd = lockBalanceMap[1]
        console.log(checkInfoEq(initLockBalanceAmount, lockBalanceAmount))
        console.log(checkInfoEq(initLockBalanceEnd, lockBalanceEnd))
    });

    it('test balanceOfNFT and balanceOfNFTAt', async function(){
        /**
         * The function changes the value of point.slope, point.bias
         */
        const Result = 0
        var firstTokenId
        var currentBlock
        var lockMap
        var latestPointBias
        var latestPointSlope
        var latestPointTs
        var userPointEpoch
        var paraTime

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint

        // Get time block
        currentBlock = await time.latestBlock()

        // Get lock map
        lockMap = await lock.point_history(0)
        latestPointBias = lockMap[0]
        console.log(latestPointBias)
        latestPointSlope = lockMap[1]
        console.log(latestPointSlope)
        latestPointTs = lockMap[2]
        console.log(latestPointTs)

        // Get user_point_epoch
        userPointEpoch = await lock.user_point_epoch(1)
        console.log(checkInfoEq(userPointEpoch, 1))

        // Call the function of nft
        await lock.balanceOfNFT(1)
        lockMap = await lock.point_history(1)
        latestPointBias = lockMap[0]
        console.log(latestPointBias)
        // expect(paraTime).to.be.not.eq(BigNumber.from(latestPointTs))

        // Call the function of nft at
        paraTime = await time.latest()
        await lock.balanceOfNFTAt(1, parseInt(paraTime))
        lockMap = await lock.point_history(1)
        latestPointBias = lockMap[0]
        expect(latestPointBias).to.be.eq(Result)
    });// Queer

    it('test tokenURI', async function() {
        var firstTokenId
        var lockBalanceMap
        var lockBalanceAmount
        var lockBalanceEnd
        var result
        var decode

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint

        lockBalanceMap = await lock.locked(1)
        lockBalanceAmount = lockBalanceMap[0]
        lockBalanceEnd = lockBalanceMap[1]

        // Call the function
        result = await lock.tokenURI(1)
        decode = await lock.toString(result)
        console.log(decode)
    });
});
