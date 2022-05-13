const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', async function () {
    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
    let initStartBlock;

    async function getDurationTime(day = 1) {
        if (undefined === typeof day || 0 >= day) {
            return;
        }
        return parseInt(await time.duration.days(day));
    }

    async function getPoolInfo(poolIndex = 0, structIndex = 0) {
        let poolInfoLength = await boost.poolLength();

        if (poolInfoLength > 0) {
            poolInfo = await boost.poolInfo(poolIndex);
            return poolInfo[structIndex];
        }
        return null;
    }

    async function getPoolVoteInfo(tokenId = 1, structIndex = 0) {
        if (0 === tokenId || undefined === typeof tokenId) {
            return null;
        }
        userInfoMap = await gaugeController.userPool(tokenId);
        return userInfoMap[structIndex];
    }

    async function getPoolVote() {
        let poolVoteArray = new Array();
        let poolVoteLength = await boost.poolLength();

        if (poolVoteLength > 0) {
            for (let i = 0; i < poolVoteLength; i++) {
                poolVoteArray.push(await getPoolInfo(i, 0));
            }
        }
        return poolVoteArray;
    }

    async function getWeights() {
        let weightsArray = new Array();
        let poolVoteLength = await boost.poolLength();

        if (poolVoteLength > 0) {
            for (let i = 0; i < poolVoteLength; i++) {
                poolInfo = await boost.poolInfo(i);
                weight = await boost.weights(poolInfo[0]);
                if (arguments.length > 0) {
                    if (i > arguments.length - 1) {
                        weight = arguments[arguments.length - 1];
                        weightsArray.push(weight);
                        continue;
                    }
                    weight = arguments[i];
                }
                weightsArray.push(weight);
            }
        }
        return weightsArray;
    }

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        // About boost and locker constructs
        const TestOperatable = await ethers.getContractFactory("Operatable");
        operatable = await TestOperatable.deploy();
        CheckOper = await ethers.getContractFactory("CheckPermission");
        checkOper = await CheckOper.deploy(operatable.address);

        // Swap token
        const TestOracle = await ethers.getContractFactory("TestOracle");
        testOracle = await TestOracle.deploy();
        const Frax = await ethers.getContractFactory("RStablecoin");
        frax = await Frax.deploy(checkOper.address, "frax", "frax");
        const Fxs = await ethers.getContractFactory("Stock");
        fxs = await Fxs.deploy(checkOper.address, "fxs", "fxs", testOracle.address);
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);
        await frax.transfer(dev.address, toWei("0.5"));
        await fxs.transfer(dev.address, toWei("0.5"));

        // Mint
        duration = await getDurationTime();
        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOper.address, fxs.address, duration);
        await fxs.connect(owner).approve(locker.address, toWei("0.5"));
        await fxs.connect(dev).approve(locker.address, toWei("0.5"));

        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(checkOper.address);

        startBlock = await time.latestBlock();
        initStartBlock = startBlock;

        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            locker.address,
            gaugeFactory.address,
            fxs.address,
            10000,
            parseInt(initStartBlock),
            10
        );

        const MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, BigNumber.from("1000000000000000000"));
        await usdc.mint(owner.address, toWei("1"));
        await usdc.mint(dev.address, toWei("1"));

        boostDurationTime = "10000";

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOper.address,
            boost.address,
            locker.address,
            boostDurationTime
        );
    });

    it('test Single user and single pool', async function () {
        // Create gauge
        expect(await boost.totalAllocPoint()).to.be.eq(0);
        expect(await boost.poolLength()).to.be.eq(0);
        // Create a pool
        await boost.createGauge(frax.address, 100000, false);
        expect(await boost.totalAllocPoint()).to.be.eq(100000);
        expect(await boost.poolLength()).to.be.eq(1);
        expect(await getPoolInfo(0, 0)).to.be.eq(frax.address);
        expect(await getPoolInfo(0, 1)).to.be.eq(100000);
        lastRewardBlock = await getPoolInfo(0, 2);
        expect(await boost.poolForGauge(await boost.gauges(frax.address))).to.be.eq(frax.address);
        expect(await boost.isGauge(await boost.gauges(frax.address))).to.be.eq(true);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        await gaugeController.setDuration(await getDurationTime());
        await boost.addController(gaugeController.address);
        await time.advanceBlockTo(parseInt(await time.latestBlock()) + 10);
        expect(await gaugeController.getPoolLength()).to.be.eq(0);
        await gaugeController.addPool(frax.address);
        gaugeAddress = await gaugeController.getPool(0);
        pid = await boost.lpOfPid(await gaugeController.getPool(0));
        expect(await gaugeController.getPoolLength()).to.be.eq(1);
        expect(await gaugeController.isPool(frax.address)).to.be.eq(true);
        expect(await gaugeController.totalWeight()).to.be.eq(0);
        expect(await gaugeController.weights(frax.address)).to.be.eq(0);
        expect(await boost.weights(await gaugeController.getPool(0))).to.be.eq(0);
        await gaugeController.vote(tokenId, frax.address);
        expect(await getPoolInfo(pid, 1)).to.be.eq(await gaugeController.weights(gaugeAddress));
        expect(await getPoolVoteInfo(tokenId)).to.be.eq(frax.address);
        expect(await gaugeController.weights(frax.address)).to.be.eq(await locker.balanceOfNFT(tokenId));
        expect(await gaugeController.totalWeight()).to.be.eq(await locker.balanceOfNFT(tokenId));
        expect(await gaugeController.usedWeights(tokenId)).to.be.eq(await locker.balanceOfNFT(tokenId));
    });

    it('test Single user vote and reset and vote', async function () {
        // Create gauge
        await boost.createGauge(frax.address, 100000, false);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        await gaugeController.setDuration(await getDurationTime());
        await boost.addController(gaugeController.address);
        await gaugeController.addPool(frax.address);
        expect(await gaugeController.getPoolLength()).to.be.eq(1);
        gaugeAddress = await gaugeController.getPool(0);
        pid = await boost.lpOfPid(await gaugeController.getPool(0));
        expect(await locker.voted(tokenId)).to.be.eq(false);
        await gaugeController.vote(tokenId, frax.address);
        expect(await getPoolVoteInfo(tokenId)).to.be.eq(frax.address);
        expect(await locker.voted(tokenId)).to.be.eq(true);
        expect(await getPoolInfo(pid, 1)).to.be.eq(await gaugeController.weights(gaugeAddress));
        lockerBalanceOfNFT = await locker.balanceOfNFT(tokenId);
        expect(await gaugeController.totalWeight()).to.be.eq(lockerBalanceOfNFT);
        expect(await gaugeController.usedWeights(tokenId)).to.be.eq(lockerBalanceOfNFT);

        await time.increase(time.duration.days(1));
        await gaugeController.reset(tokenId);
        expect(await gaugeController.totalWeight()).to.be.eq(0);
        expect(await gaugeController.usedWeights(tokenId)).to.be.eq(0);
        expect(await getPoolVoteInfo(tokenId)).to.be.eq(ZEROADDRESS);
        expect(await locker.voted(tokenId)).to.be.eq(false);
        expect(await boost.totalAllocPoint()).to.be.eq(await gaugeController.weights(gaugeAddress));
        expect(await getPoolInfo(pid, 1)).to.be.eq(await gaugeController.weights(gaugeAddress));
    });

    it('test Single user vote and reset and vote and weight = 0', async function () {
        // Create gauge
        await boost.createGauge(frax.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(1);
        pid = await boost.lpOfPid(frax.address);
        expect(pid).to.be.eq(0);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        poolVotesArray = await getPoolVote();
        expect(poolVotesArray).to.be.not.eq([]);
        weightsArray = await getWeights();
        expect(weightsArray).to.be.not.eq([]);
        await expectRevert(boost.vote(tokenId, poolVotesArray, weightsArray), "total weight is 0");
    });

    it('test Single user and more pools to vote will fail', async function () {
        // Create gauges
        await boost.createGauge(frax.address, 100000, false);
        await boost.createGauge(usdc.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(2);
        expect(await boost.totalAllocPoint()).to.be.eq(200000);
        expect(await getPoolInfo()).to.be.eq(frax.address);
        expect(await getPoolInfo(0, 1)).to.be.eq(100000);
        expect(await boost.lpOfPid(await getPoolInfo())).to.be.eq(0);
        expect(await boost.isGauge(await boost.gauges(await getPoolInfo(0, 0)))).to.be.eq(true);
        expect(await getPoolInfo(1, 0)).to.be.eq(usdc.address);
        expect(await getPoolInfo(1, 1)).to.be.eq(100000);
        expect(await boost.lpOfPid(await getPoolInfo(1, 0))).to.be.eq(1);
        expect(await boost.isGauge(await boost.gauges(await getPoolInfo(1, 0)))).to.be.eq(true);

        // Create locker
        await locker.addBoosts(gaugeController.address);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        // Start vote
        await gaugeController.setDuration(await getDurationTime());
        await gaugeController.vote(tokenId, await getPoolInfo());
        await expectRevert(gaugeController.vote(tokenId, await getPoolInfo(1, 0)), "next duration use");
        await time.increase(time.duration.days(1));
        await expectRevert(gaugeController.vote(tokenId, await getPoolInfo(1, 0)), "tokenId voted");
    });

    it('test Two user and single pool', async function () {
        let firstTokenId;

        // Create gauges
        await boost.createGauge(frax.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(1);
        expect(await getPoolInfo(0, 1)).to.be.eq(100000);
        expect(await boost.totalAllocPoint()).to.be.eq(100000);
        await boost.addController(gaugeController.address);
        await gaugeController.addPool(frax.address);

        // Create locker
        await locker.addBoosts(gaugeController.address);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        firstTokenId = tokenId;
        await locker.create_lock_for(toWei("0.1"), await getDurationTime(), dev.address);
        tokenId = await locker.tokenId();
        expect(firstTokenId).to.be.eq(1);
        expect(tokenId).to.be.eq(2);

        // Start vote
        expect(await gaugeController.usedWeights(firstTokenId)).to.be.eq(0);
        expect(await gaugeController.usedWeights(tokenId)).to.be.eq(0);
        expect(await gaugeController.totalWeight()).to.be.eq(0);
        expect(await locker.voted(firstTokenId)).to.be.eq(false);

        await gaugeController.vote(firstTokenId, await getPoolInfo());
        expect(await getPoolVoteInfo(firstTokenId)).to.be.eq(await getPoolInfo());
        firstTokenIdBalanceOfNft = await locker.balanceOfNFT(firstTokenId);
        expect(await gaugeController.weights(await gaugeController.getPool(0))).to.be.eq(firstTokenIdBalanceOfNft);
        expect(await gaugeController.totalWeight()).to.be.eq(firstTokenIdBalanceOfNft);
        expect(await gaugeController.usedWeights(firstTokenId)).to.be.eq(firstTokenIdBalanceOfNft);
        expect(await locker.voted(firstTokenId)).to.be.eq(true);
        expect(await boost.totalAllocPoint()).to.be.eq(firstTokenIdBalanceOfNft);
        tokenIdPid = await boost.lpOfPid(await gaugeController.getPool(0));
        expect(await getPoolInfo(tokenIdPid, 1)).to.be.eq(firstTokenIdBalanceOfNft);

        await gaugeController.connect(dev).vote(tokenId, await getPoolInfo());
        expect(await getPoolVoteInfo(tokenId)).to.be.eq(await getPoolInfo());
        tokenIdBalanceOfNft = await locker.balanceOfNFT(tokenId);
        sum = BigNumber.from(tokenIdBalanceOfNft).add(firstTokenIdBalanceOfNft)
        expect(await gaugeController.weights(await gaugeController.getPool(0))).to.be.eq(sum);
        expect(await gaugeController.totalWeight()).to.be.eq(sum);
        expect(await locker.voted(tokenId)).to.be.eq(true);
        // Affected by the first parameter -> function create_lock
        expect(await boost.totalAllocPoint()).to.be.eq(await getPoolInfo(tokenIdPid, 1));
    });

    it('test Single user to vote and reset and vote and mock weight datas', async function () {
        // Create gauge
        await boost.createGauge(frax.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(1);
        pid = await boost.lpOfPid(frax.address);
        expect(pid).to.be.eq(0);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.addBoosts(boost.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        
        poolVotesArray = await getPoolVote();
        expect(poolVotesArray).to.be.not.eq([]);
        weight = await locker.balanceOfNFT(tokenId);
        weightsArray = await getWeights(weight);
        expect(weightsArray).to.be.not.eq([]);
        await boost.vote(tokenId, poolVotesArray, weightsArray);
        expect(await locker.voted(tokenId)).to.be.eq(true);
        expect(await boost.poolVote(tokenId, 0)).to.be.eq(await getPoolInfo());
        expect(await boost.weights(await getPoolInfo())).to.be.eq(await boost.votes(tokenId, await getPoolInfo()));
        expect(await boost.totalWeight()).to.be.eq(await boost.weights(await getPoolInfo()));
        expect(await boost.usedWeights(tokenId)).to.be.eq(await boost.weights(await getPoolInfo()));
        // Reset
        expect(await boost.weights(await getPoolInfo())).to.be.eq(await boost.votes(tokenId, await getPoolInfo()));
        await boost.reset(tokenId);
        expect(await boost.totalWeight()).to.be.eq(0);
        expect(await boost.usedWeights(tokenId)).to.be.eq(0);
        // Vote
        await boost.addController(gaugeController.address);
        await gaugeController.vote(tokenId, frax.address);
    });

    it('test Single user to vote and more pools', async function () {
        // Create gauge
        await boost.createGauge(frax.address, 100000, false);
        await boost.createGauge(usdc.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(2);
        fraxPid = await boost.lpOfPid(frax.address);
        expect(fraxPid).to.be.eq(0);
        usdcPid = await boost.lpOfPid(usdc.address);
        expect(usdcPid).to.be.eq(1);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.addBoosts(boost.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        poolVotesArray = await getPoolVote();
        expect(poolVotesArray).to.be.not.eq([]);
        weight = await locker.balanceOfNFT(tokenId);
        weightsArray = await getWeights(weight);
        expect(weightsArray).to.be.not.eq([]);
        await boost.vote(tokenId, poolVotesArray, weightsArray);
        expect(await locker.voted(tokenId)).to.be.eq(true);
        expect(await boost.poolVote(tokenId, 0)).to.be.eq(await getPoolInfo());
        expect(await boost.poolVote(tokenId, 1)).to.be.eq(await getPoolInfo(1, 0));
        expect(await boost.weights(await getPoolInfo())).to.be.eq(await boost.votes(tokenId, await getPoolInfo()));
        expect(await boost.weights(await getPoolInfo(1, 0))).to.be.eq(await boost.votes(tokenId, await getPoolInfo(1, 0)));
        sumWeight = BigNumber.from(await boost.weights(await getPoolInfo())).add(await boost.weights(await getPoolInfo(1, 0)));
        expect(await boost.usedWeights(tokenId)).to.be.eq(sumWeight);
        expect(await boost.totalWeight()).to.be.eq(sumWeight);
    });

    it('test More users to vote and single pool', async function () {
        let firstTokenId;

        // Create gauge
        await boost.createGauge(frax.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(1);
        fraxPid = await boost.lpOfPid(frax.address);
        expect(fraxPid).to.be.eq(0);

        // Create locker
        await locker.addBoosts(gaugeController.address);
        await locker.addBoosts(boost.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        expect(await locker.boosts(boost.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        firstTokenId = tokenId;
        await locker.create_lock_for(toWei("0.1"), await getDurationTime(), dev.address);
        tokenId = await locker.tokenId();
        expect(firstTokenId).to.be.eq(1);
        expect(tokenId).to.be.eq(2);

        poolVotesArray = await getPoolVote();
        expect(poolVotesArray).to.be.not.eq([]);
        firstWeight = await locker.balanceOfNFT(firstTokenId);
        weightsArray = await getWeights(firstWeight);
        expect(weightsArray).to.be.not.eq([]);
        await boost.vote(firstTokenId, poolVotesArray, weightsArray);
        secondWeight = await locker.balanceOfNFT(tokenId);
        weightsArray = await getWeights(secondWeight);
        expect(weightsArray).to.be.not.eq([]);
        await boost.connect(dev).vote(tokenId, poolVotesArray, weightsArray);
        expect(await locker.voted(firstTokenId)).to.be.eq(true);
        expect(await locker.voted(tokenId)).to.be.eq(true);
        expect(await boost.poolVote(firstTokenId, 0)).to.be.eq(await getPoolInfo());
        expect(await boost.poolVote(tokenId, 0)).to.be.eq(await getPoolInfo());
        sumWeight = BigNumber.from(await boost.votes(firstTokenId, await getPoolInfo())).add(await boost.votes(tokenId, await getPoolInfo()));
        expect(await boost.weights(await getPoolInfo())).to.be.eq(sumWeight);
        expect(await boost.totalWeight()).to.be.eq(sumWeight);
    });

    it('test More users to vote more pools', async function () {
        let firstTokenId;

        // Create gauge
        await boost.createGauge(frax.address, 100000, false);
        await boost.createGauge(usdc.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(2);
        fraxPid = await boost.lpOfPid(frax.address);
        expect(fraxPid).to.be.eq(0);
        usdcPid = await boost.lpOfPid(usdc.address);
        expect(usdcPid).to.be.eq(1);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.addBoosts(boost.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        expect(await locker.boosts(boost.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        firstTokenId = tokenId;
        await locker.create_lock_for(toWei("0.2"), await getDurationTime(), dev.address);
        tokenId = await locker.tokenId();
        expect(firstTokenId).to.be.eq(1);
        expect(tokenId).to.be.eq(2);

        poolVotesArray = await getPoolVote();
        expect(poolVotesArray).to.be.not.eq([]);
        firstWeight = await locker.balanceOfNFT(firstTokenId);
        secondWeight = await locker.balanceOfNFT(tokenId);
        weightsArray = await getWeights(firstWeight, secondWeight);
        expect(weightsArray).to.be.not.eq([]);
        await boost.vote(firstTokenId, poolVotesArray, weightsArray);
        await boost.connect(dev).vote(tokenId, poolVotesArray, weightsArray);
        expect(await locker.voted(firstTokenId)).to.be.eq(true);
        expect(await locker.voted(tokenId)).to.be.eq(true);
        expect(await boost.poolVote(firstTokenId, 0)).to.be.eq(await getPoolInfo());
        expect(await boost.poolVote(firstTokenId, 1)).to.be.eq(await getPoolInfo(1, 0));
        expect(await boost.poolVote(tokenId, 0)).to.be.eq(await getPoolInfo());
        expect(await boost.poolVote(tokenId, 1)).to.be.eq(await getPoolInfo(1, 0));
        fraxSumWeight = BigNumber.from(await boost.votes(firstTokenId, await getPoolInfo())).add(await boost.votes(tokenId, await getPoolInfo()));
        usdcSumWeight = BigNumber.from(await boost.votes(firstTokenId, await getPoolInfo(1, 0))).add(await boost.votes(tokenId, await getPoolInfo(1, 0)));
        expect(await boost.weights(await getPoolInfo())).to.be.eq(fraxSumWeight);
        expect(await boost.weights(await getPoolInfo(1, 0))).to.be.eq(usdcSumWeight);
        expect(await boost.totalWeight()).to.be.eq(BigNumber.from(fraxSumWeight).add(usdcSumWeight));
    });
});