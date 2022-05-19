const {GetRusdAndTra,SetRusdAndTraConfig} = require("./Utils/GetStableConfig");
const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetGauge, GetBoost} = require("./Utils/GetGaugeAboutBoost");
const {expect} = require("chai");
const {BigNumber} = require('ethers');
const {toWei, fromWei, toBN} = require("web3-utils");
const {ZEROADDRESS} = require("./Lib/Address");

contract('Boost、Gauge、GaugeController', async function () {
    const ONE_DAT_DURATION = 86400;
    const PERIOD = 10;
    let tokenId;

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [, , checkOpera, rusd, tra] = await GetRusdAndTra();
        await SetRusdAndTraConfig(rusd, tra);
        await rusd.transfer(dev.address, toWei("0.5"));
        await tra.transfer(dev.address, toWei("0.5"));

        // Mock
        [usdc, token0] = await GetMockToken(2, [owner, dev], toWei("10"));

        // Set lock
        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOpera.address, tra.address, ONE_DAT_DURATION);
        await tra.connect(owner).approve(locker.address, toWei("0.5"));
        await tra.connect(dev).approve(locker.address, toWei("0.5"));

        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(checkOpera.address);

        startBlock = await time.latestBlock();
        initStartBlock = startBlock;

        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOpera.address,
            locker.address,
            gaugeFactory.address,
            tra.address,
            toWei("1"),
            parseInt(initStartBlock),
            10
        );

        await tra.addPool(boost.address); // Mint tra in boost as swap token

        boostDurationTime = "10000";

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOpera.address,
            boost.address,
            locker.address,
            boostDurationTime
        );

        await boost.addController(gaugeController.address); // Authorize to vote
        await boost.createGauge(rusd.address, toWei("0.5"), false);
        gauge = await GetGauge(boost, rusd);
        await rusd.approve(gauge.address, toWei("0.5"));
        await rusd.connect(dev).approve(gauge.address, toWei("0.5"));
        await locker.addBoosts(gaugeController.address);
        await locker.addBoosts(boost.address);
        await locker.create_lock(toWei("0.1"), ONE_DAT_DURATION); // Stake toWei("0.1") tra token
        tokenId = await locker.tokenId();
    });

    it('test Single user user multiple gauge strategies to vote and get reward will fail', async function () {
        await boost.createGauge(token0.address, toWei("0.5"), false);
        let token0Gauge = await GetGauge(boost, token0);
        await token0.approve(token0Gauge.address, toWei("0.5"));

        await gaugeController.setDuration(ONE_DAT_DURATION);
        await gaugeController.addPool(gauge.address);
        await gaugeController.addPool(token0.address);

        await gauge.deposit(toWei("0.1"), tokenId);
        await token0Gauge.deposit(toWei("0.1"), tokenId); // Because deposit will transfer from user to pool

        await gaugeController.vote(tokenId, await gaugeController.getPool(0));
        await expectRevert(gaugeController.vote(tokenId, await gaugeController.getPool(1)), "next duration use");

        let beforGetReward = await tra.balanceOf(owner.address);
        await gauge.getReward(owner.address);
        let afterGetReward = await tra.balanceOf(owner.address);
        let sub = afterGetReward.sub(beforGetReward);
        expect(fromWei(toBN(sub))).to.be.eq("0.96");

        await token0Gauge.getReward(owner.address);
        expect(await tra.balanceOf(owner.address)).to.be.eq(afterGetReward);
    });

    it('test Single user to speed multiple gauge strategies and get reward', async function () {
        await boost.createGauge(token0.address, toWei("0.5"), false);
        let token0Gauge = await GetGauge(boost, token0);
        await token0.approve(token0Gauge.address, toWei("0.5"));

        await gauge.deposit(toWei("0.1"), tokenId);
        await token0Gauge.deposit(toWei("0.1"), tokenId); // Because deposit will transfer from user to pool

        expect(await tra.balanceOf(boost.address)).to.be.eq(0);
        await boost.vote(tokenId, [rusd.address, token0.address], [toWei("0.1"), toWei("0.1")]);

        let beforeGetReward = await tra.balanceOf(owner.address);
        await gauge.getReward(owner.address);
        let afterGetReward = await tra.balanceOf(owner.address);
        let sub = afterGetReward.sub(beforeGetReward);

        await token0Gauge.getReward(owner.address);
        let latestGetReward = await tra.balanceOf(owner.address);
        let secondSub = latestGetReward.sub(afterGetReward);
        expect(fromWei(toBN(secondSub))).to.be.eq(fromWei(toBN(sub)));
    });

    it('test Single user use gauge strategies to deposit and use boost strategies to speeding and than tokenperblock change to eighty percent', async function () {
        await gaugeController.setDuration(parseInt(await time.duration.days(1)));
        await gaugeController.addPool(rusd.address);

        await gauge.deposit(toWei("0.000001"), tokenId);

        // Waiting block
        await time.advanceBlockTo(parseInt(await time.latestBlock()) + 2 * PERIOD);
        currentBlock = parseInt(await time.latestBlock());

        // About reduce
        await boost.setMinTokenReward(5000);
        await gauge.getReward(owner.address);
        expect(await gauge.tokenPerBlock()).to.be.eq(BigNumber.from(toWei("1")).mul(80).div(100));
    });

    it('test More users use gauge strategies', async function () {
        /*
        Two pools of two users,
        where one user speeds up and the other user doesn't speed up to see the difference in rewards
         */
        await boost.createGauge(token0.address, toWei("0.5"), false);
        let token0Gauge = await GetGauge(boost, token0);
        await token0.approve(token0Gauge.address, toWei("0.5"));
        await token0.connect(dev).approve(token0Gauge.address, toWei("0.5"));

        await locker.create_lock_for(toWei("0.1"), ONE_DAT_DURATION, dev.address); // Stake toWei("0.1") tra token
        let devTokenId = await locker.tokenId();

        await gauge.deposit(toWei("0.1"), tokenId);
        await token0Gauge.deposit(toWei("0.1"), tokenId); // Because deposit will transfer from user to pool
        await gauge.connect(dev).deposit(toWei("0.1"), devTokenId);
        await token0Gauge.connect(dev).deposit(toWei("0.1"), devTokenId);

        await boost.vote(tokenId, [rusd.address, token0.address], [toWei("0.1"), toWei("0.1")]);

        let beforeGetReward = await tra.balanceOf(owner.address);
        let initPerBlock = await gauge.pendingMax(dev.address);
        await gauge.getReward(owner.address);
        let afterGetReward = await tra.balanceOf(owner.address);
        let afterOwnerGetReward = await gauge.pendingMax(dev.address);
        let secondSub = afterOwnerGetReward.sub(initPerBlock);
        expect(fromWei(toBN(secondSub))).to.be.eq("0.2");
        let sub = afterGetReward.sub(beforeGetReward);
        expect(fromWei(toBN(sub))).to.be.eq("1");
    });

    it('test More users and get reward', async function () {
        /*
        One of them is not accelerated, the other one is only accelerated
         */
        await boost.createGauge(token0.address, toWei("0.5"), false);
        let token0Gauge = await GetGauge(boost, token0);
        await token0.approve(token0Gauge.address, toWei("0.5"));
        await token0.connect(dev).approve(token0Gauge.address, toWei("0.5"));

        await locker.create_lock_for(toWei("0.1"), ONE_DAT_DURATION, dev.address); // Stake toWei("0.1") tra token
        let devTokenId = await locker.tokenId();

        await gauge.connect(dev).deposit(toWei("0.1"), devTokenId);
        await token0Gauge.connect(dev).deposit(toWei("0.1"), devTokenId); // Because deposit will transfer from user to pool

        await boost.vote(tokenId, [rusd.address, token0.address], [toWei("0.1"), toWei("0.1")]);
        expect(await gauge.pendingMax(owner.address)).to.be.eq(0);
    });
});