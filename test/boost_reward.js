const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Gauge', async function () {
    const ZEROADDRESS = "0x0000000000000000000000000000000000000000";
    const ONE_DAT_DURATION = 86400;

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
        await fxs.transfer(addr1.address, "299000000000000000000000000");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);
        await frax.transfer(dev.address, toWei("0.5"));
        await fxs.transfer(dev.address, toWei("0.5"));

        // Mint

        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOper.address, fxs.address, ONE_DAT_DURATION);

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
            toWei("3"),
            parseInt(initStartBlock),
            100
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
        await boost.createGauge(frax.address, "10", false);
        const Gauge = await ethers.getContractFactory("Gauge");
        gaugeAddress = await boost.gauges(frax.address);
        gauge = await Gauge.attach(gaugeAddress);
        await frax.approve(gauge.address, toWei("10000"));
        await locker.createLock(toWei("0.1"), ONE_DAT_DURATION);
        tokenId = await locker.tokenId();
    });
    it("update pool and use gauge", async function () {
        expect(await boost.tokenPerBlock()).to.be.eq(toWei("3"));
        await boost.updatePool(0);
        boostAmount = await fxs.balanceOf(boost.address);
        expect(boostAmount).to.be.eq(0);
        expect(await gauge.tokenPerBlock()).to.be.eq(0);
        accTokenPerShare = await gauge.accTokenPerShare();
        expect(accTokenPerShare).to.be.eq(0);
        await gauge.deposit(toWei("1"));
        expect(await gauge.tokenPerBlock()).to.be.eq(0);
        await expect(boost.updatePool(0)).to.emit(gauge, 'NotifyReward')
            .withArgs(boost.address, fxs.address, toWei("3"));

        expect(await boost.totalAllocPoint()).to.be.eq("10");
        poolInfo = await boost.poolInfo(0);
        expect(poolInfo[1]).to.be.eq("10");

        expect(await gauge.tokenPerBlock()).to.be.eq(toWei("3"));
        boostAmount = await fxs.balanceOf(boost.address);
        expect(boostAmount).to.be.eq("604800000000000000000000");
        pendingMax = await gauge.pendingMax(owner.address);
        pendingAmount = await gauge.pending(owner.address);
        boostAmount = await fxs.balanceOf(boost.address);
        gaugeAmount = await fxs.balanceOf(gauge.address);
        allowance = await fxs.allowance(boost.address, gauge.address);

        expect(pendingMax).to.be.eq(toWei("3"));
        expect(pendingAmount).to.be.eq(toWei("0.9"));
        expect(gaugeAmount).to.be.eq("0");
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei("999999.4"));
        await gauge.getReward(owner.address);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei("1000001.2"));

    });

    it('test Single user deposit and get reward', async function () {

        // Create a pool

        // await boost.addController(gaugeController.address); // Vote
        //
        //
        // // About gaugeController
        // await gaugeController.setDuration(ONE_DAT_DURATION);
        // await gaugeController.addPool(frax.address);
        // expect(await gaugeController.getPoolLength()).to.be.eq(1);
        // expect(await gaugeController.getPool(0)).to.be.eq(frax.address);
        //
        // // About gauge
        //
        // expect(await gauge.tokenPerBlock()).to.be.eq(0);
        // await gauge.deposit(toWei("0.000001"), tokenId);


        // expect(await gauge.totalSupply()).to.be.eq(toWei("0.000001"));
        // expect(await gauge.tokenIds(owner.address)).to.be.eq(tokenId);
        //
        //
        // // Vote
        // await gaugeController.vote(tokenId, await gaugeController.getPool(0));
        // expect(await gauge.tokenPerBlock()).to.be.gt(0);
        // // Get reward
        // accTokenPerShare = await gauge.accTokenPerShare();
        // pendingAmount = await gauge.pendingMax(owner.address);
        // expect(pendingAmount).to.be.gt(0);
        // initFxsBalanceOfOwner = await fxs.balanceOf(owner.address);
        // initGaugeTokenPerBlock = await gauge.tokenPerBlock();
        // beforeGetRewardTokenPerBlock = await gauge.tokenPerBlock();
        // pendingAmount = await gauge.pendingMax(owner.address);
        // boostAmount = await fxs.balanceOf(boost.address);
        // gaugeAmount = await fxs.balanceOf(gauge.address);
        // allowance = await fxs.allowance(boost.address, gauge.address);
        // console.log("pendingAmount:" + pendingAmount);
        // console.log("boostAmount:" + boostAmount);
        // console.log("gaugeAmount:" + gaugeAmount);
        // console.log("allowance:" + allowance);
        //
        // await gauge.getReward(owner.address);
        // expect(await fxs.balanceOf(owner.address)).to.be.gt(initFxsBalanceOfOwner);
        // expect(await getUserInfo(gauge, owner, 1)).to.be.gt(0);
        // expect(await gauge.tokenPerBlock()).to.be.eq(beforeGetRewardTokenPerBlock);
    });

});