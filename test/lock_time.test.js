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
        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");

        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let lastBlock = await time.latestBlock();
        // let eta = time.duration.days(1460);

        const Locker = await ethers.getContractFactory('Locker');
        // let eta = time.duration.days(1);
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt("7200"));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(checkPermission.address);

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkPermission.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            toWei('1'),
            parseInt(lastBlock),
            "1000"
        );

        await lock.addBoosts(boost.address);
        await usdc.mint(owner.address, toWei('1000000'));
        await usdc.mint(dev.address, toWei('1000000'));

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
    it("increase_amount after checkpoint, gasfee will decrease", async () => {
        let eta = time.duration.days(14);
        await lock.create_lock(toWei('1002'), parseInt(eta));
        await lock.connect(dev).create_lock(toWei('1002'), parseInt(eta));

        await boost.vote(1, [usdc.address], [toWei('100')]);
        await boost.connect(dev).vote(2, [usdc.address], [toWei('100')]);


        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('96'), 1);
        await gauge_usdc.connect(dev).deposit(toWei('96'), 2);

        let gasFeeOwnerBef = await lock.estimateGas.increase_amount(1, toWei('100'));
        let gasFeeDevBef = await lock.connect(dev).estimateGas.increase_amount(2, toWei('200'));

        await time.increase(time.duration.days("1"));

        let gasFeeOwnerAft = await lock.estimateGas.increase_amount(1, toWei('1000'));
        let gasFeeDevAft = await lock.connect(dev).estimateGas.increase_amount(2, toWei('2000'));

        expect(gasFeeOwnerAft).gt(gasFeeOwnerBef);
        expect(gasFeeDevAft).gt(gasFeeDevBef);

        await lock.checkpoint();
        let gasFeeOwnerAft1 = await lock.estimateGas.increase_amount(1, toWei('1000'));
        let gasFeeDevAft1 = await lock.connect(dev).estimateGas.increase_amount(2, toWei('2000'));
        expect(gasFeeOwnerAft1).lt(gasFeeOwnerAft);
        expect(gasFeeDevAft1).lt(gasFeeDevAft);

    });
    it("increase_unlock_time after checkpoint, gasfee will decrease ", async () => {
        let eta = time.duration.days(14);
        await lock.create_lock(toWei('1002'), parseInt(eta));
        await lock.connect(dev).create_lock(toWei('1002'), parseInt(eta));

        await boost.vote(1, [usdc.address], [toWei('100')]);
        await boost.connect(dev).vote(2, [usdc.address], [toWei('100')]);


        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('96'), 1);
        await gauge_usdc.connect(dev).deposit(toWei('96'), 2);
        await time.increase(time.duration.days(1));

        let gasFeeOwnerBef = await lock.estimateGas.increase_unlock_time(1, parseInt(eta));
        await time.increase(time.duration.days(1));
        let gasFeeDevBef = await lock.connect(dev).estimateGas.increase_unlock_time(2, parseInt(eta));

        await time.increase(time.duration.days(1));

        let gasFeeOwnerAft = await lock.estimateGas.increase_unlock_time(1, parseInt(eta));
        let gasFeeDevAft = await lock.connect(dev).estimateGas.increase_unlock_time(2, parseInt(eta));

        expect(gasFeeOwnerAft).gt(gasFeeOwnerBef);
        expect(gasFeeDevAft).gt(gasFeeDevBef);

        await lock.checkpoint();
        let gasFeeOwnerAft1 = await lock.estimateGas.increase_amount(1, parseInt(eta));
        let gasFeeDevAft1 = await lock.connect(dev).estimateGas.increase_amount(2, parseInt(eta));
        expect(gasFeeOwnerAft1).lt(gasFeeOwnerAft);
        expect(gasFeeDevAft1).lt(gasFeeDevAft);

    });
    it("test emergencyWithdraw ", async () => {
        let eta = time.duration.days(3);
        await lock.create_lock(toWei('1002'), parseInt(eta));

        await boost.vote(1, [usdc.address], [toWei('100')]);

        await usdc.approve(gauge_usdc.address, toWei('10000000'));

        await gauge_usdc.deposit(toWei('96'), 1);

        let gasFeeOwnerBef = await lock.estimateGas.increase_amount(1, toWei('100'));
        await time.increase(time.duration.days("1"));
        let gasFeeOwnerAft = await lock.estimateGas.increase_amount(1, toWei('1000'));

        expect(gasFeeOwnerAft).gt(gasFeeOwnerBef);

        let lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq(toWei('1002'));
        let bef = await fxs.balanceOf(owner.address);

        await time.increase(time.duration.days(2));
        await lock.emergencyWithdraw(1);
        let aft = await fxs.balanceOf(owner.address);
        lockInfo = await lock.locked(1);
        expect(lockInfo[0]).to.be.eq(0);
        expect(aft).to.be.eq(bef.add(toWei('1002')));

    });


});