const {time} = require('@openzeppelin/test-helpers');
// const { deployContract, MockProvider, solidity, Fixture } = require('ethereum-waffle');
const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');
const {parse} = require('path');

contract('test Boost', async function () {


    async function getDurationTime(dayNumber) {
        if (0 >= dayNumber || dayNumber > 100) {
            return
        }
        return parseInt(time.duration.days(dayNumber))
    }

    async function checkInfoEq(anyThing, value) {
        if ("" == anyThing || null == anyThing) {
            return
        }
        if ("" == value || null == value) {
            return
        }
        if (expect(anyThing).to.be.eq(value)) {
            return true
        } else {
            return false
        }
    }

    async function checkInfoGt(anyThing, value) {
        if ("" == anyThing || null == anyThing) {
            return
        }
        if ("" == value || null == value) {
            return
        }
        if (expect(anyThing).to.be.gt(parseInt(value))) {
            return true
        } else {
            return false
        }
    }

    beforeEach(async function () {
        [owner, seObject] = await ethers.getSigners();
        const testOperatable = await ethers.getContractFactory("Operatable");
        operatable = await testOperatable.deploy();
        // const CheckOper = await ethers.getContractFactory("CheckOper");
        // checkOper = await CheckOper.deploy(operatable.address);

        // VeToken address
        const VeToken = await ethers.getContractFactory("Locker");
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        testERC20 = await TestERC20.deploy();
        duration = getDurationTime(1);
        veToken = await VeToken.deploy(operatable.address, testERC20.address, duration);
        // Approve
        await testERC20.connect(owner).approve(veToken.address, toWei("1000"));
        await testERC20.connect(seObject).approve(veToken.address, toWei("1000"));

        // Mint token
        await testERC20.mint(owner.address, toWei("1"));
        await testERC20.mint(seObject.address, toWei("1000"));

        // GaugeFactory address
        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(operatable.address);

        // Oracle
        const Oracle = await ethers.getContractFactory("TestOracle");
        oracle = await Oracle.deploy();

        // Lp token
        const Frax = await ethers.getContractFactory("RStablecoin");
        frax = await Frax.deploy(operatable.address, "frax", "frax");
        const Fax = await ethers.getContractFactory("Stock");
        fax = await Fax.deploy(operatable.address, "fxs", "fxs", oracle.address);
        await fax.setFraxAddress(frax.address);
        await frax.setFXSAddress(fax.address);
        lpToken = testERC20.address;

        // Swap token address
        const MockToken = await ethers.getContractFactory("MockToken");
        token0 = await MockToken.deploy("firstObject", "firstObject", 18, toWei("1"));
        token1 = await MockToken.deploy("secondObject", "secondObject", 18, toWei("1"));
        seLpToken = token0.address;
        thLpToken = token1.address;

        // Boost address
        startBlock = await time.latestBlock();
        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            operatable.address,
            veToken.address,
            gaugeFactory.address,
            fax.address,
            100000,
            parseInt(startBlock),
            10
        );

        // Lp token add pool boost
        await fax.addPool(boost.address);
        await fax.addPool(owner.address);
        await fax.addPool(seObject.address);

        await fax.mint(seObject.address, toWei("100000"));
        await testERC20.mint(seObject.address, toWei("100000"));

        await veToken.addBoosts(boost.address);
    });

    it('test poolLength', async function () {
        length = await boost.poolLength();
        assert.equal(parseInt(length), 0);

        // Call the function create gauge
        await boost.createGauge(lpToken, 100, true);
        length = await boost.poolLength();
        assert.equal(parseInt(length), 1);
    });

    it('test createGauge', async function () {
        // Get lp pid
        currentLpPid = await boost.lpOfPid(lpToken);
        assert.equal(parseInt(currentLpPid), 0);

        // Call the function create gauge
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 10);
        await boost.createGauge(lpToken, 100, true);
        currentLength = await boost.poolLength();
        assert.equal(currentLength, 1);
        currentLpPid = await boost.lpOfPid(lpToken);
        assert.equal(parseInt(currentLpPid), (currentLength - 1));
        currentBlock = await time.latestBlock();
        lastRewardBlock = currentBlock;
        console.log(checkInfoGt(parseInt(currentBlock), startBlock)); // true

        // Get total alloc point value
        currentTotalAllPoint = await boost.totalAllocPoint();
        console.log(checkInfoEq(currentTotalAllPoint, 100)); // true

        // Get pool info
        poolInfoMap = await boost.poolInfo(currentLpPid);
        poolInfoLpToken = poolInfoMap[0];
        console.log(checkInfoEq(poolInfoLpToken, lpToken)); // true
        poolInfoAllocPoint = poolInfoMap[1];
        console.log(checkInfoEq(poolInfoAllocPoint, currentTotalAllPoint)); //true
        poolLastRewardBlock = poolInfoMap[2]; // Bignumber change
        console.log(checkInfoEq(parseInt(poolLastRewardBlock), parseInt(lastRewardBlock))); // true

        // Get gauge value
        gaugeMap = await boost.gauges(lpToken);
        poolForGaugeMap = await boost.poolForGauge(gaugeMap);
        console.log(checkInfoEq(lpToken, poolForGaugeMap));
        isGaugeMap = await boost.isGauge(gaugeMap);
        assert.equal(isGaugeMap, true);

        // Move block
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 10);
    });

    it('test set', async function () {


        // Get pid
        currentLpPid = await boost.lpOfPid(await boost.poolForGauge(lpToken));

        // Get total alloc point
        currentGauge = await boost.createGauge(lpToken, 100, true);
        currentTotalAllPoint = await boost.totalAllocPoint();
        console.log(checkInfoEq(currentTotalAllPoint, 100)); // true

        // Get pool info alloc point
        poolInfoMap = await boost.poolInfo(currentLpPid);
        poolInfoAllocPoint = poolInfoMap[1];

        // Calculate targetAllocPoint
        targetAllocPoint = currentTotalAllPoint - poolInfoAllocPoint + 300;
        console.log(targetAllocPoint);

        // Get pool length
        length = await boost.poolLength();
        console.log(checkInfoEq(parseInt(length), 1)); // true

        // Will execute once function and call the function
        await boost.set(currentLpPid, 300, true);

        // Check
        poolInfoMap = await boost.poolInfo(currentLpPid);
        poolInfoAllocPoint = poolInfoMap[1];
        console.log(checkInfoEq(parseInt(poolInfoAllocPoint), 300)); // true
    });
    it('test distribute', async function () {


        gaugeMap = await boost.gauges(lpToken);
        poolForGaugeMap = await boost.poolForGauge(gaugeMap);
        currentLpPid = await boost.lpOfPid(await boost.poolForGauge(lpToken));
        // Call the funtion create gauge
        currentGauge = await boost.createGauge(lpToken, 100, true);
        // Get the pool info
        poolInfoMap = await boost.poolInfo(0);
        poolInfoLastRewardBlock = poolInfoMap[2];
        // Current block
        currentBlock = await time.latestBlock();
        assert.equal(parseInt(poolInfoLastRewardBlock), parseInt(currentBlock));
        // Move block
        await time.advanceBlockTo(parseInt(currentBlock) + 10);
        poolInfoMap = await boost.poolInfo(0);
        poolInfoAllocPoint = poolInfoMap[1];
        poolInfoLastRewardBlock = poolInfoMap[2];
        currentBlock = await time.latestBlock();
        expect(parseInt(currentBlock)).to.be.gt(parseInt(poolInfoLastRewardBlock));

        // Get vetoken balance
        tokenSupply = await fax.balanceOf(owner.address);
        console.log(parseInt(tokenSupply));
        currentBlock = await time.latestBlock();
        mul = currentBlock - poolInfoLastRewardBlock;
        expect(parseInt(mul)).to.be.not.eq(0);

        // Get token reward value
        currentTotalAllPoint = await boost.totalAllocPoint();
        currentTokenReward = 100000 * mul * poolInfoAllocPoint / currentTotalAllPoint;

        await boost.updatePool(currentLpPid);

        // Get pool info
        currentBlock = await time.latestBlock();
        poolInfoMap = await boost.poolInfo(0);
        poolInfoLastRewardBlock = poolInfoMap[2];
        expect(parseInt(currentBlock)).to.be.eq(parseInt(poolInfoLastRewardBlock));
    });

    it('test claimRewards', async function () {
        // Parameters array gagues and double array

        gaugeLpToken = await boost.gauges(lpToken);
        tokenSupply = await frax.balanceOf(gaugeLpToken);
        tokenSupply = tokenSupply + 10;

        // Get duration
        duration = getDurationTime(1);

        // create token
        await veToken.create_lock(tokenSupply, duration);
        await veToken.create_lock_for(tokenSupply, duration, seObject.address);

        // Get two tokens address
        firstTokenAddress = await veToken.ownerOf(0);
        secondTokenAddress = await veToken.ownerOf(1);


        await boost.createGauge(lpToken, 100, true);
        await boost.connect(seObject).createGauge(seLpToken, 100, true);
        currentGauge = await boost.gauges(lpToken);
        currentSeGauge = await boost.gauges(seLpToken);
        let gaugeArray = new Array(2);
        gaugeArray[0] = currentGauge;
        gaugeArray[1] = currentSeGauge;
        currentPoolLength = await boost.poolLength();
        await boost.claimRewards(gaugeArray);

        // Get gauge value
        const Gauge = await ethers.getContractFactory("Gauge");
        // Get object
        targetGauge = await Gauge.attach(currentGauge);

    });

    it('test AbstractBoost getPoolVote', async function () {

        duration = getDurationTime(1);

        await veToken.connect(seObject).create_lock_for(toWei("1"), duration, seObject.address);

        await boost.createGauge(lpToken, 100, true);

        // Get gauge
        const Gauge = await ethers.getContractFactory("Gauge");

        currentGauge = await boost.gauges(lpToken);

        let temp = await Gauge.attach(currentGauge);

        await testERC20.connect(seObject).approve(temp.address, toWei("10000"));

        await temp.connect(seObject).deposit("1000", 1);

        expect((await temp.userInfo(seObject.address)).amount).to.be.eq(1000);

        await temp.connect(seObject).deposit("1000", 1);

        await temp.pending(seObject.address);

        await temp.connect(seObject).getReward(seObject.address);

        await boost.connect(seObject).vote(1, [fax.address], [toWei("1000")]);

        targetValue = await boost.getPoolVote(0);
    });

    it('test AbstractBoost poke', async function () {


        await boost.createGauge(lpToken, 100, true);

        await boost.gauges(lpToken);
        tokenSupply = await frax.balanceOf(gaugeLpToken);
        tokenSupply = tokenSupply + 10;

        duration = getDurationTime(1);

        await veToken.create_lock(tokenSupply, duration);

        userWeights = await boost.usedWeights(0);
        targetUserWeights = userWeights;
        expect(parseInt(targetUserWeights)).to.be.eq(0);

        await boost.weights(await boost.veToken());

        await boost.poke(0);
    });
});
