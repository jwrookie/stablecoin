const { time } = require('@openzeppelin/test-helpers');
// const { deployContract, MockProvider, solidity, Fixture } = require('ethereum-waffle');
const { ethers } = require("hardhat");
const { expect } = require("chai");
const { toWei } = web3.utils;
const { BigNumber } = require('ethers');
const { parse } = require('path');

contract('test Boost', async function() {
    const TOKENPERBLOCK = 100000;
    const PERIOD = 10;
    const ALLOCPOINT = 100;
    const SURE = true;

    let testERC20;
    let veToken;
    let duration;
    let firstMockToken;
    let secondMockToken;
    let oracle;
    let lpToken;
    let startBlock;
    let currentGauge;
    let currentTotalAllPoint;
    let poolInfoAllocPoint;
    let poolForGaugeMap;
    let gaugeMap;
    let currentLpPid;
    let poolInfoMap;
    let tokenSupply;
    let gaugeFactory;
    let operatAble;
    let checkOper;
    let boost;
    let fax;
    let frax;
    let length;
    let currentBlock;
    let gaugeLpToken;
    let targetGauge;
    let weightArray = new Array(1);
    let tokenAddress;

    /**
     * Get duration time
     * @param {Number} dayNumber 
     * @returns 
    */
    async function getDurationTime(dayNumber) {
        if(0 >= dayNumber || dayNumber > 100) {
            return
        }
        return parseInt(time.duration.days(dayNumber))
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
        if(expect(anyThing).to.be.eq(value)) {
            return true
        }else{
            return false
        }
    }

    /**
     * This is a function about check information greater than information
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
        if(expect(anyThing).to.be.gt(parseInt(value))) {
            return true
        }else{
            return false
        }
    }

    beforeEach(async function(){
        [owner, seObject] = await ethers.getSigners();
        const Operatable = await ethers.getContractFactory("Operatable");
        operatAble = await Operatable.deploy();
        const CheckOper = await ethers.getContractFactory("CheckOper");
        checkOper = await CheckOper.deploy(operatAble.address);

        // VeToken address
        const VeToken = await ethers.getContractFactory("Locker");
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        testERC20 = await TestERC20.deploy();
        duration = getDurationTime(1);
        veToken = await VeToken.deploy(testERC20.address, duration);
        // Approve
        await testERC20.connect(owner).approve(veToken.address, toWei("1000"));
        await testERC20.connect(seObject).approve(veToken.address, toWei("1000"));

        // Mint token
        await testERC20.mint(owner.address, toWei("1"));
        await testERC20.mint(seObject.address, toWei("1000"));

        // GaugeFactory address
        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy();

        // Oracle
        const Oracle = await ethers.getContractFactory("TestOracle");
        oracle = await Oracle.deploy();

        // Lp token
        const Frax = await ethers.getContractFactory("FRAXStablecoin");
        frax = await Frax.deploy("testName", "testSymbol");
        const Fax = await ethers.getContractFactory("FRAXShares");
        fax = await Fax.deploy("testName", "testSymbol", oracle.address);
        await fax.setFraxAddress(frax.address);
        await frax.setFXSAddress(fax.address);
        lpToken = testERC20.address;

        // Swap token address
        const MockToken = await ethers.getContractFactory("MockToken");
        firstMockToken = await MockToken.deploy("firstObject", "firstObject", 18, toWei("1"));
        secondMockToken = await MockToken.deploy("secondObject", "secondObject", 18, toWei("1"));
        seLpToken = firstMockToken.address;
        thLpToken = secondMockToken.address;

        // Boost address
        startBlock = await time.latestBlock();
        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            veToken.address,
            gaugeFactory.address,
            fax.address,
            TOKENPERBLOCK,
            parseInt(startBlock),
            PERIOD
        );

        // Lp token add pool boost
        await frax.addPool(boost.address);
        await frax.addPool(owner.address);
        await frax.addPool(seObject.address);

        await fax.mint(seObject.address, toWei("100000"));
        await testERC20.mint(seObject.address, toWei("100000"));

        await veToken.setVoter(boost.address);
    });

    it('test poolLength', async function(){
        length = await boost.poolLength();
        assert.equal(parseInt(length), 0);

        // Call the function create gauge
        await boost.createGauge(lpToken, ALLOCPOINT, SURE);
        length = await boost.poolLength();
        assert.equal(parseInt(length), 1);
    });

    it('test createGauge', async function() {
        let lastRewardBlock;
        let poolInfoLpToken;
        let poolLastRewardBlock;
        let currentLength;
        let isGaugeMap;

        // Get lp pid
        currentLpPid = await boost.LpOfPid(lpToken);
        assert.equal(parseInt(currentLpPid), 0);

        // Call the function create gauge
        currentBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(currentBlock) + 10);
        await boost.createGauge(lpToken, ALLOCPOINT, SURE);
        currentLength = await boost.poolLength();
        assert.equal(currentLength, 1);
        currentLpPid = await boost.LpOfPid(lpToken);
        assert.equal(parseInt(currentLpPid), (currentLength - 1));
        currentBlock = await time.latestBlock();
        lastRewardBlock = currentBlock;
        console.log(checkInfoGt(parseInt(currentBlock), startBlock)); // true

        // Get total alloc point value
        currentTotalAllPoint = await boost.totalAllocPoint();
        console.log(checkInfoEq(currentTotalAllPoint, ALLOCPOINT)); // true

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

    it('test set', async function(){
        let targetAllocPoint;
        
        // Get pid
        currentLpPid = await boost.LpOfPid(await boost.poolForGauge(lpToken));

        // Get total alloc point
        currentGauge = await boost.createGauge(lpToken, ALLOCPOINT, SURE);
        currentTotalAllPoint = await boost.totalAllocPoint();
        console.log(checkInfoEq(currentTotalAllPoint, ALLOCPOINT)); // true

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
        await boost.set(currentLpPid, 300, SURE);

        // Check
        poolInfoMap = await boost.poolInfo(currentLpPid);
        poolInfoAllocPoint = poolInfoMap[1];
        console.log(checkInfoEq(parseInt(poolInfoAllocPoint), 300)); // true
    });

    it('test attachTokenToGauge', async function(){
        let lockBalanceMap;
        let lockBalanceAmount;
        let lockAttachments;

        duration = getDurationTime(1);

        // Get supply
        gaugeLpToken = await boost.gauges(lpToken);
        tokenSupply = await frax.balanceOf(gaugeLpToken);
        tokenSupply = tokenSupply + 10;

        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day

        // Get tokenId before add you need to approve
        await veToken.create_lock(tokenSupply, duration);

        // Get attachments
        lockAttachments = await veToken.attachments(0);
        assert.equal(parseInt(lockAttachments), 0);

        // Get lockbalance
        lockBalanceMap = await veToken.locked(0);
        lockBalanceAmount = lockBalanceMap[0];
        console.log(parseInt(lockBalanceAmount));
    });

    it('test distribute', async function(){
        let poolInfoLastRewardBlock;
        let mul;
        let currentTokenReward;

        gaugeMap = await boost.gauges(lpToken);
        poolForGaugeMap = await boost.poolForGauge(gaugeMap);
        currentLpPid = await boost.LpOfPid(await boost.poolForGauge(lpToken));
        // Call the funtion create gauge
        currentGauge = await boost.createGauge(lpToken, ALLOCPOINT, SURE);
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
        currentTokenReward = TOKENPERBLOCK * mul * poolInfoAllocPoint / currentTotalAllPoint;

        await boost.updatePool(currentLpPid);

        // Get pool info
        currentBlock = await time.latestBlock();
        poolInfoMap = await boost.poolInfo(0);
        poolInfoLastRewardBlock = poolInfoMap[2];
        expect(parseInt(currentBlock)).to.be.eq(parseInt(poolInfoLastRewardBlock));
    });

    it('test claimRewards', async function() {
    // Parameters array gagues and double array
    let currentSeGauge;
    let currentPoolLength;
    let firstTokenAddress;
    let secondTokenAddress;
    let driverBalance;
    let doubleArray = new Array(2);
    let gaugeArray = new Array(2);

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

    for(let i = 0; i <= currentPoolLength; i++) {
        doubleArray[i] = new Array();
        for(let j = 0; j < currentPoolLength; j++) {
            doubleArray[i][j] = await veToken.ownerOf(j);
        }
    }

    doubleArray[0] = new Array();
    doubleArray[1] = new Array();
    doubleArray[0][0] = firstTokenAddress;
    doubleArray[1][0] = secondTokenAddress;

	await boost.createGauge(lpToken, ALLOCPOINT, SURE);
	await boost.connect(seObject).createGauge(seLpToken, ALLOCPOINT, SURE);
	currentGauge = await boost.gauges(lpToken);
    currentSeGauge = await boost.gauges(seLpToken);
    gaugeArray[0] = currentGauge;
    gaugeArray[1] = currentSeGauge;
    currentPoolLength = await boost.poolLength();
	await boost.claimRewards(gaugeArray, doubleArray);

    // Get gauge value
    const Gauge = await ethers.getContractFactory("Gauge");
    // Get object
    targetGauge = await Gauge.attach(currentGauge);

    driverBalance = await targetGauge.derivedBalances(currentGauge);
    });
    
    it('test AbstractBoost getPoolVote', async function(){
        // await firstMockToken.connect(seObject).approve(veToken.address, toWei("100000000"));

        // // Get gauge value
        // const Gauge = await ethers.getContractFactory("Gauge");
        // // Get object
        // currentGauge = await boost.gauges(firstMockToken.address);
        // targetGauge = await Gauge.attach(currentGauge);
        // // currentGauge = await boost.createGauge(lpToken, ALLOCPOINT, SURE);

        // await targetGauge.connect(owner).deposit("1000", 1);

        // // gaugeLpToken = await boost.gauges(lpToken);
        // tokenSupply = await frax.balanceOf(gaugeLpToken);
        // tokenSupply = tokenSupply + 10;

        // // duration = getDurationTime(1);

        // await veToken.connect(seObject).create_lock_for(toWei("1"), parseInt(tokenSupply), seObject.address);

        // // await targetGauge.connect(owner).earned(fax.address, owner.address);

        // // await targetGauge.connect(owner).getReward(owner.address, [fax.address]);

        // // tokenAddress = await boost.getPoolVote(0);

        // // console.log(tokenAddress);

        // // weightArray[0] = parseInt(await boost.weights(await boost.veToken()));

        // // console.log(weightArray);

        // // // await boost.vote(1, [firstMockToken.address], [toWei("10000")]);

        // // console.log(await boost.weights(lpToken));

        // // expect(0).to.be.eq(tokenAddress.length);

        // await fax.connect(seObject).approve(veToken, toWei("1000000"));

        duration = getDurationTime(1);

        await veToken.connect(seObject).create_lock_for(toWei("1"), duration, seObject.address);

        await boost.createGauge(lpToken, ALLOCPOINT, SURE);

        // Get gauge
        const Gauge = await ethers.getContractFactory("Gauge");

        currentGauge = await boost.gauges(lpToken);

        let temp = await Gauge.attach(currentGauge);

        await testERC20.connect(seObject).approve(temp.address, toWei("10000"));

        await temp.connect(seObject).deposit("1000", 1);

        expect(await temp.balanceOf(seObject.address)).to.be.eq(1000);

        await temp.connect(seObject).deposit("1000", 1);

        await temp.earned(fax.address, seObject.address);

        await temp.connect(seObject).getReward(seObject.address, [fax.address]);

        await boost.connect(seObject).vote(1, [fax.address], [toWei("1000")]);
    });

    it('test AbstractBoost poke', async function() {
        let userWeights;
        let targetUserWeights;

        await boost.createGauge(lpToken, ALLOCPOINT, SURE);

        await boost.gauges(lpToken);
        tokenSupply = await frax.balanceOf(gaugeLpToken);
        tokenSupply = tokenSupply + 10;

        duration = getDurationTime(1);

        await veToken.create_lock(tokenSupply, duration);
        
        userWeights = await boost.usedWeights(0);
        targetUserWeights = userWeights;
        expect(parseInt(targetUserWeights)).to.be.eq(0);

        weightArray[0] = parseInt(await boost.weights(await boost.veToken()));

        await boost.poke(0);
    });

    it('test AbstractBoost vote', async function() {
        let targetPoolVote;
        let paramterArray = new Array(1);

        for(var i = 0; i < paramterArray.length; i++) {
            paramterArray[i] = i + 1;
        }

        tokenAddress = await boost.getPoolVote(0);

        boost.vote(0, tokenAddress, paramterArray);

    });
});
