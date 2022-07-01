const {BigNumber} = require("ethers");
const {time, expectRevert} = require("@openzeppelin/test-helpers");
const {ethers} = require("hardhat");
const {toWei, fromWei, toBN} = web3.utils;
const {GetMockToken} = require("../util/GetMockConfig");
const {GetRusdAndTra} = require("../util/GetStableConfig");
const GAS = {gasLimit: "9550000"};

describe('Dao Locker Supplement', function () {
    const ONE_DAT_DURATION = 86400;

    async function getGaugesInBoost(poolAddress, approveNumber = toWei("100")) {
        const Gauge = await ethers.getContractFactory("Gauge");
        gaugeAddress = await boost.gauges(poolAddress.address);
        gauge = await Gauge.attach(gaugeAddress);
        await poolAddress.approve(gauge.address, approveNumber);
        return gauge;
    }

    beforeEach(async function () {
        [owner, dev, third] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        await rusd.transfer(dev.address, toWei("0.3"));
        await tra.transfer(dev.address, toWei("0.3"));
        await tra.transfer(third.address, toWei("0.3"));

        [usdc] = await GetMockToken(1, [owner, dev, third], toWei("1"));

        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOpera.address, tra.address, ONE_DAT_DURATION);

        await tra.approve(locker.address, toWei("0.5"));
        await tra.connect(dev).approve(locker.address, toWei("0.5"));
        await tra.connect(third).approve(locker.address, toWei("0.5"));

        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(checkOpera.address);

        // startBlock = await time.latestBlock();
        // initStartBlock = parseInt(startBlock);

        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOpera.address,
            locker.address,
            gaugeFactory.address,
            tra.address,
            toWei("1"),
            1,
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
        await boost.createGauge(usdc.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGaugesInBoost(usdc);

        await gaugeController.addPool(usdc.address);
        await locker.addBoosts(boost.address);
        await locker.addBoosts(gaugeController.address);
    });

    it('test boost so big', async function () {
        await locker.createLock(toWei("0.3"), ONE_DAT_DURATION);
        await locker.connect(dev).createLock(toWei("0.3"), ONE_DAT_DURATION);

        await usdc.approve(gauge.address, toWei("1000"));
        await gauge.deposit(toWei("0.1"));
        let beforeGetRewardBlock = await time.latestBlock();
        let diffBlock = parseInt(beforeGetRewardBlock);
        console.log(diffBlock);
        await boost.massUpdatePools();
        let beforGetRewardOwner = await tra.balanceOf(owner.address);
        let acc = await gauge.accTokenPerShare();
        let totalSupply = await gauge.totalSupply();
        let userInfo = await gauge.userInfo(owner.address);
        let userAmount = userInfo[0];
        let userDe = userInfo[1];
        console.log("userAmount:\t" + fromWei(toBN(userAmount)));
        console.log("userDe:\t" + fromWei(toBN(userDe)));
        console.log("acc:\t" + fromWei(toBN(acc)));
        console.log("totalSupply:\t" + fromWei(toBN(totalSupply)));
        let cal = userAmount.mul(acc).div(1e12).sub(userDe);
        console.log("calReward:\t" + fromWei(toBN(cal.mul(30).div(100))));

        await gauge.getReward(owner.address);
        let afterGetRewardOwner = await tra.balanceOf(owner.address);
        let ownerReward = afterGetRewardOwner.sub(beforGetRewardOwner);
        console.log(fromWei(toBN(ownerReward)));
        console.log("beforeBlock:\t" + parseInt(await time.latestBlock()));
        await time.advanceBlockTo(parseInt(await time.latestBlock()) + 1);
        console.log("afterBlock:\t" + parseInt(await time.latestBlock()));
        await gauge.getReward(owner.address);
        let afterAfterGetRewardOwner = await tra.balanceOf(owner.address);
        let diffSecond = afterAfterGetRewardOwner.sub(afterGetRewardOwner);
        console.log(fromWei(toBN(diffSecond)));
    });
});