const { time, balance } = require('@openzeppelin/test-helpers');
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { toWei } = require('web3-utils');
const { BigNumber } = require('ethers');
const { type } = require('os');

contract('Locker', async () => {
    let TestERC20;
    let Locker;
    let firstTestERC20;
    let durationTime;
    let lock;
    let lockMap;
    let firstTokenId;
    let secondTokenId;
    let tokenId;
    let lockBalanceMap;
    let lockMapTimeStamp;
    let lockBalanceEnd;
    let arrayName;
    let nftCount;
    let lockBalanceAmount;
    let latestBlock;
    let userPointEpoch;
    let currentBlock;
    
    async function mintAddress(object, addressName, toWei) {
        return await object.mint(addressName, toWei);
    } 

    async function getDurationTime(dayNumber) {
        if(0 >= durationTime || durationTime > 100) {
            return;
        }
        return parseInt(time.duration.days(dayNumber));
    }

    async function checkInfoEq(anyThing, value) {
        if("" == anyThing || null == anyThing) {
            return;
        }
        if("" == value || null == value) {
            return;
        }
        if(expect(value).to.be.eq(value)) {
            return true;
        }else{
            return false;
        }
    }

    beforeEach(async function() {
        [owner, seObject] = await ethers.getSigners();
        TestERC20 = await ethers.getContractFactory("TestERC20");
        Locker = await ethers.getContractFactory("Locker");
        firstTestERC20 = await TestERC20.deploy();
        secondTestERC20 = await TestERC20.deploy();
        thirdTestERC20 = await TestERC20.deploy();

        await firstTestERC20.mint(owner.address, toWei("1"));

        durationTime = getDurationTime(1);
        lock = await Locker.deploy(firstTestERC20.address, durationTime);
    });

    it('test function supportsInterface', async function() {
        let supportBool;
        supportBool = await lock.supportsInterface(0x01ffc9a7);
        console.log(checkInfoEq(supportBool, true));
    });

    it('test get_last_user_slope', async function() {
        let lockSlop;
        let lockMapBlcok;
        let currentTime;

        lockMap = await lock.point_history(0);
        lockMapTimeStamp = lockMap[2];
        lockMapBlcok = lockMap[3];
        currentBlock = await time.latestBlock();
        currentTime = await time.latest();

        console.log("PointTs::\t" + lockMapTimeStamp);
        console.log("CurrentT::\t" + currentTime);
        console.log("PointBlk::\t" + lockMapBlcok);
        console.log("CurrentBlk::\t" + currentBlock);

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1); // Lock one day
        tokenId = await lock.create_lock(1000, durationTime); // This function return a value type is uint
        console.log("tokenId::\t" + tokenId); // But this is a object so we need to change the paramter to 1

        await lock.get_last_user_slope(1);

        lockMap = await lock.point_history(0);
        lockSlop = lockMap[1];
        assert.equal(lockSlop, 0);

        arrayName = await lock.ownerOf(1);
        console.log("address::\t" + arrayName);

        nftCount = await lock.balanceOf(arrayName);
        assert.equal(nftCount, 1);
    });

    it('test user_point_history__ts', async function() {
        let functionReturnTimeStamp;

        lockMap = await lock.point_history(0);
        lockMapTimeStamp = lockMap[2];

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        tokenId = await lock.create_lock(1000, durationTime);

        functionReturnTimeStamp = await lock.user_point_history__ts(1, 2);

        console.log(checkInfoEq(functionReturnTimeStamp, lockMapTimeStamp));
    });

    it('test locked__end', async function() {
        let functionReturnEnd;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        tokenId = await lock.create_lock(1000, durationTime);

        lockBalanceMap = await lock.locked(1);
        lockBalanceEnd = lockBalanceMap[1];

        functionReturnEnd = await lock.locked__end(1);

        console.log(checkInfoEq(lockBalanceEnd, functionReturnEnd));
    });

    it('test balanceOf、ownerOf', async function() {
        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        tokenId = await lock.create_lock(1000, durationTime);

        arrayName = await lock.ownerOf(1);
        console.log("address::\t" + arrayName);

        nftCount = await lock.balanceOf(arrayName);

        assert.equal(nftCount, 1);
    });

    it('test approve、getApprove、isApprovedOrOwner', async function() {
        let firstTokenAddress;
        let secondTokenAddress;
        let poolTokenAddress;
        let needBoolean;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        firstTokenId = await lock.create_lock(1000, durationTime);
        await firstTestERC20.connect(seObject).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        secondTokenId = await lock.create_lock_for(1000, durationTime, seObject.address);

        firstTokenAddress = await lock.ownerOf(1);
        console.log("FTokenAddress::\t" + firstTokenAddress);
        secondTokenAddress = await lock.ownerOf(2);

        await lock.approve(secondTokenAddress, 1);

        poolTokenAddress = await lock.getApproved(1);
        console.log("STokenAddress::\t" + poolTokenAddress);

        needBoolean = await lock.isApprovedOrOwner(secondTokenAddress, 1);
        console.log(checkInfoEq(needBoolean, true));
    });

    it('test function about voter', async function() {
        let initFirstVoteBoolean;
        let firstVoteBoolean;
        let initSecondVoteBoolea;
        let secondVoteBoolean;
        let secondAddress;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1); // Lock one day
        firstTokenId = await lock.create_lock(1000, durationTime); // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        secondTokenId = await lock.create_lock_for(1000, durationTime, seObject.address); // The token id is 2

        initFirstVoteBoolean = await lock.voted(1);
        assert.equal(initFirstVoteBoolean, false);

        await lock.voting(1);
        firstVoteBoolean = await lock.voted(1);
        assert.equal(firstVoteBoolean, true);

        await lock.abstain(1);
        firstVoteBoolean = await lock.voted(1);
        assert.equal(firstVoteBoolean, false);

        await lock.voting(1);

        initSecondVoteBoolea = await lock.voted(2);
        assert.equal(initSecondVoteBoolea, false);

        secondAddress = await lock.ownerOf(2);
        console.log(secondAddress);
        await lock.setVoter(secondAddress);
        assert.equal(await lock.voter(), secondAddress);

        secondVoteBoolean = await lock.connect(seObject).voted(2);
        console.log(secondVoteBoolean);
    });

    it('test attach、detach', async function() {
        let firstAttach;
        let secondAttach;
        let type;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1); // Lock one day
        firstTokenId = await lock.create_lock(1000, durationTime); // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        secondTokenId = await lock.create_lock_for(1000, durationTime, seObject.address); // The token id is 2
        type = typeof firstTokenId;
        console.log(type);
        type = typeof secondTokenId;
        console.log(type);

        firstAttach = await lock.attachments(0);
        secondAttach = await lock.attachments(1);
        assert.equal(firstAttach, 0);
        assert.equal(secondAttach, 0);

        await lock.attach(1);
        firstAttach = await lock.attachments(0);
        console.log(firstAttach);
    });

    it('test checkPoint、_checkPoint', async function() {
        let lastPointBias;
        let lastPointSlope;
        let lastPointBlk;
        let lastPointTs;
        let t_i;
        let blockSlope;
        let latestTs;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1);
        firstTokenId = await lock.create_lock(1000, durationTime);

        lockMap = await lock.point_history(0);
        lastPointBias = lockMap[0];
        assert.equal(lastPointBias, 0);
        lastPointSlope = lockMap[1];
        lastPointBlk = lockMap[3];
        lastPointTs = lockMap[2];
        latestBlock = await time.latestBlock();
        latestTs = await time.latest();
        blockSlope = (1e18 * latestBlock - lastPointBlk) / (latestTs - lastPointTs);
        console.log("slope::\t" + parseInt(blockSlope));
        durationTime = getDurationTime(1);
        console.log(checkInfoEq(durationTime, 86400));
        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        lockBalanceEnd = lockBalanceMap[1];
        t_i = (lastPointTs / durationTime) * durationTime;
        console.log("t_i::\t" + parseInt(t_i));
        await lock.get_last_user_slope(1);
        userPointEpoch = await lock.user_point_epoch(1);
        console.log("userPoint::\t" + userPointEpoch);

        await lock.checkpoint();
        lockMap = await lock.point_history(1);
        console.log(lockMap);
        lockMap = await lock.point_history(0);
        console.log(lockMap);
    });

    it('test block_number', async function() {
        let returnBlock;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1); // Lock one day
        firstTokenId = await lock.create_lock(1000, durationTime); // This function return a value type is uint

        latestBlock = await time.latestBlock();

        returnBlock = await lock.block_number();

        console.log(checkInfoEq(latestBlock, returnBlock));
    });

    it('test deposit_for', async function() {
        let initLockBalanceAmount;
        let initLockBalanceEnd;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1); // Lock one day
        firstTokenId = await lock.create_lock(1000, durationTime); // This function return a value type is uint

        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        initLockBalanceAmount = lockBalanceAmount;
        lockBalanceEnd = lockBalanceMap[1];
        initLockBalanceEnd = lockBalanceEnd;

        await lock.deposit_for(1, 1);
        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        lockBalanceEnd = lockBalanceMap[1];
        console.log(checkInfoEq(initLockBalanceAmount, lockBalanceAmount));
        console.log(checkInfoEq(initLockBalanceEnd, lockBalanceEnd));
    });

    it('test balanceOfNFT and balanceOfNFTAt', async function(){
        const Result = 0;
        let latestPointBias;
        let latestPointSlope;
        let latestPointTimeStamp;
        let paraTime;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1); // Lock one day
        firstTokenId = await lock.create_lock(1000, durationTime); // This function return a value type is uint

        currentBlock = await time.latestBlock();

        lockMap = await lock.point_history(0);
        latestPointBias = lockMap[0];;
        console.log(latestPointBias);
        latestPointSlope = lockMap[1];
        console.log(latestPointSlope);
        latestPointTimeStamp = lockMap[2];
        console.log(latestPointTimeStamp);

        userPointEpoch = await lock.user_point_epoch(1);
        console.log(checkInfoEq(userPointEpoch, 1));

        await lock.balanceOfNFT(1);
        lockMap = await lock.point_history(1);
        latestPointBias = lockMap[0];
        console.log(latestPointBias);

        paraTime = await time.latest();
        await lock.balanceOfNFTAt(1, parseInt(paraTime));
        lockMap = await lock.point_history(1);
        latestPointBias = lockMap[0];
        expect(latestPointBias).to.be.eq(Result);
    });

    it('test tokenURI', async function() {
        let result;
        let decode;

        await firstTestERC20.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = getDurationTime(1); // Lock one day
        firstTokenId = await lock.create_lock(1000, durationTime); // This function return a value type is uint

        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        lockBalanceEnd = lockBalanceMap[1];

        result = await lock.tokenURI(1);
        decode = await lock.toString(result);
        console.log(decode);
    });
});