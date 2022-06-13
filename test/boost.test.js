const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost test', () => {
    async function getPending(account) {
        let lastBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(lastBlock) + 1);
        let reward = await gauge_usdc.pending(account);

        return reward;
    }

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
        await fxs.transfer(addr1.address, "299000000000000000000000000");
        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");


        MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));
        btc = await MockToken.deploy("btc", "btc", 18, toWei('10'));


        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setStableAddress(frax.address);
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

        await lock.connect(dev).createLock(toWei('10000'), parseInt(eta));
        await lock.createLock(toWei('10'), parseInt(eta));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await fxs.approve(gauge_usdc.address, toWei('10000000'));

        await gauge_usdc.connect(dev).deposit(toWei('1'));
        await gauge_usdc.connect(owner).deposit(toWei('2'));

        let usdcDevBef = await usdc.balanceOf(dev.address);
        let usdcOwnerBef = await usdc.balanceOf(owner.address);

        await boost.updateAll();
        expect(await boost.poolLength()).to.be.eq(2);

        expect(await fxs.balanceOf(dev.address)).to.be.eq(0);
        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('989990'));

        let pendDev = await getPending(dev.address);

        await gauge_usdc.connect(dev).getReward(dev.address);

        let aftDev = await fxs.balanceOf(dev.address);
        expect(aftDev).to.be.eq(pendDev.add("50000000000100000"));

        let pendOwner = await getPending(owner.address);
        let befOwner = await fxs.balanceOf(owner.address);

        await gauge_usdc.getReward(owner.address);

        let aftOwner = await fxs.balanceOf(owner.address);
        let diff = aftOwner.sub(befOwner);

        let reward = BigNumber.from("50000000000100000").mul(2);
        expect(diff).to.be.eq(pendOwner.add(reward));

        await gauge_usdc.connect(dev).withdrawToken(toWei('1'));
        await gauge_usdc.connect(owner).withdrawToken(toWei('2'));

        let usdcDevAft = await usdc.balanceOf(dev.address);
        let usdcOwnerAft = await usdc.balanceOf(owner.address);
        expect(usdcDevAft).to.be.eq(usdcDevBef.add(toWei('1')));
        expect(usdcOwnerAft).to.be.eq(usdcOwnerBef.add(toWei('2')));


    });
    it('should two pools, single user getReward correct', async () => {
        await busd.connect(dev).approve(lock.address, toWei('10000000'));
        await usdc.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        await lock.connect(dev).createLockFor("1000", parseInt(eta), dev.address);

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await busd.connect(dev).approve(gauge_busd.address, toWei('10000000'));

        await gauge_usdc.connect(dev).deposit(toWei('1'));
        let usdcDevBef = await usdc.balanceOf(dev.address);

        await gauge_busd.connect(dev).deposit(toWei('1'));
        let busdDevBef = await busd.balanceOf(dev.address);

        await boost.updatePool(0);
        await boost.updatePool(1);
        let befDev = await fxs.balanceOf(dev.address);

        await gauge_usdc.connect(dev).getReward(dev.address);
        let aftDev = await fxs.balanceOf(dev.address);

        let diff = aftDev.sub(befDev);

        await gauge_busd.connect(dev).getReward(dev.address);
        let aft1Dev = await fxs.balanceOf(dev.address);

        let diff1 = aft1Dev.sub(aftDev);
        expect(diff1).to.be.eq(diff);

        await gauge_usdc.connect(dev).withdrawToken(toWei('1'));
        await gauge_busd.connect(dev).withdrawToken(toWei('1'));

        let usdcDevAft = await usdc.balanceOf(dev.address);
        let busdDevAft = await busd.balanceOf(dev.address);

        expect(usdcDevAft).to.be.eq(usdcDevBef.add(toWei('1')));
        expect(busdDevAft).to.be.eq(busdDevBef.add(toWei('1')));


    });
    it('receive multiple liquidity pool rewards at one time', async () => {
        await busd.connect(dev).approve(lock.address, toWei('10000000'));
        await usdc.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        await lock.connect(dev).createLockFor("1000", parseInt(eta), dev.address);

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await busd.connect(dev).approve(gauge_busd.address, toWei('10000000'));


        await gauge_usdc.connect(dev).deposit(toWei('1'));
        await gauge_busd.connect(dev).deposit(toWei('1'));
        let rewardBef = await fxs.balanceOf(dev.address);
        expect(rewardBef).to.be.eq("9999999999999999999000");

        await boost.updatePool(0);
        await boost.updatePool(1);

        await boost.connect(dev).claimRewards([gauge_usdc.address, gauge_busd.address]);
        let rewardAft = await fxs.balanceOf(dev.address);

        expect(rewardAft).to.be.eq("10001049999999999999000");


    });
    it('test set and setMitDuration ', async () => {
        let info = await boost.poolInfo(0);
        expect(info[1]).to.be.eq("100");
        await boost.set(0, "200", true);
        info = await boost.poolInfo(0);
        expect(info[1]).to.be.eq("200");
        expect(await boost.mintDuration()).to.be.eq("201600")

        await boost.setMitDuration(5 * 28800);
        expect(await boost.mintDuration()).to.be.eq("144000");

        await usdc.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        await lock.connect(dev).createLock("1000", parseInt(eta));
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));

        await gauge_usdc.connect(dev).deposit(toWei('1'));

        expect(await fxs.balanceOf(boost.address)).to.be.eq(0);
        await boost.updatePool(0);
        expect(await fxs.balanceOf(boost.address)).to.be.eq("95999999999999999904000");

        let rewardBef = await fxs.balanceOf(dev.address);
        expect(rewardBef).to.be.eq("9999999999999999999000");

        await gauge_usdc.connect(dev).getReward(dev.address);

        let rewardAft = await fxs.balanceOf(dev.address);

        expect(rewardAft).to.be.eq("10000399999999999599000");


    });
    it("test depositAll and withdrawAll", async () => {
        await usdc.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        await lock.connect(dev).createLock("1000", parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));

        expect(await usdc.balanceOf(dev.address)).to.be.eq(toWei('10000'));
        await gauge_usdc.connect(dev).depositAll();
        expect(await usdc.balanceOf(dev.address)).to.be.eq(0);

        await boost.updatePool(0);
        let befDev = await fxs.balanceOf(dev.address);
        expect(befDev).to.be.eq("9999999999999999999000");

        await gauge_usdc.connect(dev).getReward(dev.address);
        let aftDev = await fxs.balanceOf(dev.address);
        expect(aftDev).to.be.eq("10000299999999999999000");

        await gauge_usdc.connect(dev).withdrawAll();
        expect(await usdc.balanceOf(dev.address)).to.be.eq(toWei('10000'));

    });
    it("test deposit and withdrawToken tokenId is 0", async () => {
        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));

        expect(await usdc.balanceOf(dev.address)).to.be.eq(toWei('10000'));
        await gauge_usdc.connect(dev).deposit(toWei('1'));
        expect(await usdc.balanceOf(dev.address)).to.be.eq(toWei('9999'));

        await gauge_usdc.connect(dev).withdrawToken(toWei('1'));
        expect(await usdc.balanceOf(dev.address)).to.be.eq(toWei('10000'));

    });
    it("test pendingMax is 0", async () => {
        await usdc.connect(dev).approve(lock.address, toWei('10000000'));
        let eta = time.duration.days(1);
        await lock.connect(dev).createLock("1000", parseInt(eta));

        await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
        await gauge_usdc.connect(dev).depositAll();

        let pend = await gauge_usdc.pendingMax(dev.address);
        expect(pend).to.be.eq(0);

        await boost.updatePool(0);
        pend = await gauge_usdc.pendingMax(dev.address);
        expect(pend).to.be.eq("500000000000000000");


    });


});