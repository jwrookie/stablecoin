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

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'))

        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();


        // const FRAXShares = await ethers.getContractFactory('FRAXShares');
        // fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);
        //
        // const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        // frax = await FRAXStablecoin.deploy("frax", "frax");

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

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
            "10000",
            parseInt(lastBlock),
            "1000"
        );

        await lock.setVoter(boost.address);
        await usdc.mint(owner.address, toWei('1000'));
        // await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await usdc.mint(dev.address, toWei('10000000'));

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

        await fxs.transfer(dev.address, toWei('10'));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('100000'))
        await fxs.connect(dev).approve(lock.address, toWei('100000'))


    });
    // it("test boost vote", async () => {
    //     let eta = time.duration.days(7);
    //     await lock.create_lock(toWei('1000'), parseInt(eta));
    //
    //     await boost.vote(1, [usdc.address], [toWei('1')]);
    //
    //     console.log("totalWeight:" + await boost.totalWeight() / 10 ** 18)
    //     console.log("pool total weights:" + await boost.weights(usdc.address) / 10 ** 18)
    //
    //
    //     console.log("user voted pool weights:" + await boost.votes(1, usdc.address) / 10 ** 18)
    //     console.log("user weights::" + await lock.balanceOfNFT(1) / 10 ** 18);
    //     console.log(" usedWeights::" + await boost.usedWeights(1) / 10 ** 18);
    //
    //     console.log("----------------------------")
    //
    //     await usdc.approve(gauge_usdc.address, toWei('10000000'));
    //     await gauge_usdc.deposit(toWei('10'), 1);
    //     await lock.checkpoint();
    //
    //     await time.increase(time.duration.minutes("15"));
    //     console.log("totalWeight:" + await boost.totalWeight() / 10 ** 18)
    //     console.log("pool total weights :" + await boost.weights(usdc.address) / 10 ** 18)
    //
    //
    //     console.log("user voted pool weights:" + await boost.votes(1, usdc.address) / 10 ** 18)
    //     console.log("user weights:" + await lock.balanceOfNFT(1) / 10 ** 18);
    //     console.log(" usedWeights::" + await boost.usedWeights(1) / 10 ** 18);
    //     await gauge_usdc.deposit(toWei('100'), 1);
    //
    //
    //     await time.increase(time.duration.hours("1"));
    //
    //     console.log("----------------------------")
    //     console.log("totalWeight:" + await boost.totalWeight() / 10 ** 18)
    //     console.log("pool total weights:" + await boost.weights(usdc.address) / 10 ** 18)
    //
    //
    //     console.log("user voted pool weights:" + await boost.votes(1, usdc.address) / 10 ** 18)
    //     console.log("user weights:" + await lock.balanceOfNFT(1) / 10 ** 18);
    //
    //     await time.increase(time.duration.days("1"));
    //     await gauge_usdc.deposit(toWei('100'), 1);
    //     // await boost.reset( 1);
    //     console.log("----------------------------")
    //     console.log("totalWeight:" + await boost.totalWeight() / 10 ** 18)
    //     console.log("pool total weights:" + await boost.weights(usdc.address) / 10 ** 18)
    //
    //
    //     console.log("user voted pool weights:" + await boost.votes(1, usdc.address) / 10 ** 18)
    //     console.log("user weights:" + await lock.balanceOfNFT(1) / 10 ** 18);
    //     console.log(" usedWeights::" + await boost.usedWeights(1) / 10 ** 18);
    //
    //
    //     console.log("----------------------------")
    //     await time.increase(time.duration.hours("1"));
    //
    //     await lock.increase_amount(1, toWei('200'))
    //     await boost.vote(1, [usdc.address], [toWei('1')]);
    //
    //     console.log("totalWeight:" + await boost.totalWeight() / 10 ** 18)
    //     console.log("pool total weights:" + await boost.weights(usdc.address) / 10 ** 18)
    //
    //
    //     console.log("user voted pool weights:" + await boost.votes(1, usdc.address) / 10 ** 18)
    //     console.log("user weights:" + await lock.balanceOfNFT(1) / 10 ** 18);
    //     console.log(" usedWeights::" + await boost.usedWeights(1) / 10 ** 18);
    //
    // });
    // it("test boost vote", async () => {
    //     let eta = time.duration.days(7);
    //     await lock.create_lock(toWei('1000'), parseInt(eta));


    //     await usdc.approve(gauge_usdc.address, toWei('10000000'));
    //     await gauge_usdc.deposit(toWei('10'), 1);


    //     await boost.updatePool(0)
    //     // await time.increase(time.duration.hours("1"));

    //     let lastBlock = await time.latestBlock();
    //     await time.advanceBlockTo(parseInt(lastBlock) + 100);


    //     let rewardBef= await gauge_usdc.earned(fxs.address, owner.address)
    //    // console.log("reward:" + reward)

    //     lastBlock = await time.latestBlock();
    //     console.log("lastBlock:"+lastBlock)
    //     await time.advanceBlockTo(parseInt(lastBlock) + 100);

    //     await boost.vote(1, [usdc.address], [toWei('1')]);


    //    let  rewardAft = await gauge_usdc.earned(fxs.address, owner.address)
    //     console.log("reward:" +  BigNumber.from(rewardAft).sub(rewardBef).div("1000000000000000000"))


    // });
    // it("test boost vote without boost", async () => {
    //     let eta = time.duration.days(7);
    //     await lock.create_lock(toWei('1000'), parseInt(eta));
    //
    //     await usdc.approve(gauge_usdc.address, toWei('10000000'));
    //     await gauge_usdc.deposit(toWei('10'), 1);
    //
    //     await boost.updatePool(0);
    //
    //     const reward0 = await gauge_usdc.earned(fxs.address, owner.address);
    //
    //     let lastBlock = await time.latestBlock();
    //     await time.advanceBlockTo(parseInt(lastBlock) + 1);
    //
    //     const reward1 = await gauge_usdc.earned(fxs.address, owner.address);
    //
    //     lastBlock = await time.latestBlock();
    //     await time.advanceBlockTo(parseInt(lastBlock) + 1);
    //
    //     const reward2 = await gauge_usdc.earned(fxs.address, owner.address);
    //
    //     expect(reward0).to.be.eq(0);
    //     expect(reward1 / 10 ** 18).to.be.eq(1);
    //     expect(reward2 / 10 ** 18).to.be.eq(2);
    //
    //
    // });
    it("test boost vote with boost", async () => {
        let eta = time.duration.days(7);
        await lock.connect(dev).create_lock(toWei('1'), parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).deposit(toWei('10'), 1);

        await boost.updatePool(0);

        let lastBlock = await time.latestBlock();
        console.log("lastBlock:" + lastBlock);
        //await time.advanceBlockTo(parseInt(lastBlock) + 1);

        await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address])
        let devBef = await fxs.balanceOf(dev.address)

        await boost.connect(dev).vote(1, [usdc.address], [toWei('1')]);

        lastBlock = await time.latestBlock();
        console.log("lastBlock:" + lastBlock);
        //await time.advanceBlockTo(parseInt(lastBlock) + 1);

        await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address])

        let devAft = await fxs.balanceOf(dev.address)
        let devDiff = devAft - devBef;

        expect(devDiff).to.be.eq(19456);
        // console.log("dev aft:"+await fxs.balanceOf(dev.address))
        await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address])

        lastBlock = await time.latestBlock();
        //await time.advanceBlockTo(parseInt(lastBlock) + 1);
        console.log("lastBlock:" + lastBlock);

        //console.log("dev aft:"+await fxs.balanceOf(dev.address))
        let devAft1 = await fxs.balanceOf(dev.address)

        let devDiff1 = devAft1 - devAft;

        expect(devDiff1).to.be.gt(10000);
        expect(devDiff1).to.be.eq(10240);

        await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address])

        lastBlock = await time.latestBlock();
        //await time.advanceBlockTo(parseInt(lastBlock) + 1);
        console.log("lastBlock:" + lastBlock);

        //console.log("dev aft:"+await fxs.balanceOf(dev.address))
        let devAft2 = await fxs.balanceOf(dev.address)

        let devDiff2 = devAft2 - devAft1;

        expect(devDiff2).to.be.gt(10000);
        expect(devDiff2).to.be.gt(10240);


    });

    // it("test two users boost vote with boost", async () => {
    //     let eta = time.duration.days(7);
    //     await lock.create_lock(toWei('1'), parseInt(eta));
    //     await lock.connect(dev).create_lock(toWei('1'), parseInt(eta));
    //
    //     await usdc.approve(gauge_usdc.address, toWei('10000000'));
    //     await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
    //     await gauge_usdc.deposit(toWei('10'), 1);
    //     await gauge_usdc.connect(dev).deposit(toWei('10'), 2);
    //
    //     await boost.updatePool(0);
    //
    //     let lastBlock = await time.latestBlock();
    //     // await time.advanceBlockTo(parseInt(lastBlock) + 1);
    //     console.log("lastBlock:" + lastBlock)
    //
    //     await gauge_usdc.getReward(owner.address, [fxs.address])
    //     await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address])
    //
    //     let ownerAft = await fxs.balanceOf(owner.address)
    //     let devAft = await fxs.balanceOf(dev.address)
    //
    //     await boost.vote(1, [usdc.address], [toWei('1')]);
    //     await boost.connect(dev).vote(2, [usdc.address], [toWei('1')]);
    //
    //     lastBlock = await time.latestBlock();
    //     ///await time.advanceBlockTo(parseInt(lastBlock) + 1);
    //     console.log("lastBlock:" + lastBlock);
    //
    //     await gauge_usdc.getReward(owner.address, [fxs.address]);
    //     await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address]);
    //     let ownerAft1 = await fxs.balanceOf(owner.address);
    //     let devAft1 = await fxs.balanceOf(dev.address);
    //
    //     let ownerDiff = BigNumber.from(ownerAft1).sub(ownerAft);
    //     let devDiff = BigNumber.from(devAft1).sub(devAft);
    //     expect(ownerDiff).to.be.eq("19992");
    //     expect(devDiff).to.be.eq("17301");
    //
    //
    // });


});
