const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
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
        // await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await usdc.mint(dev.address, toWei('10000000'));

        await boost.createGauge(usdc.address, "100", true);
        await boost.createGauge(busd.address, "100", true);

        gaugeAddr = await boost.gauges(usdc.address);
        gaugeAddr1 = await boost.gauges(busd.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_usdc = await Gauge.attach(gaugeAddr);
        gauge_busd = await Gauge.attach(gaugeAddr1);
        expect(gauge_usdc.address).to.be.eq(gaugeAddr);

        await fxs.addPool(boost.address);

        await fxs.transfer(dev.address, toWei('10'));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('100000'))
        await fxs.connect(dev).approve(lock.address, toWei('100000'))
        await fxs.approve(gauge_busd.address, toWei('100000'))
        await fxs.approve(lock.address, toWei('100000'))


    });
    it("test boost acceleration without boost", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'), 1);

        await boost.updatePool(0);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998990'));

        await gauge_usdc.getReward(owner.address);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998990.3'));


    });
    it("test boost acceleration with boost", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'), 1);

        await boost.vote(1, [usdc.address], [toWei('1')]);

        await boost.updatePool(0);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998990'));

        await gauge_usdc.getReward(owner.address);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('998991.5'));


    });
    it("the acceleration multiplier is 3.3", async () => {
        let eta = time.duration.days(1);
        await lock.createLock(toWei('1000'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'), 1);
        await boost.updatePool(0);

        let pendingMax = await gauge_usdc.pendingMax(owner.address);
        let pending = await gauge_usdc.pending(owner.address);

        let multiple = pendingMax / pending;
        expect(pendingMax).to.be.gt(pending);
        expect(multiple).to.be.eq(3.3333333333333335);

        await boost.vote(1, [usdc.address], [toWei('1')]);


        pendingMax = await gauge_usdc.pendingMax(owner.address);
        pending = await gauge_usdc.pending(owner.address);
        multiple = pendingMax / pending;
        expect(pendingMax).to.be.eq(pending);
        expect(multiple).to.be.eq(1);


    });
    it("test two users without boost", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'), 1);
        await gauge_usdc.connect(dev).deposit(toWei('10'), 2);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999989'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9'));

        await boost.updatePool(0);

        await gauge_usdc.getReward(owner.address)
        await gauge_usdc.connect(dev).getReward(dev.address)
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999989.225'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9.3'));


    });
    it("test two users with boost", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'), 1);
        await gauge_usdc.connect(dev).deposit(toWei('10'), 2);

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999989'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('9'));

        await boost.updatePool(0);

        await boost.vote(1, [usdc.address], [toWei('1')]);
        await boost.connect(dev).vote(2, [usdc.address], [toWei('1')]);

        await gauge_usdc.getReward(owner.address)
        await gauge_usdc.connect(dev).getReward(dev.address)

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('999990.25'));
        expect(await fxs.balanceOf(dev.address)).to.be.eq(toWei('10.5'));


    });
    it("mobile mining, single user deposit, single pool acceleration," +
        " reset and re acceleration", async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).deposit(toWei('10'), 1);

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')]);

        await boost.connect(dev).reset(1);

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')]);


    });
    it("mobile mining, two users deposit, single pool acceleration," +
        " reset and re acceleration", async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));
        await lock.createLock(toWei('10'), parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).deposit(toWei('10'), 1);
        await gauge_usdc.deposit(toWei('10'), 2);

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')]);
        await boost.vote(2, [usdc.address], [toWei('1')]);

        await boost.connect(dev).reset(1);
        await boost.reset(2);

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')]);
        await boost.vote(2, [usdc.address], [toWei('1')]);


    });
    it("users can't vote multiple times, but the weight will be reset each time", async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).deposit(toWei('10'), 1);

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')]);

        await expect(boost.connect(dev).vote(1, [usdc.address], [toWei('1')])).to.be.revertedWith("tokenId voted");


    });
    it("correct acceleration mode", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await expect(boost.poke(2)).to.be.revertedWith("total weight is 0");
        await boost.vote(1, [usdc.address], [toWei('1')]);

        await expect(boost.connect(dev).poke(2)).to.be.revertedWith("total weight is 0");
        await boost.connect(dev).vote(2, [usdc.address], [toWei('1')]);
        await boost.reset(1);
        await boost.connect(dev).reset(2);

        await expect(boost.poke(1)).to.be.revertedWith("total weight is 0");
        await boost.connect(dev).vote(2, [usdc.address], [toWei('1')]);

        await boost.vote(1, [usdc.address], [toWei('1')]);


    });
    it("test getPoolVote and addController,removeController", async () => {

        expect(await boost.controllers(usdc.address)).to.be.eq(false);
        await boost.addController(usdc.address);
        expect(await boost.controllers(usdc.address)).to.be.eq(true);

        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        let info = await boost.getPoolVote(1);
        await boost.vote(1, [usdc.address], [toWei('1')]);
        let info1 = await boost.getPoolVote(1);

        expect(info1).to.be.not.eq(info)

        await boost.removeController(usdc.address);
        expect(await boost.controllers(usdc.address)).to.be.eq(false);


    });
    it("test poke", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await fxs.connect(dev).approve(lock.address, toWei('10000'))
        await lock.connect(dev).createLock(toWei('10'), parseInt(eta));

        await boost.vote(1, [usdc.address], [toWei('1')])
        // await boost.poke(1)
        await boost.reset(1)

        // await boost.connect(dev).vote(2,[usdc.address],[toWei('1')])
        // await boost.connect(dev).poke(2)
        await boost.poke(1)

    })


});
