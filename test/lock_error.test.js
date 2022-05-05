const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Locker', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'))

        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();


        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let lastBlock = await time.latestBlock();

        const Locker = await ethers.getContractFactory('Locker');
        // let eta = time.duration.days(1);
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt('300'));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(operatable.address);

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            operatable.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            toWei('1'),
            parseInt(lastBlock),
            "1000"
        );

        await lock.addBoosts(boost.address);
        await usdc.mint(owner.address, toWei('100'));
        // await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await usdc.mint(dev.address, toWei('100000000000000'));

        // await fxs.poolMint(dev.address, toWei('100000'));
        await boost.createGauge(usdc.address, "100", true);

        gaugeAddr = await boost.gauges(usdc.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_usdc = await Gauge.attach(gaugeAddr);
        expect(gauge_usdc.address).to.be.eq(gaugeAddr);

        expect(await boost.poolLength()).to.be.eq(1);

        expect(await boost.isGauge(gauge_usdc.address)).to.be.eq(true);
        expect(await boost.poolForGauge(gauge_usdc.address)).to.be.eq(usdc.address);
        // await busd.mint(dev.address, toWei('100'));

        await fxs.addPool(boost.address);

        await fxs.transfer(dev.address, toWei('10000000'))
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('10000000000'))
        await fxs.connect(dev).approve(lock.address, toWei('10000000000'))


    });
    it("test increase_amount and increase_unlock_time error", async () => {
        let eta = time.duration.days(365);
        let eta1 = time.duration.days(7);
        await lock.create_lock(toWei('1002'), parseInt(eta));

        await lock.connect(dev).create_lock(toWei('11'), parseInt(eta1));


        await boost.vote(1, [usdc.address], [toWei('100')]);
        await boost.connect(dev).vote(2, [usdc.address], [toWei('100')]);

        console.log("weights gauge_usdc:" + await boost.weights(usdc.address))

        let data = await time.latest()
        console.log("data:" + data)


        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('96'), 1);
        await gauge_usdc.connect(dev).deposit(toWei('1'), 2);

        await time.increase(time.duration.hours("14"));

        data = await time.latest()

        console.log("data:" + data)

        await lock.increase_amount(1, toWei('200'))
        await lock.increase_unlock_time(1, parseInt(eta));


    });
    // it("test lock error", async () => {
    //
    //       let eta = time.duration.days(1);
    //     await lock.create_lock(toWei('100'), parseInt(eta));
    //
    //      await usdc.approve(gauge_usdc.address, toWei('10000000'));
    //      await gauge_usdc.deposit("1000000", 1);
    //      // let eta = time.duration.days(1);
    //     //  await lock.create_lock(toWei('100'), parseInt(eta));
    //     //
    //      await boost.vote(1, [usdc.address], [toWei('100')]);
    //
    //      console.log("weights gauge_usdc:" + await boost.weights(usdc.address))
    //
    //
    //
    //      const date1 = await time.latest()
    //      await time.increase(time.duration.hours("14"));
    //      const date2 = await time.latest()
    //
    //
    //      console.log("date1:"+date1)
    //     console.log("date2:"+date2)
    //
    //      await lock.increase_amount(1, toWei('200'))
    //
    //      // await lock.increase_unlock_time(1, parseInt(eta));
    //
    //
    //  });


});
