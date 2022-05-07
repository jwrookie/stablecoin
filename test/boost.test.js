const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");


        MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));
        btc = await MockToken.deploy("btc", "btc", 18, toWei('10'));


        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt(eta));

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

        await fxs.addPool(boost.address);
        await lock.addBoosts(boost.address);
        await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await fxs.transfer(dev.address, toWei('10000'));
        await usdc.mint(dev.address, toWei('10000'));

        await boost.createGauge(usdc.address, "100", true);

        gaugeAddr = await boost.gauges(usdc.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_usdc = await Gauge.attach(gaugeAddr);
        expect(gauge_usdc.address).to.be.eq(gaugeAddr);

        expect(await boost.poolLength()).to.be.eq(1);

        expect(await boost.isGauge(gauge_usdc.address)).to.be.eq(true);
        expect(await boost.poolForGauge(gauge_usdc.address)).to.be.eq(usdc.address);
        await busd.mint(dev.address, toWei('100'));

        await boost.createGauge(busd.address, "100", true);

        gaugeAddr1 = await boost.gauges(busd.address);

        gauge_busd = await Gauge.attach(gaugeAddr1);
        expect(gauge_busd.address).to.be.eq(gaugeAddr1);
        expect(await boost.poolLength()).to.be.eq(2);


    });
    it('should two users getReward correct', async () => {
        await fxs.approve(lock.address, toWei('10000000'));
        await fxs.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        // console.log("eta:" + parseInt(eta));

        await lock.connect(dev).create_lock("1000", parseInt(eta));
        await lock.create_lock("2000", parseInt(eta));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('10000000'))
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'))
        await usdc.approve(gauge_usdc.address, toWei('10000000'))
        await fxs.approve(gauge_usdc.address, toWei('10000000'))

        await gauge_usdc.connect(dev).deposit("1000", 1);
        await gauge_usdc.connect(owner).deposit("2000", 2);

        await boost.updatePool(0);
        expect(await boost.poolLength()).to.be.eq(2);


        await time.increase(time.duration.days(1));

        //  console.log("boost fxs:" + await fxs.balanceOf(boost.address));
        // console.log("fxs bef:" + await fxs.balanceOf(dev.address))
        //
        let rewardDev = await gauge_usdc.pending(dev.address)
        // console.log("rewardDev:" + rewardDev)
        await gauge_usdc.connect(dev).getReward(dev.address)
        // console.log("fxs aft:" + await fxs.balanceOf(dev.address))
        //
        // console.log("fxs bef:" + await fxs.balanceOf(owner.address))
        await time.increase(time.duration.days(1));
        let rewardOwner = await gauge_usdc.pending(owner.address)
        // console.log("rewardOwner:" + rewardOwner)
        await gauge_usdc.connect(owner).getReward(owner.address)
        // console.log("fxs aft:" + await fxs.balanceOf(owner.address))


    });
    it('should two pools, single user getReward correct', async () => {
        await busd.connect(dev).approve(lock.address, toWei('10000000'));
        await usdc.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        // console.log("eta:" + parseInt(eta));

        await lock.connect(dev).create_lock_for("1000", parseInt(eta), dev.address);

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'))
        await busd.connect(dev).approve(gauge_busd.address, toWei('10000000'))


        await gauge_usdc.connect(dev).deposit("1000", 1);
        await gauge_busd.connect(dev).deposit("1000", 1);

        await boost.updatePool(0);
        await boost.updatePool(1);

        await gauge_usdc.connect(dev).deposit("1000", 1);


        await time.increase(time.duration.days(1));

        // console.log("fxs bef:" + await fxs.balanceOf(dev.address))

        //let rewardDev = await gauge_usdc.pending(dev.address)
        // console.log("rewardDev:" + rewardDev)
        await gauge_usdc.connect(dev).getReward(dev.address)
        // console.log("fxs aft:" + await fxs.balanceOf(dev.address))

        let rewardDev1 = await gauge_busd.pending(dev.address)
        //console.log("rewardDev1:" + rewardDev1)
        await gauge_busd.connect(dev).getReward(dev.address)
        // console.log("fxs aft1:" + await fxs.balanceOf(dev.address))


    });


});