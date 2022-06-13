const {time, expectRevert} = require("@openzeppelin/test-helpers");
const {ethers} = require("hardhat");
const {toWei, fromWei, toBN} = web3.utils;
const {GetRusdAndTra} = require("./Utils/GetStableConfig");
const GAS = {gasLimit: "9550000"};

describe('Dao Locker Q', function () {
    const ONE_DAT_DURATION = 86400;

    async function getGaugesInBoost(poolAddress, approveNumber = toWei("100")) {
        const Gauge = await ethers.getContractFactory("Gauge");
        gaugeAddress = await boost.gauges(poolAddress.address);
        gauge = await Gauge.attach(gaugeAddress);
        await poolAddress.approve(gauge.address, approveNumber);
        return gauge;
    }

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        await rusd.transfer(dev.address, toWei("0.5"));
        await tra.transfer(dev.address, toWei("0.5"));

        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOpera.address, tra.address, ONE_DAT_DURATION);

        await tra.approve(locker.address, toWei("0.5"));
        await tra.connect(dev).approve(locker.address, toWei("0.5"));

        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(checkOpera.address);

        startBlock = await time.latestBlock();
        initStartBlock = parseInt(startBlock);

        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOpera.address,
            locker.address,
            gaugeFactory.address,
            tra.address,
            10000,
            parseInt(initStartBlock),
            10
        );

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOpera.address,
            boost.address,
            locker.address,
            ONE_DAT_DURATION
        );

        await tra.addPool(boost.address);
        // Create a gauge pool
        await boost.createGauge(rusd.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGaugesInBoost(rusd);
    });

    it('Two user,first deposit do not create lock second create lock and transfer veToken', async function () {
        expect(await tra.balanceOf(dev.address)).to.be.eq(toWei("0.5"));
        await locker.connect(dev).createLock(toWei("0.5"), ONE_DAT_DURATION);
        expect(await tra.balanceOf(dev.address)).to.be.eq(0);
        tokenId = await locker.tokenId();

        await gauge.deposit(toWei("1.5"));
        await locker.connect(dev).transferFrom(dev.address, owner.address, tokenId);
        await gauge.withdrawToken(toWei("1.5"));
        await gauge.connect(dev).withdrawToken(0);
        await expectRevert(gauge.connect(dev).withdrawToken(toWei("1.5")), "withdrawSwap: not good");
    });

    it('Two user,first deposit and transfer and second withdrawToken', async function () {
        await locker.createLock(toWei("0.5"), ONE_DAT_DURATION);
        tokenId = await locker.tokenId();

        await gauge.deposit(toWei("1.5"));
        await locker.transferFrom(owner.address, dev.address, tokenId);
        await gauge.connect(dev).withdrawToken(0);
        await expectRevert(gauge.connect(dev).withdrawToken(toWei("1.5")), "withdrawSwap: not good");
        await gauge.withdrawToken(toWei("1.5"));
    });
});