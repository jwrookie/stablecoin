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
    const TOWEI = toWei("10");
    const NAME = "testName";
    const SYMBOL = "testSymbol";

    // Variable
    let testERC20
    let veToken
    let duration
    let firMockToken
    let seMockToken
    let oracle
    let toatlAllocPoint
    let poolInfo
    let LpOfPid
    let pools
    let gauges
    let poolForGauge
    let isGauge
    let latestBlock
    let startBlock

    // Contract instantiation
    var gaugeFactory
    var operatAble
    var testOracle
    var checkOper
    var boost
    var lock
    var fax
    var frax
    var mockToken

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

    async function getIntBlock() {
        var temp = await time.latestBlock()
        return parseInt(temp)
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
        if(expect(value).to.be.eq(value)) {
            return true
        }else{
            return false
        }
    }

    beforeEach(async function(){
        [owner] = await ethers.getSigners();
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

        // GaugeFactory address
        const GaugeFactory = await ethers.getContractFactory(GAUGEFACTORY);
        gaugeFactory = await GaugeFactory.deploy();

        // Gauges address ---> paramters: lptoken, vetoken, boost

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

        // Swap token address
        const MockToken = await ethers.getContractFactory(MOCKTOKEN);
        firMockToken = await MockToken.deploy(FIRST, FIRST, DECIMAL, TOWEI);
        seMockToken = await MockToken.deploy(SECOND, SECOND, DECIMAL, TOWEI);
        duration = getDurationTime(1);
        console.log(parseInt(duration));

        // Boost address
    });

    it('test poolLength', async function(){
    });
});
