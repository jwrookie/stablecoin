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

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");
        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));

        CheckOper = await ethers.getContractFactory("CheckOper");
        checkOper = await CheckOper.deploy(operatable.address);

        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);


        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(usdc.address, parseInt(eta));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy();

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            "10000",
            parseInt(lastBlock),
            10
        );

        await frax.addPool(boost.address);
        await frax.addPool(owner.address);
        await lock.setVoter(boost.address);
        // const Gauge = await ethers.getContractFactory('Gauge');
        // gauge = await Gauge.deploy(fxs.address, lock.address, boost.address);


    });
    it('should createGauge correct', async () => {
        console.log("fxs:" + await fxs.balanceOf(owner.address))
        await boost.createGauge(usdc.address, "100", true);

        // gaugeAddr = await gaugeFactory.last()
        let gaugeAddr = await boost.gauges(usdc.address)

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge = await Gauge.attach(gaugeAddr)
        expect(gauge.address).to.be.eq(gaugeAddr)


        expect(await boost.poolLength()).to.be.eq(1);

        expect(await boost.isGauge(gauge.address)).to.be.eq(true);
        expect(await boost.poolForGauge(gauge.address)).to.be.eq(usdc.address)

        await frax.addPool(gauge.address);

        // stratBlock = await time.latestBlock();
        // // console.log("block:" + stratBlock);
        // await time.advanceBlockTo(parseInt(stratBlock) + 10);
        // console.log("fxs:" + await fxs.balanceOf(boost.address))

        await usdc.approve(lock.address, toWei('1000'))
        //  await fxs.connect(dev).approve(lock.address, toWei('1000'))
        let eta = time.duration.days(1);
        // console.log("eta:" + parseInt(eta));

        await lock.create_lock("1000", parseInt(eta));

        // await frax.addPool(dev.address)
        // await fxs.poolMint(dev.address, toWei('1'))
        //  await lock.connect(dev).create_lock_for("1000", parseInt(eta), dev.address);
        await usdc.approve(gauge.address, toWei('1000'))
        // await fxs.connect(dev).approve(gauge.address, toWei('1000'))

        expect(await lock.ownerOf(1)).to.be.eq(owner.address)
        expect(await gauge.tokenIds(owner.address)).to.be.eq(0)

        await gauge.deposit("1000", 1);
        console.log("usdc:" + await usdc.balanceOf(owner.address))

        //  await gauge.connect(dev).deposit("1000", 2);
        stratBlock = await time.latestBlock();
        // console.log("block:" + stratBlock);
        await time.advanceBlockTo(parseInt(stratBlock) + 10);

        //await gauge.earned(usdc.address, owner.address)

        expect(await gauge.isReward(lock.address)).to.be.eq(false)

        let point = await gauge.checkpoints(owner.address, 0)
        console.log("timestamp:" + point[0])
        console.log("balanceOf:" + point[1])
        await boost.poke(1)
        result =await boost.getPoolVote(1);
        // console.log("poolVote:" + result[0])//error
        //
        // console.log('rewardPerTokenCheckpoints:' + await gauge.rewardPerTokenCheckpoints(lock.address, 0))
        // await gauge.getReward(owner.address, [fxs.address])
        //
        // console.log("fxs:" + await fxs.balanceOf(owner.address))
        // await gauge.withdraw("1000");
        // console.log("owner:" + await fxs.balanceOf(owner.address))
        //
        //  await time.increase(time.duration.days(4));
        // await lock.withdraw(1);
        // console.log("owner:" + await fxs.balanceOf(owner.address))

    });


});