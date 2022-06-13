const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost_vote', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";

        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        await busd.mint(owner.address, toWei('1000'))

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'))

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);
        await fxs.transfer(addr1.address, "299000000000000000000000000");
        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");

        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let lastBlock = await time.latestBlock();

        const Locker = await ethers.getContractFactory('Locker');
        // let eta = time.duration.days(1);
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt('1800'));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(checkPermission.address);

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkPermission.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            toWei("1"),
            parseInt(lastBlock),
            "1000"
        );

        await lock.addBoosts(boost.address);
        await usdc.mint(owner.address, toWei('1000'));
        await fxs.approve(lock.address, toWei('10000'));
        await usdc.mint(dev.address, toWei('10000000'));

        await boost.createGauge(usdc.address, "100", true);


        gaugeAddr = await boost.gauges(usdc.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_usdc = await Gauge.attach(gaugeAddr);
        expect(gauge_usdc.address).to.be.eq(gaugeAddr);

        await fxs.addPool(boost.address);

        await fxs.transfer(dev.address, toWei('10'));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('100000'));
        await fxs.connect(dev).approve(lock.address, toWei('100000'));
        await fxs.approve(lock.address, toWei('100000'));

        const GaugeController = await ethers.getContractFactory('GaugeController');
        gaugeController = await GaugeController.deploy(
            checkPermission.address,
            boost.address,
            lock.address,
            "300");

        await boost.addController(gaugeController.address);
        await gaugeController.addPool(usdc.address);
        await lock.addBoosts(gaugeController.address);


    });
    it("test boost without vote", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'));

        await boost.updatePool(0);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998990'));

        await gauge_usdc.getReward(owner.address);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998990.6'));


    });
    it("test boost with vote", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'));

        await gaugeController.vote(1, usdc.address);

        await boost.updatePool(0);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998990'));

        await gauge_usdc.getReward(owner.address);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998990.9'));


    });

    it("test two users without vote", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'));
        await gauge_usdc.connect(dev).deposit(toWei('10'));
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999989'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9'));

        await boost.updatePool(0);

        await gauge_usdc.getReward(owner.address)
        await gauge_usdc.connect(dev).getReward(dev.address)
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999989.45'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9.6'));


    });
    it("test two users with vote", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'));
        await gauge_usdc.connect(dev).deposit(toWei('10'));

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999989'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9'));

        await boost.updatePool(0);

        await gaugeController.vote(1, usdc.address);
        await gaugeController.connect(dev).vote(2, usdc.address);

        await gauge_usdc.getReward(owner.address)
        await gauge_usdc.connect(dev).getReward(dev.address)

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999989.75'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9.9'));


    });
    it('mobile mining, single user deposit, single pool voting, reset and re voting', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).deposit(toWei('10'));

        await gaugeController.connect(dev).vote(1, usdc.address);

        await time.increase(time.duration.days(1));
        await expectRevert(gaugeController.connect(dev).reset(1), "total=0");

        await time.increase(time.duration.days(1));
        await expectRevert(boost.createGauge(usdc.address, "100", true), "exists");
        boost.createGauge(fxs.address, "100", true)
        await expectRevert(gaugeController.connect(dev).vote(1, usdc.address), "tokenId voted");
        await expectRevert(gaugeController.connect(dev).vote(1, frax.address), "must pool");


    });
    it('mobile mining,two users deposit, single pool voting, reset and re voting', async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await lock.createLock(toWei('10'), parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).deposit(toWei('10'));
        await gauge_usdc.deposit(toWei('10'));

        await gaugeController.connect(dev).vote(1, usdc.address);
        await gaugeController.vote(2, usdc.address);

        await time.increase(time.duration.days(1));
        await gaugeController.connect(dev).reset(1);
        await gaugeController.reset(2);

        await time.increase(time.duration.days(1));

        await gaugeController.connect(dev).vote(1, usdc.address);
        await gaugeController.vote(2, usdc.address);


    });
    it("users can speed up, reset, and vote again", async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).deposit(toWei('10'));

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')]);

        await boost.connect(dev).reset(1);
        let addresses = await boost.getPoolVote(1);
        expect(addresses).to.be.empty;

        await gaugeController.connect(dev).vote(1, usdc.address);

    });
    it("correct poke mode", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await expect(gaugeController.poke(1)).to.be.revertedWith("use weight > 0");
        await gaugeController.vote(1, usdc.address);
        await gaugeController.poke(1);

    });
    it("correct two users poke mode", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await gaugeController.vote(1, usdc.address);
        console.log("weights:" + await gaugeController.weights(usdc.address));

        console.log("usedWeights:" + await gaugeController.usedWeights(1));
        await expect(gaugeController.poke(2)).to.be.revertedWith("no owner");
        await gaugeController.poke(1);
        expect(await gaugeController.weights(usdc.address)).to.be.eq(0);

        console.log("usedWeights:" + await gaugeController.usedWeights(1));

        await expect(gaugeController.connect(dev).poke(1)).to.be.revertedWith("no owner");
        await expect(gaugeController.connect(dev).poke(2)).to.be.revertedWith("use weight > 0");

        await gaugeController.connect(dev).vote(2, usdc.address);
        await gaugeController.connect(dev).poke(2);

    });
    it("test removePool and getUserInfo", async () => {
        expect(await gaugeController.getPoolLength()).to.be.eq(1);
        expect(await gaugeController.isPool(usdc.address)).to.be.eq(true);

        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));
        let info = await gaugeController.getUserInfo(1);

        expect(info[0]).to.be.eq(zeroAddr);
        expect(info[1]).to.be.eq(0);

        await gaugeController.vote(1, usdc.address);
        info = await gaugeController.getUserInfo(1);
        let data = await time.latest();

        expect(info[0]).to.be.eq(usdc.address);
        expect(info[1]).to.be.eq(parseInt(data));
        await gaugeController.removePool(usdc.address);
        expect(await gaugeController.getPoolLength()).to.be.eq(0);
        expect(await gaugeController.isPool(usdc.address)).to.be.eq(false);

    });


});
