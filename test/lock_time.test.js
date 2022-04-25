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


        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        let lastBlock = await time.latestBlock();

        const Locker = await ethers.getContractFactory('Locker');
        // let eta = time.duration.days(1);
        lock = await Locker.deploy(fxs.address, parseInt('300'));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy();

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

        await lock.setVoter(boost.address);
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

        await frax.addPool(boost.address);

        await fxs.transfer(dev.address, toWei('10000000'))
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('10000000000'))
        await fxs.connect(dev).approve(lock.address, toWei('10000000000'))


    });
    it("test increase_amount and increase_unlock_time error", async () => {
        let eta = time.duration.days(7);
        await lock.create_lock(toWei('1002'), parseInt(eta));

        await boost.vote(1, [usdc.address], [toWei('100')]);

        console.log("weights gauge_usdc:" + await boost.weights(usdc.address))

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('96'), 1);


        await time.increase(time.duration.minutes("15"));

        let gasFee = await lock.estimateGas.increase_amount(1, toWei('200'))

        console.log("gasFee:" + gasFee)


        await time.increase(time.duration.minutes("15"));

        let gasFee1 = await lock.estimateGas.increase_amount(1, toWei('200'))

        console.log("gasFee1:" + gasFee1)


        await time.increase(time.duration.days("1"));

        let gasFee2 = await lock.estimateGas.increase_unlock_time(1, parseInt(eta));
        console.log("gasFee2:" + gasFee2)


    });


});