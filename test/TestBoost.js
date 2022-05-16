const {GetRusdAndTra,SetRusdAndTraConfig} = require("./Utils/GetStableConfig");
const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {GetMockToken} = require("./Utils/GetMockConfig");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {ZEROADDRESS} = require("./Lib/Address");

contract("About Dao", async function () {
    const ONE_DAT_DURATION = 86400;
    let initStartBlock;

    async function getGaugesInfo() {
        let gaugeArray = new Array();
        let poolInfoLength = await boost.poolLength();

        if (poolInfoLength === 0) {
            return Error("First need to create a gauge!");
        }

        for (let i = 0; i < poolInfoLength; i++) {
            poolAddress = await boost.poolInfo(i);
            gaugesInfo = await boost.gauges(poolAddress[0]);
            gaugeArray.push(gaugesInfo);
        }

        return gaugeArray;
    }

    async function getBoostLpOfPid(poolAddress) {
        if (null === poolAddress || undefined === poolAddress || poolAddress === ZEROADDRESS) {
            return Error("Unknow gauge for pool!");
        }

        let gauge = await getGaugesInfo();

        for (let i = 0; i < gauge.length; i++) {
            pool = await boost.poolForGauge(gauge[i]);
            if (pool === poolAddress.address) {
                return parseInt(await boost.lpOfPid(pool));
            }
        }

        return Error("The address of the pool was not added to struct of poolInfo!");
    }

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [, , checkOpera, rusd, tra] = await GetRusdAndTra();
        await SetRusdAndTraConfig(rusd, tra);
        await rusd.transfer(dev.address, toWei("0.5"));
        await tra.transfer(dev.address, toWei("0.5"));

        // Mock
        [usdc] = await GetMockToken(1, [owner, dev], toWei("10"));

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

        await boost.createGauge(rusd.address, 100000, false);
        const Gauge = await ethers.getContractFactory("Gauge");
        gaugeAddress = await boost.gauges(rusd.address);
        gauge = await Gauge.attach(gaugeAddress);
        await rusd.approve(gauge.address, toWei("1"));
        await usdc.approve(gauge.address, toWei("1"));
        await locker.create_lock(toWei("0.1"), ONE_DAT_DURATION);
        tokenId = await locker.tokenId();
    });

    it('test Single user to deposit and get reward', async function () {
        // Token reward managed all the rewards
        expect(await boost.tokenPerBlock()).to.be.eq(toWei("1"));
        await boost.updatePool(await getBoostLpOfPid(rusd));
        expect(await tra.balanceOf(boost.address)).to.be.eq(0);
        expect(await gauge.accTokenPerShare()).to.be.eq(0);
        expect(await gauge.lastRewardBlock()).to.be.eq(0);

        await gauge.deposit(toWei("0.5"), tokenId);
        await expect(boost.updatePool(await getBoostLpOfPid(rusd))).to.emit(gauge, 'NotifyReward')
            .withArgs(boost.address, tra.address, toWei("0.5"));
    });
});