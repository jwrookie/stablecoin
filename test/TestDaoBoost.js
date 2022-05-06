const {time} = require('@openzeppelin/test-helpers');
const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', async function () {
    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
    let initStartBlock;

    async function getDurationTime(day = 1) {
        if (undefined === typeof day || 0 === day) {
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
                weight = await boost.weights(poolInfo[0])
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

        const TestERC20 = await ethers.getContractFactory("TestERC20");
        testERC20 = await TestERC20.deploy();
        // Mint
        await testERC20.mint(owner.address, toWei("1"));
        await testERC20.mint(dev.address, toWei("1"));
        // Mint
        duration = await getDurationTime();
        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOper.address, testERC20.address, duration);

        // Swap token
        const TestOracle = await ethers.getContractFactory("TestOracle");
        testOracle = await TestOracle.deploy();
        const Frax = await ethers.getContractFactory("RStablecoin");
        frax = await Frax.deploy(checkOper.address, "frax", "frax");
        const Fxs = await ethers.getContractFactory("Stock");
        fxs = await Fxs.deploy(checkOper.address, "fxs", "fxs", testOracle.address);
        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);
        await frax.transfer(dev.address, toWei("0.5"));
        await fxs.transfer(dev.address, toWei("0.5"));
        mockFraxPool = frax;
        await testERC20.connect(owner).approve(locker.address, toWei("0.2"));
        await testERC20.connect(dev).approve(locker.address, toWei("0.2"));

        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(checkOper.address);

        startBlock = await time.latestBlock();
        initStartBlock = startBlock;

        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            locker.address,
            gaugeFactory.address,
            frax.address,
            10000,
            parseInt(initStartBlock),
            10
        );

        const MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, BigNumber.from("1000000000000000000"));
        await usdc.mint(owner.address, toWei("1"));
        await usdc.mint(dev.address, toWei("1"));
        mockUsdcPool = usdc;

        boostDurationTime = await boost.duration();

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOper.address,
            boost.address,
            locker.address,
            boostDurationTime
        );
    });

    it('test setDuration', async function () {
        expect(parseInt(await gaugeController.duration())).to.be.eq(await getDurationTime(7));
        await gaugeController.setDuration(await getDurationTime(3));
        expect(parseInt(await gaugeController.duration())).to.be.eq(await getDurationTime(3));
    });

    it('test Single user and single pool', async function () {
        // Create gauge
        expect(await boost.totalAllocPoint()).to.be.eq(0);
        expect(await boost.poolLength()).to.be.eq(0);
        // Create a pool
        await boost.createGauge(mockFraxPool.address, 100000, false);
        expect(await boost.totalAllocPoint()).to.be.eq(100000);
        expect(await boost.poolLength()).to.be.eq(1);
        expect(await getPoolInfo(0, 0)).to.be.eq(mockFraxPool.address);
        expect(await getPoolInfo(0, 1)).to.be.eq(100000);
        lastRewardBlock = await getPoolInfo(0, 2);
        expect(await boost.poolForGauge(await boost.gauges(mockFraxPool.address))).to.be.eq(mockFraxPool.address);
        expect(await boost.isGauge(await boost.gauges(mockFraxPool.address))).to.be.eq(true);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        await gaugeController.setDuration(await getDurationTime());
        await boost.addController(gaugeController.address);
        await time.advanceBlockTo(parseInt(await time.latestBlock()) + 10);
        expect(await gaugeController.getPoolLength()).to.be.eq(0);
        await gaugeController.addPool(mockFraxPool.address);
        gaugeAddress = await gaugeController.getPool(0);
        pid = await boost.lpOfPid(await gaugeController.getPool(0));
        expect(await gaugeController.getPoolLength()).to.be.eq(1);
        expect(await gaugeController.isPool(mockFraxPool.address)).to.be.eq(true);
        expect(await gaugeController.totalWeight()).to.be.eq(0);
        expect(await gaugeController.weights(mockFraxPool.address)).to.be.eq(0);
        expect(await boost.weights(await gaugeController.getPool(0))).to.be.eq(0);
        await gaugeController.vote(tokenId, mockFraxPool.address);
        expect(await getPoolInfo(pid, 1)).to.be.eq(await gaugeController.weights(gaugeAddress));
        expect(await gaugeController.userPool(tokenId)).to.be.eq(mockFraxPool.address);
        expect(await gaugeController.weights(mockFraxPool.address)).to.be.eq(await locker.balanceOfNFT(tokenId));
        expect(await gaugeController.totalWeight()).to.be.eq(await locker.balanceOfNFT(tokenId));
        expect(await gaugeController.usedWeights(tokenId)).to.be.eq(await locker.balanceOfNFT(tokenId));
    });

    it('test Vote and reset and vote', async function () {
        // Create gauge
        await boost.createGauge(mockFraxPool.address, 100000, false);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        await gaugeController.setDuration(await getDurationTime());
        await boost.addController(gaugeController.address);
        await gaugeController.addPool(mockFraxPool.address);
        expect(await gaugeController.getPoolLength()).to.be.eq(1);
        gaugeAddress = await gaugeController.getPool(0);
        pid = await boost.lpOfPid(await gaugeController.getPool(0));
        expect(await locker.voted(tokenId)).to.be.eq(false);
        await gaugeController.vote(tokenId, mockFraxPool.address);
        expect(await gaugeController.userPool(tokenId)).to.be.eq(mockFraxPool.address);
        expect(await locker.voted(tokenId)).to.be.eq(true);
        expect(await getPoolInfo(pid, 1)).to.be.eq(await gaugeController.weights(gaugeAddress));
        lockerBalanceOfNFT = await locker.balanceOfNFT(tokenId);
        expect(await gaugeController.totalWeight()).to.be.eq(lockerBalanceOfNFT);
        expect(await gaugeController.usedWeights(tokenId)).to.be.eq(lockerBalanceOfNFT);
        await gaugeController.reset(tokenId);
        expect(await gaugeController.totalWeight()).to.be.eq(0);
        expect(await gaugeController.usedWeights(tokenId)).to.be.eq(0);
        expect(await gaugeController.userPool(tokenId)).to.be.eq(ZEROADDRESS);
        expect(await locker.voted(tokenId)).to.be.eq(false);
        expect(await boost.totalAllocPoint()).to.be.eq(await gaugeController.weights(gaugeAddress));
        expect(await getPoolInfo(pid, 1)).to.be.eq(await gaugeController.weights(gaugeAddress));
    });

    it('test Single user vote and reset and vote', async function () {
        // Create gauge
        await boost.createGauge(mockFraxPool.address, 100000, false);
        expect(await boost.poolLength()).to.be.eq(1);
        pid = await boost.lpOfPid(mockFraxPool.address);
        expect(pid).to.be.eq(0);

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        expect(await boost.duration()).to.be.eq(await getDurationTime(7));
        poolVotesArray = await getPoolVote();
        expect(poolVotesArray).to.be.not.eq([]);
        weightsArray = await getWeights();
        expect(weightsArray).to.be.not.eq([]);
        // await gaugeController.vote(tokenId, await getPoolInfo());
        await boost.vote(tokenId, poolVotesArray, weightsArray);
    });
});