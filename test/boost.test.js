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
            1000
        );

        await frax.addPool(boost.address);
        await frax.addPool(owner.address);
        await lock.setVoter(boost.address);


    });
    it('should createGauge correct', async () => {
        await usdc.mint(dev.address, toWei('1'))
        await boost.createGauge(usdc.address, "100", true);

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

        await usdc.connect(dev).approve(lock.address, toWei('1000'));
        let eta = time.duration.days(1);
        // console.log("eta:" + parseInt(eta));

        await lock.connect(dev).create_lock_for("1000", parseInt(eta), dev.address);
        await usdc.connect(dev).approve(gauge.address, toWei('1000'))

        // expect(await lock.ownerOf(1)).to.be.eq(dev.address);
        // expect(await gauge.tokenIds(dev.address)).to.be.eq(0);


        await gauge.connect(dev).deposit("1000", 1);
        // expect(await gauge.tokenIds(owner.address)).to.be.eq(1);
        // console.log("checkpoints:" + await gauge.checkpoints(dev.address, 0))

        // console.log("usdc:" + await usdc.balanceOf(dev.address));
        //await gauge.earned(usdc.address, owner.address)

        await time.increase(time.duration.days(4));
        expect(await usdc.balanceOf(gauge.address)).to.be.eq("1000")

        // await boost.updatePool(0)
        expect(await boost.poolLength()).to.be.eq(1)

        let point = await gauge.checkpoints(dev.address, 0)
        console.log("timestamp:" + point[0])
        console.log("balanceOf:" + point[1])
        expect(await gauge.isReward(fxs.address)).to.be.eq(false);

        //  await time.increase(time.duration.days(4));
        //  console.log("fxs:"+await fxs.balanceOf(boost.address))

        // await gauge.notifyRewardAmount(fxs.address,0)
        // expect(await gauge.isReward(fxs.address)).to.be.eq(true)

        // await boost.vote(1,[],[])
        // console.log("poolVote:" + await boost.poolVote(0, 0))//error

        // expect(await gauge.rewardRate(fxs.address)).to.be.eq(0);
        // await gauge.notifyRewardAmount(fxs.address,0)

        // console.log("rewardPerTokenNumCheckpoints:" + await gauge.rewardPerTokenNumCheckpoints(fxs.address))
        // console.log('rewardPerTokenCheckpoints:' + await gauge.rewardPerTokenCheckpoints(fxs.address, 0))

      //  console.log("rewardRate:" + await gauge.rewardRate(fxs.address))

        let info = await boost.poolInfo(0)
        expect(info[0]).to.be.eq(usdc.address);
        expect(info[1]).to.be.eq('100');
        console.log("lastRewardBlock:" + info[2]);

        expect(await boost.LpOfPid(usdc.address)).to.be.eq(0);
        expect(await boost.totalAllocPoint()).to.be.eq("100");

        expect(await gauge.isReward(fxs.address)).to.be.eq(false)
        //await gauge.notifyRewardAmount(usdc.address, "6000")
        console.log("rewardRate:" + await gauge.rewardRate(usdc.address))

        // expect(await gauge.isReward(fxs.address)).to.be.eq(true)

        console.log("minRet:" + await fxs.balanceOf(boost.address))
        // expect(await boost.tokenPerBlock()).to.be.eq("10000")
        //expect(await gauge.isReward(fxs.address)).to.be.eq(true)
        await gauge.connect(dev).getReward(dev.address, [fxs.address])
        // console.log(await gauge.rewardPerTokenStored(fxs.address))
        //
        // console.log("fxs:" + await fxs.balanceOf(dev.address))
        // await gauge.connect(dev).withdraw("1000");
        // console.log("dev:" + await usdc.balanceOf(dev.address))
        //
        //  await time.increase(time.duration.days(4));
        // await lock.connect(dev).withdraw(1);
        // console.log("dev:" + await usdc.balanceOf(dev.address))

    });


});