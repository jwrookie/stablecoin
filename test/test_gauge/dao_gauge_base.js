const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Gauge', async function () {
    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
    const period = 10;
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

    async function getGaugesInfo() {
        let gaugeArray = new Array();
        let poolInfoLength = await boost.poolLength();

        if (poolInfoLength === 0) {
            return Error("First need to create a gauge!");
        }

        for (let i = 0; i < poolInfoLength; i++) {
            poolAddress = await boost.poolInfo(i);
            gaugesInfo = await boost.gauges(poolAddress[0]);
            gaugeArray.push(gaugesInfo);
        }

        return gaugeArray;
    }

    async function getBoostLpOfPid(poolAddress) {
        if (null === poolAddress || undefined === poolAddress || poolAddress === ZEROADDRESS) {
            return Error("Unknow gauge for pool!");
        }

        gauge = await getGaugesInfo();

        for (let i = 0; i < gauge.length; i++) {
            pool = await boost.poolForGauge(gauge[i]);
            if (pool === poolAddress.address) {
                return await boost.lpOfPid(pool)
            }
        }

        return Error("The address of the pool was not added to struct of poolInfo!");
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

        boostDurationTime = "10000";

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOper.address,
            boost.address,
            locker.address,
            boostDurationTime
        );
    });

    it('test Single user deposit and get reward', async function () {
        // Create a pool
        await boost.createGauge(frax.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        await gaugeController.addPool(frax.address);
        gauge = await getGauges(frax, "1");

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.createLock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        // About gauge
        expect(await gauge.tokenPerBlock()).to.be.eq(0);
        await gauge.deposit(toWei("0.000001"));

        // Vote
        await gaugeController.vote(tokenId, await gaugeController.getPool(0));
        expect(await gauge.tokenPerBlock()).to.be.gt(0);
        // Get reward
        accTokenPerShare = await gauge.accTokenPerShare();
        pendingAmount = await gauge.pendingMax(owner.address);
        expect(pendingAmount).to.be.gt(0);
        initFxsBalanceOfOwner = await fxs.balanceOf(owner.address);
        initGaugeTokenPerBlock = await gauge.tokenPerBlock();
        beforeGetRewardTokenPerBlock = await gauge.tokenPerBlock();
        pendingAmount = await gauge.pendingMax(owner.address);
        boostAmount = await fxs.balanceOf(boost.address);
        gaugeAmount = await fxs.balanceOf(gauge.address);
        allowance=await fxs.allowance(boost.address,gauge.address);

        await gauge.getReward(owner.address);
        expect(await fxs.balanceOf(owner.address)).to.be.gt(initFxsBalanceOfOwner);
        expect(await getUserInfo(gauge, owner, 1)).to.be.gt(0);
        expect(await gauge.tokenPerBlock()).to.be.eq(beforeGetRewardTokenPerBlock);
    });

    it('test Update fxs balance will be big', async function () {
        let gauge;

        // Create a pool
        await boost.createGauge(frax.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGauges(frax, "1");

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.createLock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        // About gaugeController
        await gaugeController.setDuration(await getDurationTime());
        await gaugeController.addPool(frax.address);

        await gauge.deposit(toWei("0.000001"));

        // Get reward
        beforeGetRewardBalanceOfFxs = await fxs.balanceOf(owner.address);
        getBlock = parseInt(await time.latestBlock());
        await boost.updatePool(await getBoostLpOfPid(frax));
        await gauge.getReward(owner.address);
        afterGetRewardBalanceOfFxs = await fxs.balanceOf(owner.address);
        updateBlock = parseInt(await time.latestBlock()) - getBlock;
        afterGetRewardBalanceOfFxs = await fxs.balanceOf(owner.address);
        updateBlock = parseInt(await time.latestBlock()) - getBlock;
        updateFxsBalanceOfOwner = await fxs.balanceOf(owner.address) - beforeGetRewardBalanceOfFxs;

        getCurrentBlock = parseInt(await time.latestBlock());
        await gaugeController.vote(tokenId, await gaugeController.getPool(0));
        await gauge.getReward(owner.address);
        subBlock = parseInt(await time.latestBlock()) - getCurrentBlock;
        subFxsBalanceOfOwner = await fxs.balanceOf(owner.address) - beforeGetRewardBalanceOfFxs;
        expect(subBlock).to.be.eq(updateBlock);
        expect(subFxsBalanceOfOwner).to.be.gt(updateFxsBalanceOfOwner);
    });

    it('test Single user deposit and vote and get reward and reduce block', async function () {
        // Create a pool
        await boost.createGauge(frax.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGauges(frax, "1");

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.createLock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        expect(tokenId).to.be.eq(1);

        // About gaugeController
        await gaugeController.setDuration(await getDurationTime());
        await gaugeController.addPool(frax.address);

        expect(await gauge.tokenPerBlock()).to.be.eq(0);
        await gauge.deposit(toWei("0.000001"));
        expect(await getUserInfo(gauge, owner, 0)).to.be.eq(toWei("0.000001"));

        // Set reduce config
        expect(parseInt(await boost.periodEndBlock())).to.be.eq(initStartBlock + period);
        // Waiting block
        await time.advanceBlockTo(parseInt(await time.latestBlock()) + 20);
        currentBlock = parseInt(await time.latestBlock());
        expect(currentBlock).to.be.gt(initStartBlock);
        expect(currentBlock).to.be.gt(parseInt(await boost.periodEndBlock()));

        // Vote
        await gaugeController.vote(tokenId, await gaugeController.getPool(0));
        expect(await gauge.tokenPerBlock()).to.be.gt(0);

        // Get reward
        await gauge.getReward(owner.address);
        expect(await gauge.tokenPerBlock()).to.be.eq(await boost.minTokenReward());
    });

    it('test Single user deposit and vote and get reward and than tokenperblock change to eighty percent', async function () {
        let gauge;
        let currentBlock;

        // Create a pool
        await boost.createGauge(frax.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGauges(frax, "1");

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.createLock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        expect(tokenId).to.be.eq(1);

        // About gaugeController
        await gaugeController.setDuration(await getDurationTime());
        await gaugeController.addPool(frax.address);

        expect(await gauge.tokenPerBlock()).to.be.eq(0);
        await gauge.deposit(toWei("0.000001"));

        // Set reduce config
        expect(parseInt(await boost.periodEndBlock())).to.be.eq(initStartBlock + period);
        // Waiting block
        await time.advanceBlockTo(parseInt(await time.latestBlock()) + 20);
        currentBlock = parseInt(await time.latestBlock());

        // About reduce
        await boost.setMinTokenReward(5000);
        await gauge.getReward(owner.address);
        expect(await gauge.tokenPerBlock()).to.be.eq(10000 * 0.8);
    });

    it('test Single user deposit and vote and get reward', async function () {
        let gauge;

        // Create a pool
        await boost.createGauge(frax.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGauges(frax, "1");

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.addBoosts(boost.address);
        await locker.createLock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        expect(tokenId).to.be.eq(1);

        // About gaugeController
        await gaugeController.setDuration(await getDurationTime());
        await gaugeController.addPool(frax.address);

        await gauge.deposit(toWei("0.000001"));
        expect(await gauge.tokenPerBlock()).to.be.eq(0);

        // Vote
        poolVotesArray = await getPoolVote();
        expect(poolVotesArray).to.be.not.eq([]);
        weight = await locker.balanceOfNFT(tokenId);
        weightsArray = await getWeights(weight);
        expect(weightsArray).to.be.not.eq([]);
        expect(await gauge.tokenPerBlock()).to.be.eq(0);
        await boost.vote(tokenId, poolVotesArray, weightsArray);
        expect(await gauge.tokenPerBlock()).to.be.eq(await boost.minTokenReward());

        // Get reward
        initFxsBalanceOfOwner = await fxs.balanceOf(owner.address);
        await gauge.getReward(owner.address);
        expect(await fxs.balanceOf(owner.address)).to.be.gt(initFxsBalanceOfOwner);
        expect(await gauge.tokenPerBlock()).to.be.eq(await boost.minTokenReward());
    });

    it('test Single user and more gauges to vote and get reward will fail', async function () {
        let fraxGauge;
        let usdcGauge;

        // Create a pool
        await boost.createGauge(frax.address, 100000, false);
        await boost.createGauge(usdc.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        fraxGauge = await getGauges(frax, "1");
        usdcGauge = await getGauges(usdc, "1");

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.createLock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();

        // About gaugeController
        await gaugeController.setDuration(await getDurationTime());
        await gaugeController.addPool(frax.address);
        await gaugeController.addPool(usdc.address);

        await fraxGauge.deposit(toWei("0.000001"));
        await usdcGauge.deposit(toWei("0.000001"));

        // Vote
        expect(await getUserInfo(fraxGauge, owner, 1)).to.be.eq(0);
        expect(await getUserInfo(usdcGauge, owner, 1)).to.be.eq(0);
        await gaugeController.vote(tokenId, await gaugeController.getPool(0));
        await expectRevert(gaugeController.vote(tokenId, await gaugeController.getPool(1)), "next duration use");
    });
});