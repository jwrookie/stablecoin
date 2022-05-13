const {GetRusdAndTra,SetRusdAndTraConfig} = require("./Utils/GetStableConfig");
const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {GetMockToken} = require("./Utils/GetMockConfig");
const {expect} = require("chai");
const {ZEROADDRESS} = require("./Lib/Address");

contract("About Dao", async function () {
    const ONE_DAT_DURATION = 86400;
    let initStartBlock;

    beforeEach(async function () {
        [owner, dev] = await ethers.getSigners();
        [, , checkOpera, rusd, tra] = await GetRusdAndTra();
        await SetRusdAndTraConfig(rusd, tra);
        await rusd.transfer(dev.address);
        await tra.transfer(dev.address, toWei("0.5"));

        // Mock
        // [usdc] = await GetMockToken(1, [owner, dev]);

        // Set lock
        // const Locker = await ethers.getContractFactory("Locker");
        // locker = await Locker.deploy(checkOpera, tra, ONE_DAT_DURATION);
        // await tra.connect(owner).approve(locker.address, toWei("0.5"));
        // await tra.connect(dev).approve(locker.address, toWei("0.5"));

        // const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        // gaugeFactory = await GaugeFactory.deploy(checkOper.address);
        //
        // startBlock = await time.latestBlock();
        // initStartBlock = startBlock;
        //
        // const Boost = await ethers.getContractFactory("Boost");
        // boost = await Boost.deploy(
        //     checkOper.address,
        //     locker.address,
        //     gaugeFactory.address,
        //     tra.address,
        //     toWei("1"),
        //     parseInt(initStartBlock),
        //     10
        // );
        //
        // boostDurationTime = "10000";
        //
        // const GaugeController = await ethers.getContractFactory("GaugeController");
        // gaugeController = await GaugeController.deploy(
        //     checkOper.address,
        //     boost.address,
        //     locker.address,
        //     boostDurationTime
        // );
        //
        // await boost.createGauge(rusd.address, 100000, false);
        // const Gauge = await ethers.getContractFactory("Gauge");
        // gaugeAddress = await boost.gauges(rusd.address);
        // gauge = await Gauge.attach(gaugeAddress);
        // await usdc.approve(gauge.address, toWei("1"));
        // await locker.create_lock(toWei("0.1"), ONE_DAT_DURATION);
        // tokenId = await locker.tokenId();
    });

    it('test Single user to deposit and get reward', async function () {
        // Token reward managed all the rewards
        // expect(await boost.tokenPerBlock()).to.be.eq(toWei("1"));
    });
});