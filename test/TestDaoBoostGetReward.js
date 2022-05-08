const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Gauge', async function () {
    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
    let stakeToken;

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

    async function getPoolVoteInfo(tokenId = 1, structIndex = 0) {
        if (0 === tokenId || undefined === typeof tokenId) {
            return null;
        }
        userInfoMap = await gaugeController.userPool(tokenId);
        return userInfoMap[structIndex];
    }

    async function getUserInfo(userAddress, structIndex) {
        if (ZEROADDRESS === userAddress || undefined === typeof userAddress || null === userAddress) {
            return null;
        }
        userInfoMap = await gauge.userInfo(userAddress.address);
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
        await testERC20.connect(owner).approve(locker.address, toWei("0.5"));
        await testERC20.connect(dev).approve(locker.address, toWei("0.5"));

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
        stake = await MockToken.deploy("stake", "stake", 18, toWei("1"));
        await usdc.mint(owner.address, toWei("1"));
        await usdc.mint(dev.address, toWei("1"));
        await stake.mint(owner.address, toWei("1"));
        await stake.mint(dev.address, toWei("1"));
        mockUsdcPool = usdc;
        stakeToken = stake;

        boostDurationTime = await boost.duration();

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOper.address,
            boost.address,
            locker.address,
            boostDurationTime
        );

        // Create a pool
        await boost.createGauge(mockFraxPool.address, 100000, false);
        gaugeAddress = await boost.gauges(mockFraxPool.address);
        const Gauge = await ethers.getContractFactory("Gauge");
        gauge = await Gauge.attach(gaugeAddress);

        // await usdc.connect(owner).approve(gauge.address, toWei("1"));
        // await usdc.connect(dev).approve(gauge.address, toWei("1"));
        // await stake.connect(owner).approve(gauge.address, toWei("1"));
        // await stake.connect(dev).approve(gauge.address, toWei("1"));
    });

    it('test Single user deposit and get reward', async function () {
        await boost.addController(gaugeController.address); // Vote

        // Get token id -> parameter value is stake token
        await locker.addBoosts(gaugeController.address);
        await locker.create_lock(toWei("0.1"), await getDurationTime());
        tokenId = await locker.tokenId();
        expect(tokenId).to.be.eq(1);

        // About gaugeController
        await gaugeController.setDuration(await getDurationTime());
        await gaugeController.addPool(mockFraxPool.address);
        expect(await gaugeController.getPoolLength()).to.be.eq(1);
        expect(await gaugeController.getPool(0)).to.be.eq(mockFraxPool.address);

        // About gauge
        expect(await getUserInfo(owner, 0)).to.be.eq(0);
        expect(await getUserInfo(owner, 1)).to.be.eq(0);
        // await gauge.deposit(toWei("0.000001"), tokenId);
        // expect(await getUserInfo(owner, 0)).to.be.eq(toWei("0.000001"));
        // expect(await gauge.totalSupply()).to.be.eq(toWei("0.000001"));
        // expect(await gauge.tokenIds(owner.address)).to.be.eq(tokenId);
        // expect(await getPoolVoteInfo(tokenId)).to.be.eq(ZEROADDRESS);

        // Vote
        weight = await locker.balanceOfNFT(tokenId);
        await gaugeController.vote(tokenId, await gaugeController.getPool(0));

        // // Get reward
        // await time.advanceBlockTo(parseInt(await time.latestBlock()) + 100);
        // expect(await getUserInfo(owner, 0)).to.be.gt(0);
        // expect(await gauge.lastRewardBlock()).to.be.lt(parseInt(await time.latestBlock()));
        // console.log(await getUserInfo(owner, 0));
        // console.log(await getUserInfo(owner, 1));
        // console.log(await gauge.pendingMax(owner.address));
        // await gauge.getReward(owner.address);
        // console.log(await gauge.accTokenPerShare());
        // console.log(await usdc.balanceOf(owner.address));
    });
});