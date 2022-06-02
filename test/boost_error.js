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

        const GaugeController = await ethers.getContractFactory('GaugeController');
        gaugeController = await GaugeController.deploy(
            checkPermission.address,
            boost.address,
            lock.address,
            "300");


        await boost.addController(gaugeController.address);
        await gaugeController.addPool(usdc.address);
        await gaugeController.addPool(busd.address);
        await lock.addBoosts(gaugeController.address);


    });

    it("test  vote with boost", async () => {
        let eta = time.duration.days(7);
        await lock.createLock(toWei('1000'), parseInt(eta));
        await lock.connect(dev).createLock(toWei('1'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));

        console.log("totalAllocPoint bef:" + await boost.totalAllocPoint())


        await gaugeController.vote(1, usdc.address);
        // await gaugeController.connect(dev).vote(2, usdc.address);
        // await gaugeController.connect(dev).vote(2, busd.address);

        console.log("totalAllocPoint aft:" + await boost.totalAllocPoint())


        //await gaugeController.setDuration(10)
        await time.increase(time.duration.days(1));
        expect(await boost.totalAllocPoint()).to.be.gt(0);

        await gaugeController.reset(1)
        console.log("totalAllocPoint aft1:" + await boost.totalAllocPoint())


    });


});
