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
        await frax.setFXSAddress(fxs.address);

        let lastBlock = await time.latestBlock();
        // let eta = time.duration.days(1460);

        const Locker = await ethers.getContractFactory('Locker');
        // let eta = time.duration.days(1);
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt("7200"));

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
    it("failure to conduct checkpoint for a long time will lead to too high gas", async () => {
        let eta = time.duration.days(1460);
        await lock.create_lock(toWei('1002'), parseInt(eta));
        await lock.connect(dev).create_lock(toWei('1002'), parseInt(eta));

        await boost.vote(1, [usdc.address], [toWei('100')]);
        await boost.connect(dev).vote(2, [usdc.address], [toWei('100')]);
        expect(await lock.tokenId()).to.be.eq(2);

        console.log("weights gauge_usdc:" + await boost.weights(usdc.address) / 10 ** 18)

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('96'), 1);
        await gauge_usdc.connect(dev).deposit(toWei('96'), 2);


        // await time.increase(time.duration.minutes("6"));

        let gasFee = await lock.estimateGas.increase_amount(1, toWei('200'))
        console.log("gasFee:" + gasFee);

        let gasFee1 = await lock.connect(dev).estimateGas.increase_amount(2, toWei('200'))
        console.log("gasFee1:" + gasFee1);


        await time.increase(time.duration.days("1"));

       await lock.checkpoint();
        let gasFee2 = await lock.estimateGas.increase_amount(1, toWei('200'))

        console.log("gasFee2:" + gasFee2)


       await lock.connect(dev).checkpoint();
        let gasFee3 = await lock.connect(dev).estimateGas.increase_amount(2, toWei('200'))

        console.log("gasFee3:" + gasFee3)


        // await time.increase(time.duration.days("1"));
         await lock.checkpoint();
        //
        let gasFee4 = await lock.estimateGas.increase_unlock_time(1, parseInt(eta));
        let gasFee5 = await lock.connect(dev).estimateGas.increase_unlock_time(2, parseInt(eta));
        //
        console.log("gasFee5:" + gasFee4)
        console.log("gasFee6:" + gasFee5)


    });
    it("when the withdrawal gas is too high users are allowed to " +
        "withdraw cash urgently",async ()=> {

        // await


    })


});