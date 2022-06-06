const {time, balance} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {toWei} = require('web3-utils');
const {BigNumber} = require('ethers');
const {type} = require('os');

contract('Locker', async () => {
    async function getDurationTime(day = 1) {
        if (undefined === typeof day || 0 >= day) {
            return;
        }
        return parseInt(await time.duration.days(day));
    }

    beforeEach(async function () {
        [owner, seObject] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const Locker = await ethers.getContractFactory("Locker");
        token0 = await TestERC20.deploy();
        secondTestERC20 = await TestERC20.deploy();
        thirdTestERC20 = await TestERC20.deploy();

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        await token0.mint(owner.address, toWei("1"));

        durationTime = await getDurationTime(1);
        lock = await Locker.deploy(operatable.address, token0.address, durationTime);
    });

    it('test function supportsInterface', async function () {
        let supportBool;
        supportBool = await lock.supportsInterface(0x01ffc9a7);
        expect(supportBool).to.be.eq(true);
    });

    it('test getLastUserSlope', async function () {
        let lockSlop;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1); // Lock one day
        tokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint
        // console.log("tokenId::\t" + tokenId); // But this is a object so we need to change the paramter to 1

        await lock.getLastUserSlope(1);

        lockMap = await lock.pointHistory(0);
        lockSlop = lockMap[1];
        assert.equal(lockSlop, 0);

        arrayName = await lock.ownerOf(1);
        expect(arrayName).to.be.not.eq(null);

        nftCount = await lock.balanceOf(arrayName);
        assert.equal(nftCount, 1);
    });

    it('test userPointHistoryTs', async function () {
        let functionReturnTimeStamp;

        lockMap = await lock.pointHistory(0);
        lockMapTimeStamp = lockMap[2];

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1);
        tokenId = await lock.createLock(1000, durationTime);

        functionReturnTimeStamp = await lock.userPointHistoryTs(1, 2);

        expect(functionReturnTimeStamp).to.be.eq(0);
    });

    it('test lockedEnd', async function () {
        let functionReturnEnd;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1);
        tokenId = await lock.createLock(1000, durationTime);

        lockBalanceMap = await lock.locked(1);
        lockBalanceEnd = lockBalanceMap[1];

        functionReturnEnd = await lock.lockedEnd(1);

        expect(functionReturnEnd).to.be.eq(lockBalanceEnd);
    });

    it('test balanceOf、ownerOf', async function () {
        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1);
        tokenId = await lock.createLock(1000, durationTime);

        arrayName = await lock.ownerOf(1);
        expect(arrayName).to.be.not.eq(null);

        nftCount = await lock.balanceOf(arrayName);

        assert.equal(nftCount, 1);
    });

    it('test approve、getApprove、isApprovedOrOwner', async function () {
        let firstTokenAddress;
        let secondTokenAddress;
        let poolTokenAddress;
        let needBoolean;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1);
        firstTokenId = await lock.createLock(1000, durationTime);
        await token0.connect(seObject).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1);
        secondTokenId = await lock.createLockFor(1000, durationTime, seObject.address);

        firstTokenAddress = await lock.ownerOf(1);
        secondTokenAddress = await lock.ownerOf(2);

        await lock.approve(secondTokenAddress, 1);

        poolTokenAddress = await lock.getApproved(1);
        expect(firstTokenAddress).to.be.not.eq(secondTokenAddress);

        needBoolean = await lock.isApprovedOrOwner(secondTokenAddress, 1);
        expect(needBoolean).to.be.eq(true);
    });

    it('test function about voter', async function () {
        let initFirstVoteBoolean;
        let firstVoteBoolean;
        let initSecondVoteBoolea;
        let secondVoteBoolean;
        let secondAddress;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1); // Lock one day
        firstTokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint
        await token0.connect(seObject).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1);
        secondTokenId = await lock.createLockFor(1000, durationTime, seObject.address); // The token id is 2

        initFirstVoteBoolean = await lock.voted(1);
        assert.equal(initFirstVoteBoolean, false);

        await lock.addBoosts(owner.address);

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
        expect(secondAddress).to.be.not.eq(null);
        await lock.addBoosts(secondAddress);
        assert.equal(await lock.boosts(secondAddress), true);

        secondVoteBoolean = await lock.connect(seObject).voted(2);
    });
    it('test checkPoint、_checkPoint', async function () {
        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1);
        firstTokenId = await lock.createLock(1000, durationTime);

        lockMap = await lock.pointHistory(0);
        lastPointBias = lockMap[0];
        assert.equal(lastPointBias, 0);
        lastPointSlope = lockMap[1];
        lastPointBlk = lockMap[3];
        lastPointTs = lockMap[2];
        latestBlock = await time.latestBlock();
        latestTs = await time.latest();
        blockSlope = (1e18 * latestBlock - lastPointBlk) / (latestTs - lastPointTs);
        expect(parseInt(blockSlope)).to.be.not.eq(0);
        durationTime = await getDurationTime(1);
        expect(durationTime).to.be.eq(86400);
        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        lockBalanceEnd = lockBalanceMap[1];
        t_i = (lastPointTs / durationTime) * durationTime;
        await lock.getLastUserSlope(1);
        userPointEpoch = await lock.userPointEpoch(1);

        await lock.checkpoint();
        lockMap = await lock.pointHistory(1);
        currentLockMap = await lock.pointHistory(0);
        expect(currentLockMap).to.be.not.eq(lockMap);
    });

    it('test block_number', async function () {
        let returnBlock;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1); // Lock one day
        firstTokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint

        latestBlock = await time.latestBlock();

    });

    it('test depositFor', async function () {
        let initLockBalanceAmount;
        let initLockBalanceEnd;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1); // Lock one day
        firstTokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint

        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        initLockBalanceAmount = lockBalanceAmount;
        lockBalanceEnd = lockBalanceMap[1];
        initLockBalanceEnd = lockBalanceEnd;

        await lock.depositFor(1, 1);
        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        lockBalanceEnd = lockBalanceMap[1];
        expect(initLockBalanceAmount.add(1)).to.be.eq(lockBalanceAmount);
        expect(initLockBalanceEnd).to.be.eq(lockBalanceEnd);
    });

    it('test balanceOfNFT and balanceOfNFTAt', async function () {
        let latestPointBias;
        let latestPointSlope;
        let latestPointTimeStamp;
        let paraTime;
        let timeStamp;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1); // Lock one day
        firstTokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint

        currentBlock = await time.latestBlock();

        lockMap = await lock.pointHistory(0);
        latestPointBias = lockMap[0];
        expect(parseInt(latestPointBias)).to.be.eq(0);
        latestPointSlope = lockMap[1];
        expect(parseInt(latestPointSlope)).to.be.eq(0);
        timeStamp = await time.latest();
        latestPointTimeStamp = lockMap[2];
        expect(parseInt(latestPointTimeStamp)).to.be.not.eq(parseInt(timeStamp));

        userPointEpoch = await lock.userPointEpoch(1);
        expect(userPointEpoch).to.be.eq(1);

        await lock.balanceOfNFT(1);
        lockMap = await lock.pointHistory(1);
        latestPointBias = lockMap[0];
        expect(parseInt(latestPointBias)).to.be.eq(0);

        paraTime = await time.latest();
        await lock.balanceOfNFTAt(1, parseInt(paraTime));
        lockMap = await lock.pointHistory(1);
        latestPointBias = lockMap[0];
        expect(latestPointBias).to.be.eq(0);
    });

    it('test tokenURI', async function () {
        let result;
        let decode;

        await token0.connect(owner).approve(lock.address, toWei("1000"));
        durationTime = await getDurationTime(1); // Lock one day
        firstTokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint

        lockBalanceMap = await lock.locked(1);
        lockBalanceAmount = lockBalanceMap[0];
        lockBalanceEnd = lockBalanceMap[1];

        result = await lock.tokenURI(1);
        decode = await lock.toString(result);
    });
    it('test isApprovedForAll', async function () {

        let isApproved = await lock.isApprovedForAll(owner.address, seObject.address);
        expect(isApproved).to.be.eq(false)
    });
    it('test transferFrom', async function () {
        await token0.approve(lock.address, toWei('10000'))
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1'), parseInt(eta));

        await lock.transferFrom(owner.address, seObject.address, 1);
        // expect(isApproved).to.be.eq(false)
    });
    it('test addBoosts and removeBoosts ', async function () {
        expect(await lock.boosts(owner.address)).to.be.eq(false)
        await lock.addBoosts(owner.address)

        expect(await lock.boosts(owner.address)).to.be.eq(true)

        await lock.removeBoosts(owner.address)
        expect(await lock.boosts(owner.address)).to.be.eq(false)

    });
    it("test merge", async () => {

        await token0.approve(lock.address, toWei('10000'))
        let eta = time.duration.days(7);
        await lock.createLock(toWei('0.1'), parseInt(eta));
        await token0.transfer(seObject.address, toWei('0.5'))
        await token0.connect(seObject).approve(lock.address, toWei('10000'))
        await lock.connect(seObject).createLock(toWei('0.1'), parseInt(eta));

        await lock.isApprovedOrOwner(seObject.address, 1)
        await lock.connect(seObject).isApprovedOrOwner(owner.address, 2)
        //await lock.merge(owner.address,seObject.address)
    })
    it("test setApprovalForAll", async () => {

        await lock.setApprovalForAll(seObject.address, true);

        let isApproved = await lock.isApprovedForAll(owner.address, owner.address);
        expect(isApproved).to.be.eq(false);
        isApproved = await lock.isApprovedForAll(owner.address, seObject.address);
        expect(isApproved).to.be.eq(true);
    })
    // it("test balanceOfAtNFT", async () => {
    //      await token0.approve(lock.address, toWei('10000'))
    //     let eta = time.duration.days(7);
    //     await lock.createLock(toWei('0.1'), parseInt(eta));
    //
    //     let lockBlock = await time.latestBlock();
    //     console.log("lockBlock:" + lockBlock)
    //     let atNFT = await lock.balanceOfAtNFT(1, 155)
    //
    //     console.log("atNFT:" + atNFT)
    // })
    it("test totalSupply", async () => {

        let lockBlock = await time.latestBlock();
        console.log("lockBlock:" + lockBlock)

        expect(await lock.totalSupply()).to.be.eq(0)

        await token0.approve(lock.address, toWei('10000'))
        let eta = time.duration.days(7);
        await lock.createLock(toWei('0.1'), parseInt(eta));
        console.log("totalSupply:" + await lock.totalSupply());

    })
    it("test totalSupplyAt", async () => {

        let lockBlock = await time.latestBlock();
        console.log("lockBlock:" + lockBlock)

        //  expect(await lock.totalSupply()).to.be.eq(0)

        // await token0.approve(lock.address, toWei('10000'))
        // let eta = time.duration.days(7);
        // await lock.createLock(toWei('0.1'), parseInt(eta));
        //   expect(await lock.totalSupply()).to.be.eq("449987315745968")


        let supplyAt = await lock.totalSupplyAt(5);
        expect(supplyAt).to.be.eq(0);
    })


});