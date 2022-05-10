const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Locker operation', async function () {
    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
    const PERIOD = 10;
    let gauge;
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

    async function getUserInfo(gaugeName, userAddress, structIndex) {
        if (ZEROADDRESS === userAddress || undefined === typeof userAddress || null === userAddress) {
            return null;
        }
        userInfoMap = await gaugeName.userInfo(userAddress.address);
        return userInfoMap[structIndex];
    }

    async function getGauges(poolAddress, approveNumber = "1") {
        const Gauge = await ethers.getContractFactory("Gauge");
        gaugeAddress = await boost.gauges(poolAddress.address);
        gauge = await Gauge.attach(gaugeAddress);
        await poolAddress.approve(gauge.address, toWei(approveNumber));
        return gauge;
    }

    async function getBoostLpOfPid(gaugeAddress) {
        if (null === gaugeAddress || undefined === typeof gaugeAddress) {
            return -1;
        }

        gauge = await boost.gauges(gaugeAddress.address);
        pool = await boost.poolForGauge(gauge);
        return await boost.lpOfPid(pool);
    }

    async function getPoolForGauge(index) {
        let gaugeArray = new Array();
        let poolAddressArray = new Array();
        let poolForGaugeArray = new Array();
        let poolInfoLength = await boost.poolLength();

        if (poolInfoLength > 0) {
            for (let i = 0; i < poolInfoLength; i++) {
                poolInfo = await boost.poolInfo(i);
                gaugeArray.push(poolInfo[0]);
            }
        }

        if (gaugeArray.length === 0) {
            return Error("First you need to create a pool!");
        }

        for (let i = 0; i < gaugeArray.length; i++) {
            gaugeInfo = await boost.gauges(gaugeArray[i]);
            poolAddressArray.push(gaugeInfo);
        }

        for (let i = 0; i < poolAddressArray.length; i++) {
            poolForGaugeInfo = await boost.poolForGauge(poolAddressArray[i]);
            poolForGaugeArray.push(poolForGaugeInfo);
        }

        if (0 <= index) {
            return poolForGaugeArray[index];
        }
        return poolForGaugeArray;
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
        await fxs.setFraxAddress(frax.address);
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
        initStartBlock = parseInt(startBlock);

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

        await fxs.addPool(boost.address);

        const MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, BigNumber.from("1000000000000000000"));
        await usdc.mint(owner.address, toWei("1"));
        await usdc.mint(dev.address, toWei("1"));

        boostDurationTime = await boost.duration();

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOper.address,
            boost.address,
            locker.address,
            boostDurationTime
        );

        // Create a gauge pool
        await boost.createGauge(frax.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGauges(frax, "1");
    });

    it('test User lock there tokens can not transfer token', async function () {
        // Get token id
        await locker.addBoosts(gaugeController.address);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        await gaugeController.addPool(frax.address);
        expect(await getPoolForGauge(0)).to.be.eq(frax.address);
    });

    it('test User lock there tokens can not withdraw', async function () {

    });

    it('test User lock there tokens can not merge', async function () {

    });

    it('test Merge lock balance will lock shipping space', async function () {

    });
});