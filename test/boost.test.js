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

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");


        const MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));
        btc = await MockToken.deploy("btc", "btc", 18, toWei('10'));


        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt(eta));

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


        const GaugeController = await ethers.getContractFactory('GaugeController');
        gaugeController = await GaugeController.deploy(
            operatable.address,
            boost.address,
            lock.address,
            "300");

        await boost.addController(gaugeController.address);
        await lock.addBoosts(gaugeController.address);
        expect(await gaugeController.distribute()).to.be.eq(boost.address);


    });
    it('should two users getReward correct', async () => {
        await fxs.approve(lock.address, toWei('10000000'));
        await fxs.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(7);
        // console.log("eta:" + parseInt(eta));

        await lock.connect(dev).create_lock(toWei('1'), parseInt(eta));
        await lock.create_lock(toWei('2'), parseInt(eta));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('10000000'))
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'))
        await usdc.approve(gauge_usdc.address, toWei('10000000'))
        await fxs.approve(gauge_usdc.address, toWei('10000000'))

        await gauge_usdc.connect(dev).deposit("1000", 1);
        await gauge_usdc.connect(owner).deposit("2000", 2);

        await boost.updatePool(0);

        expect(await gauge_usdc.tokenPerBlock()).to.be.eq(toWei('0.5'))


        await time.increase(time.duration.days(1));

        //  console.log("boost fxs:" + await fxs.balanceOf(boost.address));
        // console.log("fxs bef:" + await fxs.balanceOf(dev.address))
        //
        // let rewardDev = await gauge_usdc.pending(fxs.address)
        // console.log("rewardDev:" + rewardDev)
        // console.log("fxs aft:" + await fxs.balanceOf(dev.address))
        //
        // console.log("fxs bef:" + await fxs.balanceOf(owner.address))
        // await time.increase(time.duration.days(1));
        // let rewardOwner = await gauge_usdc.pending(owner.address)
        // console.log("rewardOwner:" + rewardOwner)
        // await gauge_usdc.connect(owner).getReward(owner.address);
        // console.log("fxs aft:" + await fxs.balanceOf(owner.address))
        console.log("weights:" + await boost.weights(usdc.address))

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')])

        console.log("weights:" + await boost.weights(usdc.address) / 10 ** 18)
        console.log("weights1:" + await gaugeController.weights(usdc.address))

        await gaugeController.connect(dev).vote(1, usdc.address);
        console.log("weights1:" + await gaugeController.weights(usdc.address) / 10 ** 18)

        rewardOwner1 = await gauge_usdc.pending(owner.address)
        console.log("rewardOwner1:" + rewardOwner1)


    });
    // it('should two pools, single user getReward correct', async () => {
    //     await busd.connect(dev).approve(lock.address, toWei('10000000'));
    //     await usdc.connect(dev).approve(lock.address, toWei('10000000'));
    //     let eta = time.duration.days(1);
    //     // console.log("eta:" + parseInt(eta));
    //
    //     await lock.connect(dev).create_lock_for("1000", parseInt(eta), dev.address);
    //
    //     await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'))
    //     await busd.connect(dev).approve(gauge_busd.address, toWei('10000000'))
    //
    //
    //     await gauge_usdc.connect(dev).deposit("1000", 1);
    //     await gauge_busd.connect(dev).deposit("1000", 1);
    //
    //     await boost.updatePool(0);
    //     await boost.updatePool(1);
    //
    //     await gauge_usdc.connect(dev).deposit("1000", 1);
    //
    //
    //     await time.increase(time.duration.days(1));
    //
    //     console.log("fxs bef:" + await fxs.balanceOf(dev.address))
    //
    //     let rewardDev = await gauge_usdc.pending(dev.address)
    //     console.log("rewardDev:" + rewardDev)
    //     await gauge_usdc.connect(dev).getReward(dev.address);
    //     console.log("fxs aft:" + await fxs.balanceOf(dev.address))
    //
    //     let rewardDev1 = await gauge_busd.pending(dev.address)
    //     console.log("rewardDev1:" + rewardDev1)
    //     await gauge_busd.connect(dev).getReward(dev.address)
    //     console.log("fxs aft1:" + await fxs.balanceOf(dev.address))
    //
    //
    // });
    // it('test vote', async () => {
    //     await usdc.connect(dev).approve(lock.address, toWei('100000000000'));
    //     let eta = time.duration.days(1);
    //     // console.log("eta:" + parseInt(eta));
    //
    //     await lock.connect(dev).create_lock_for(toWei('1'), parseInt(eta), dev.address);
    //
    //     await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'))
    //     await gauge_usdc.connect(dev).deposit("1000", 1);
    //
    //     await boost.updatePool(0);
    //
    //     await gauge_usdc.connect(dev).deposit("1000", 1);
    //     // await time.increase(time.duration.days(1));
    //
    //     console.log("fxs bef:" + await fxs.balanceOf(dev.address))
    //     let rewardDev = await gauge_usdc.pending(dev.address)
    //     console.log("rewardDev:" + rewardDev)
    //     await gauge_usdc.connect(dev).getReward(dev.address)
    //     console.log("fxs aft1:" + await fxs.balanceOf(dev.address))
    //
    //     console.log("-----------------------")
    //
    //     let lockBlock = await time.latestBlock();
    //     await time.advanceBlockTo(parseInt(lockBlock) + 10);
    //
    //     //await boost.reset(1)
    //     //await boost.poke(1)
    //     //console.log(await boost.weights(usdc.address))
    //     let balanceOfNFT = await lock.balanceOfNFT("1");
    //     console.log("balanceOfNFT:" + balanceOfNFT);
    //     epoch = await lock.user_point_epoch("1");
    //
    //
    //     console.log("weights usdc:" + await boost.weights(usdc.address))
    //     console.log("epoch:" + epoch);
    //     await boost.connect(dev).vote(1, [usdc.address], [toWei('10000')])
    //     console.log("weights btc:" + await boost.weights(btc.address))
    //     console.log("weights usdc:" + await boost.weights(usdc.address))
    //
    //     // console.log("fxs bef:" + await fxs.balanceOf(dev.address))
    //     // let rewardDev1 = await gauge_usdc.earned(fxs.address, dev.address)
    //     // console.log("rewardDev1:" + rewardDev1)
    //     // await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address])
    //     // console.log("fxs aft1:" + await fxs.balanceOf(dev.address))
    //
    //     //console.log(await boost.getPoolVote(1))
    //
    //
    // });
    //

});