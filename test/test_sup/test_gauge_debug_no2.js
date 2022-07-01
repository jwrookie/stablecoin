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

        await boost.setMitDuration(1);

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

    it('test boost vote', async function () {
        let fourYearsDuration = parseInt(await time.duration.years(4));
        expect(await gauge.accTokenPerShare()).to.be.eq(0);
        await locker.connect(third).createLock(toWei("0.3"), fourYearsDuration);
        let thirdTokenId = await locker.tokenId();

        await usdc.connect(third).approve(gauge.address, toWei("1000"));
        await gauge.connect(third).deposit(toWei("0.1"));
        await boost.connect(third).vote(thirdTokenId, [usdc.address], [toWei("0.1")]);
        let balanceOfGauge = await tra.balanceOf(gauge.address);
        let thirdBalanceOfGauge = await gauge.pending(third.address);
        expect(thirdBalanceOfGauge).to.be.gt(balanceOfGauge);
        await expect(gauge.connect(third).getReward(third.address)).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
        await boost.setMitDuration(360 * 28800);
        await boost.updateAll();
        await gauge.connect(third).getReward(third.address);
    });

    it('test no deposit get reward', async function () {
        let fourYearsDuration = parseInt(await time.duration.years(4));
        await locker.createLock(toWei("0.3"), fourYearsDuration);

        let initBalance = await tra.balanceOf(owner.address);
        await gauge.getReward(owner.address);
        let afterBalance = await tra.balanceOf(owner.address);
        expect(initBalance).to.be.eq(afterBalance);
        await expect(gauge.emergencyWithdraw()).to.be.revertedWith("amount >0");
    });

    it('test deposit and emergency withdraw', async function () {
        let fourYearsDuration = parseInt(await time.duration.years(4));
        await locker.createLock(toWei("0.3"), fourYearsDuration);
        let tokenId = await locker.tokenId();

        await usdc.approve(gauge.address, toWei("1000"));
        await gauge.deposit(toWei("0.1"));
        await boost.vote(tokenId, [usdc.address], [toWei("0.1")]);
        let beforGetReward = await tra.balanceOf(owner.address);
        let pendingAmountNumber = await gauge.pending(owner.address);
        let userInfo = await gauge.userInfo(owner.address);
        let userAmount = userInfo[0];
        expect(userAmount).to.be.eq(toWei("0.1"));
        let initTotalSupply = await gauge.totalSupply();
        await gauge.emergencyWithdraw();
        userInfo = await gauge.userInfo(owner.address);
        userAmount = userInfo[0];
        expect(userAmount).to.be.eq(0);
        expect(await gauge.totalSupply()).to.be.lt(initTotalSupply);
        let afterGetReward = await tra.balanceOf(owner.address);
        expect(afterGetReward.sub(BigNumber.from(beforGetReward.toString()))).to.be.gt(pendingAmountNumber);
    });
});