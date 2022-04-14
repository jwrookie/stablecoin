/**
 * @description: This is the unit test case for the locker contract
 * @author: Lucifer
 * @data: 2022/04/11 19:52
 */
/** Introducing external modules */
const { time } = require('@openzeppelin/test-helpers');
// const { deployContract, MockProvider, solidity, Fixture } = require('ethereum-waffle');
const { ethers } = require("hardhat");
const { expect } = require("chai");
const { toWei } = web3.utils;
const { BigNumber } = require('ethers');
const { parse } = require('path');

contract('test Boost', async function() {
    // Const
    const BOOST = "Boost";
    const TESTORACLE = "TestOracle";
    const FAX = "FRAXShares";
    const FRAX = "FRAXStablecoin";
    const OPERATEBALE = "Operatable";
    const CHECKOPER = "CheckOper";
    const LOCKER = "Locker";
    const GAUGEFACTORY = "GaugeFactory"; // For instance Gauge
    const TESTERC20 = "TestERC20";
    const MOCKTOKEN = "MockToken";
    const TOKENPERBLOCK = 100000;
    const PERIOD = 10;
    const ALLOCPOINT = 100;
    const SURE = true;
    const REFUSE = false;
    const FIRST = "firObject";
    const SECOND = "seObject"
    const DECIMAL = 18;
    const TOWEI = "1";
    const NAME = "testName";
    const SYMBOL = "testSymbol";
    const APPROVE_NUMBER = "1000";
    const GAUGE = "Gauge";

    // Variable
    let testERC20
    let veToken
    let duration
    let firMockToken
    let seMockToken
    let oracle
    let lpToken
    let startBlock
    let currentGauge
    let currentTotalAllPoint;
    let poolInfoAllocPoint;
    let poolForGaugeMap;
    let gaugeMap;
    let currentLpPid;
    let poolInfoMap;
    let tokenSupply;

    // Contract instantiation
    var gaugeFactory
    var operatAble
    var checkOper
    var boost
    var fax
    var frax

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

    /**
     * To mint some object
     * @param {Contract} object 
     * @param {Address} addressName 
     * @param {Any} toWei
     * @returns 
    */
    async function mintAddress(object, addressName, toWei) {
        return object.mint(addressName, toWei)
    } 

    beforeEach(async function(){
        [owner, seObject] = await ethers.getSigners();
        const Operatable = await ethers.getContractFactory(OPERATEBALE);
        operatAble = await Operatable.deploy();
        const CheckOper = await ethers.getContractFactory(CHECKOPER);
        checkOper = await CheckOper.deploy(operatAble.address);

        // VeToken address
        const VeToken = await ethers.getContractFactory(LOCKER);
        const TestERC20 = await ethers.getContractFactory(TESTERC20);
        testERC20 = await TestERC20.deploy();
        duration = getDurationTime(1);
        veToken = await VeToken.deploy(testERC20.address, duration);
        // Approve
        await testERC20.connect(owner).approve(veToken.address, toWei(APPROVE_NUMBER));
        await testERC20.connect(seObject).approve(veToken.address, toWei(APPROVE_NUMBER));

        // Mint token
        mintAddress(testERC20, owner.address, toWei(TOWEI));

        // GaugeFactory address
        const GaugeFactory = await ethers.getContractFactory(GAUGEFACTORY);
        gaugeFactory = await GaugeFactory.deploy();

        // Oracle
        const Oracle = await ethers.getContractFactory(TESTORACLE);
        oracle = await Oracle.deploy();

        // Lp token
        const Frax = await ethers.getContractFactory(FRAX);
        frax = await Frax.deploy(NAME, SYMBOL);
        const Fax = await ethers.getContractFactory(FAX);
        fax = await Fax.deploy(NAME, SYMBOL, oracle.address);
        await fax.setFraxAddress(frax.address);
        await frax.setFXSAddress(fax.address);
        lpToken = fax.address;

        // Swap token address
        const MockToken = await ethers.getContractFactory(MOCKTOKEN);
        firMockToken = await MockToken.deploy(FIRST, FIRST, DECIMAL, TOWEI);
        seMockToken = await MockToken.deploy(SECOND, SECOND, DECIMAL, TOWEI);
        seLpToken = firMockToken.address;
        thLpToken = seMockToken.address;

        // Boost address
        startBlock = await time.latestBlock();
        const Boost = await ethers.getContractFactory(BOOST);
        boost = await Boost.deploy(
            checkOper.address,
            veToken.address,
            gaugeFactory.address,
            lpToken,
            TOKENPERBLOCK,
            parseInt(startBlock),
            PERIOD
        );

        // Gauges address ---> paramters: lptoken, vetoken, boost

        // Lp token add pool boost
        await frax.addPool(boost.address);
        await frax.addPool(owner.address);
    });

    it('test poolLength', async function(){
        var length = await boost.poolLength();
        assert.equal(parseInt(length), 0);

        // Call the function create gauge
        await boost.createGauge(lpToken, ALLOCPOINT, SURE);
        length = await boost.poolLength();
        assert.equal(parseInt(length), 1);
    });

    it('test createGauge', async function() {
        // The first value does not execute the function updatepools
        var lastRewardBlock;
        var poolInfoLpToken;
        var poolLastRewardBlock;
        var currentBlock;
        var currentLength;
        var isGaugeMap;

        // Mint function

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
        const CHANGE_ALLOC_POINT = 300;
        var currentLpPid;
        var targetAllocPoint;
        var length;
        
        // Get pid
        // currentGauge = await boost.createGauge(lpToken, ALLOCPOINT, SURE);
        currentLpPid = await boost.LpOfPid(await boost.poolForGauge(lpToken));

        // Get total alloc point
        currentGauge = await boost.createGauge(lpToken, ALLOCPOINT, SURE);
        currentTotalAllPoint = await boost.totalAllocPoint();
        console.log(checkInfoEq(currentTotalAllPoint, ALLOCPOINT)); // true

        // Get pool info alloc point
        poolInfoMap = await boost.poolInfo(currentLpPid);
        poolInfoAllocPoint = poolInfoMap[1];

        // Calculate targetAllocPoint
        targetAllocPoint = currentTotalAllPoint - poolInfoAllocPoint + CHANGE_ALLOC_POINT;
        console.log(targetAllocPoint)

        // Get pool length
        length = await boost.poolLength();
        console.log(checkInfoEq(parseInt(length), 1)); // true

        // Will execute once function and call the function
        await boost.set(currentLpPid, CHANGE_ALLOC_POINT, SURE);

        // Check
        poolInfoMap = await boost.poolInfo(currentLpPid);
        poolInfoAllocPoint = poolInfoMap[1];
        console.log(checkInfoEq(parseInt(poolInfoAllocPoint), CHANGE_ALLOC_POINT)); // true
    });

    it('test attachTokenToGauge', async function(){
        var tokenId;
        var gaugeLpToken;
        var lockBalanceMap;
        var lockBalanceAmount;
        var lockAttachments;

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
        var poolLastRewardBlock;
        var currentLpPid;
        var poolInfoMap;
        var poolInfoLastRewardBlock;
        var poolInfoAllocPoint;
        var currentTotalAllPoint;
        var currentBlock;
        var tokenSupply;
        var mul;
        var currentTokenReward;

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
    var currentSeGauge;
    var currentPoolLength;
    var firstTokenAddress;
    var seTokenAddress;
    var driverBalance;
    var i;
    var j;
    var doubleArray = new Array(2);
    var gaugeArray = new Array(2);
    var targetGauge;

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
    seTokenAddress = await veToken.ownerOf(1);

    for(i = 0; i <= currentPoolLength; i++) {
        doubleArray[i] = new Array();
        for(j = 0; j < currentPoolLength; j++) {
            doubleArray[i][j] = await veToken.ownerOf(j);
        }
    }

    doubleArray[0] = new Array();
    doubleArray[1] = new Array();
    doubleArray[0][0] = firstTokenAddress
    doubleArray[1][0] = seTokenAddress

	await boost.createGauge(lpToken, ALLOCPOINT, SURE);
	await boost.connect(seObject).createGauge(seLpToken, ALLOCPOINT, SURE);
	currentGauge = await boost.gauges(lpToken);
    currentSeGauge = await boost.gauges(seLpToken);
    gaugeArray[0] = currentGauge;
    gaugeArray[1] = currentSeGauge;
    currentPoolLength = await boost.poolLength();
	await boost.claimRewards(gaugeArray, doubleArray);

    // Get gauge value
    const Gauge = await ethers.getContractFactory(GAUGE);
    // Get object
    targetGauge = await Gauge.attach(currentGauge);

    driverBalance = await targetGauge.derivedBalances(currentGauge);
    console.log(driverBalance);
    });
    
    it('test AbstractBoost', async function(){

    });
});
