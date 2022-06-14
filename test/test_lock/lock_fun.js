const {time, balance} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {toWei} = require('web3-utils');
const {GetMockToken} = require("../Utils/GetMockConfig");
const {GetRusdAndTra} = require("../Utils/GetStableConfig");
const {BigNumber} = require('ethers');
const ONE_DAT_DURATION = 86400;

contract('Locker', async () => {
    async function getDurationTime(day = 1) {
        if (undefined === typeof day || 0 >= day) {
            return;
        }
        return parseInt(await time.duration.days(day));
    }

    async function getGaugesInBoost(poolAddress, approveNumber = toWei("100")) {
        const Gauge = await ethers.getContractFactory("Gauge");
        gaugeAddress = await boost.gauges(poolAddress.address);
        gauge = await Gauge.attach(gaugeAddress);
        await poolAddress.approve(gauge.address, approveNumber);
        return gauge;
    }

    beforeEach(async function () {
        [owner, seObject, dev] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        await rusd.transfer(dev.address, toWei("10"));
        await tra.transfer(dev.address, toWei("10"));
        await tra.transfer(seObject.address, toWei("10"));

        const Locker = await ethers.getContractFactory("Locker");

        lock = await Locker.deploy(checkOpera.address, tra.address, ONE_DAT_DURATION);

        // Tra will be giving to the user as reward
        await tra.approve(lock.address, toWei("1000000"));
        await tra.connect(dev).approve(lock.address, toWei("1000000"));
        await tra.connect(seObject).approve(lock.address, toWei("1000000"));

        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(checkOpera.address);

        startBlock = await time.latestBlock();
        initStartBlock = parseInt(startBlock);

        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOpera.address,
            lock.address,
            gaugeFactory.address,
            tra.address,
            10000,
            parseInt(initStartBlock),
            10
        );

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOpera.address,
            boost.address,
            lock.address,
            ONE_DAT_DURATION
        );

        await tra.addPool(boost.address);
        // Create a gauge pool
        await boost.createGauge(rusd.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGaugesInBoost(rusd);

    });

    it('test function supportsInterface', async function () {
        let supportBool;
        supportBool = await lock.supportsInterface(0x01ffc9a7);
        expect(supportBool).to.be.eq(true);
    });

    it('test getLastUserSlope', async function () {
        let lockSlop;

        durationTime = await getDurationTime(1); // Lock one day
        tokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint
        // console.log("tokenId::\t" + tokenId); // But this is a object so we need to change the paramter to 1

        await lock.getLastUserSlope(1);

        lockMap = await lock.pointHistory(0);
        lockSlop = lockMap[1];
        expect(lockSlop).to.be.eq(0);

        arrayName = await lock.ownerOf(1);
        expect(arrayName).to.be.not.eq(null);

        nftCount = await lock.balanceOf(arrayName);
        expect(nftCount).to.be.eq(1);
    });

    it('test userPointHistoryTs', async function () {
        let functionReturnTimeStamp;

        lockMap = await lock.pointHistory(0);
        lockMapTimeStamp = lockMap[2];

        durationTime = await getDurationTime(1);
        tokenId = await lock.createLock(1000, durationTime);

        functionReturnTimeStamp = await lock.userPointHistoryTs(1, 2);

        expect(functionReturnTimeStamp).to.be.eq(0);
    });

    it('test lockedEnd', async function () {
        let functionReturnEnd;

        durationTime = await getDurationTime(1);
        tokenId = await lock.createLock(1000, durationTime);

        lockBalanceMap = await lock.locked(1);
        lockBalanceEnd = lockBalanceMap[1];

        functionReturnEnd = await lock.lockedEnd(1);

        expect(functionReturnEnd).to.be.eq(lockBalanceEnd);
    });

    it('test balanceOf、ownerOf', async function () {
        durationTime = await getDurationTime(1);
        tokenId = await lock.createLock(1000, durationTime);

        arrayName = await lock.ownerOf(1);
        expect(arrayName).to.be.not.eq(null);

        nftCount = await lock.balanceOf(arrayName);

        expect(nftCount).to.be.eq(1);
    });

    it('test approve、getApprove、isApprovedOrOwner', async function () {
        let firstTokenAddress;
        let secondTokenAddress;
        let poolTokenAddress;
        let needBoolean;

        durationTime = await getDurationTime(1);
        firstTokenId = await lock.createLock(1000, durationTime);
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

        durationTime = await getDurationTime(1); // Lock one day
        firstTokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint
        durationTime = await getDurationTime(1);
        secondTokenId = await lock.createLockFor(1000, durationTime, seObject.address); // The token id is 2

        initFirstVoteBoolean = await lock.voted(1);
        expect(initFirstVoteBoolean).to.be.eq(false);

        await lock.addBoosts(owner.address);

        await lock.voting(1);
        firstVoteBoolean = await lock.voted(1);
        expect(firstVoteBoolean).to.be.eq(true);

        await lock.abstain(1);
        firstVoteBoolean = await lock.voted(1);
        expect(firstVoteBoolean).to.be.eq(false);

        await lock.voting(1);

        initSecondVoteBoolea = await lock.voted(2);
        expect(initSecondVoteBoolea).to.be.eq(false);

        secondAddress = await lock.ownerOf(2);
        expect(secondAddress).to.be.not.eq(null);
        await lock.addBoosts(secondAddress);
        expect(await lock.boosts(secondAddress)).to.be.eq(true);

        secondVoteBoolean = await lock.connect(seObject).voted(2);
    });
    it('test checkPoint、_checkPoint', async function () {
        durationTime = await getDurationTime(1);
        firstTokenId = await lock.createLock(1000, durationTime);

        lockMap = await lock.pointHistory(0);
        lastPointBias = lockMap[0];
        expect(lastPointBias).to.be.eq(0);
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
        durationTime = await getDurationTime(1); // Lock one day
        firstTokenId = await lock.createLock(1000, durationTime); // This function return a value type is uint

        latestBlock = await time.latestBlock();

    });

    it('test depositFor', async function () {
        let initLockBalanceAmount;
        let initLockBalanceEnd;

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
    it('test transferFrom tokenId1 -> tokenId2', async function () {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1'), parseInt(eta));

        await lock.connect(seObject).createLock(toWei('1'), parseInt(eta));


        expect(await lock.balanceOf(owner.address)).to.be.eq(1);
        expect(await lock.balanceOf(seObject.address)).to.be.eq(1);
        await lock.transferFrom(owner.address, seObject.address, 1);
        expect(await lock.balanceOf(seObject.address)).to.be.eq(2);
        expect(await lock.balanceOf(owner.address)).to.be.eq(0);


    });
    it('test transferFrom tokenId1 -> tokenId2 -> tokenId3', async function () {
        let eta = time.duration.days(1);
        await lock.createLock(toWei('1'), parseInt(eta));
        await lock.connect(seObject).createLock(toWei('1'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));
        expect(await lock.tokenOfOwnerByIndex(owner.address, 0)).to.be.eq(1);

        await lock.transferFrom(owner.address, seObject.address, 1);
        expect(await lock.tokenOfOwnerByIndex(seObject.address, 0)).to.be.eq(2);

        expect(await lock.balanceOf(owner.address)).to.be.eq(0);
        expect(await lock.balanceOf(seObject.address)).to.be.eq(2);
        await lock.connect(seObject).transferFrom(seObject.address, dev.address, 1);
        expect(await lock.tokenOfOwnerByIndex(dev.address, 0)).to.be.eq(3);
        expect(await lock.balanceOf(dev.address)).to.be.eq(2);
        await lock.connect(seObject).transferFrom(seObject.address, dev.address, 2);
        expect(await lock.balanceOf(dev.address)).to.be.eq(3);

        await lock.connect(dev).transferFrom(dev.address, owner.address, 1);
        expect(await lock.balanceOf(dev.address)).to.be.eq(2);
        expect(await lock.balanceOf(owner.address)).to.be.eq(1);


    });
    it('test addBoosts and removeBoosts ', async function () {
        expect(await lock.boosts(owner.address)).to.be.eq(false);
        await lock.addBoosts(owner.address);

        expect(await lock.boosts(owner.address)).to.be.eq(true);

        await lock.removeBoosts(owner.address);
        expect(await lock.boosts(owner.address)).to.be.eq(false);

    });

    it("test setApprovalForAll", async () => {
        await lock.setApprovalForAll(seObject.address, true);

        let isApproved = await lock.isApprovedForAll(owner.address, owner.address);
        expect(isApproved).to.be.eq(false);
        isApproved = await lock.isApprovedForAll(owner.address, seObject.address);
        expect(isApproved).to.be.eq(true);
    })
    it("test balanceOfAtNFT", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('0.1'), parseInt(eta));

        let lockBlock = await time.latestBlock();
        console.log("lockBlock:" + lockBlock)
        let atNFT = await lock.balanceOfAtNFT(1, parseInt(lockBlock));

        console.log("atNFT:" + atNFT)
    })
    it("test totalSupply", async () => {
        let lockBlock = await time.latestBlock();
        console.log("lockBlock:" + lockBlock);

        expect(await lock.totalSupply()).to.be.eq(0);

        let eta = time.duration.days(7);
        await lock.createLock(toWei('0.1'), parseInt(eta));
        console.log("totalSupply:" + await lock.totalSupply());

    });
    it("test totalSupplyAt", async () => {
        let lockBlock = await time.latestBlock();
        console.log("lockBlock:" + lockBlock);

        let eta = time.duration.days(1);
        await lock.createLock(toWei('1'), parseInt(eta));

        let supplyAt = await lock.totalSupplyAt(parseInt(lockBlock));
        expect(supplyAt).to.be.eq(0);

        await time.advanceBlockTo(parseInt(lockBlock) + 10);
        lockBlock = await time.latestBlock();

        supplyAt = await lock.totalSupplyAt(parseInt(lockBlock));
        console.log("supplyAt:" + supplyAt);


    });
    it("test balanceOfNFT tokenid = 0", async () => {
        let eta = time.duration.days(1);
        await lock.createLock(toWei('1'), parseInt(eta));

        let nftAmount = await lock.balanceOfNFT(0);
        expect(nftAmount).to.be.eq(0);

        nftAmount = await lock.balanceOfNFT(1);
        console.log("nftAmount:" + nftAmount)

    });
    it("test merge", async () => {
        let eta = time.duration.days(1);
        await lock.createLock(toWei('1'), parseInt(eta));
        await lock.connect(seObject).createLock(toWei('1'), parseInt(eta));
        await lock.approve(seObject.address, 1);

        let amountOwner = await lock.locked(1);
        expect(amountOwner[0]).to.be.eq(toWei('1'));
        expect(await lock.balanceOf(owner.address)).to.be.eq(1);
        expect(await lock.balanceOf(seObject.address)).to.be.eq(1);
        await lock.transferFrom(owner.address, seObject.address, 1);
        amountOwner = await lock.locked(1);
        expect(amountOwner[0]).to.be.eq(toWei('1'));

        expect(await lock.balanceOf(owner.address)).to.be.eq(0);
        expect(await lock.balanceOf(seObject.address)).to.be.eq(2);

        await lock.connect(seObject).merge(1, 2);

        amountOwner = await lock.locked(1);
        expect(amountOwner[0]).to.be.eq(0);

        let amountSeObject = await lock.locked(2);
        expect(amountSeObject[0]).to.be.eq(toWei('2'));

    });
     it('Call the function removeBoosts', async () => {
        await lock.addBoosts(gaugeController.address);
        expect(await lock.boosts(gaugeController.address)).to.be.eq(true);
        await expect(lock.removeBoosts(gaugeController.address)).to.emit(lock, 'BoostRemoved')
            .withArgs(gaugeController.address);
        expect(await lock.boosts(gaugeController.address)).to.be.eq(false);
    });

    it('Call the function about approve and change operator',async () => {
         await lock.createLock(toWei("0.1"), ONE_DAT_DURATION); // Stake toWei("0.1") tra token
        firsttokenId = await lock.tokenId();
        await lock.createLockFor(toWei("0.1"), ONE_DAT_DURATION, dev.address);
        secondTokenId = await lock.tokenId();
        expect(firsttokenId).to.be.eq(1);
        expect(secondTokenId).to.be.eq(2);

        expect(await lock.isApprovedForAll(owner.address, owner.address)).to.be.eq(false);
        await expect(lock.setApprovalForAll(dev.address, true)).to.emit(lock, 'ApprovalForAll')
            .withArgs(owner.address, dev.address, true);
    });


});