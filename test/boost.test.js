const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', () => {
    beforeEach(async () => {

        [owner, dev, addr1] = await ethers.getSigners();
        // TestERC20 = await ethers.getContractFactory("TestERC20");
        // usdc = await TestERC20.deploy();
        // busd = await TestERC20.deploy();
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");
        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));

        CheckOper = await ethers.getContractFactory("CheckOper");
        checkOper = await CheckOper.deploy(operatable.address);


        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock)

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        //await fxs.poolMint(rewardPool.address,toWei('100'))

        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(fxs.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge = await Gauge.deploy(fxs.address, lock.address, owner.address);

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy();
        await gaugeFactory.createGauge(gauge.address, lock.address)


        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            "10000",
            parseInt(lastBlock),
            10
        );

        await frax.addPool(boost.address)
        await frax.addPool(owner.address)


    });
    // it('boost info', async () => {
    //
    //
    //
    //
    // });

    it('should createGauge correct', async () => {
        await usdc.approve(lock.address, toWei('1000'))

        await boost.createGauge(usdc.address, "100", true);
        // expect(await boost.poolLength()).to.be.eq(1);


    });


});