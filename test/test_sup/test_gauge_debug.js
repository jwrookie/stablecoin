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
        [owner, dev] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        await rusd.transfer(dev.address, toWei("0.5"));
        await tra.transfer(dev.address, toWei("0.5"));

        [usdc] = await GetMockToken(1, [owner, dev], toWei("1"));

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
        await boost.createGauge(usdc.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote
        gauge = await getGaugesInBoost(usdc);

        await gaugeController.addPool(usdc.address);
        await locker.addBoosts(boost.address);
        await locker.addBoosts(gaugeController.address);
    });

    it('Observe the acceleration effect', async function () {
        await locker.createLock(toWei("0.5"), ONE_DAT_DURATION);
        tokenId = await locker.tokenId();
        await locker.connect(dev).createLock(toWei("0.5"), ONE_DAT_DURATION);
        seTokenId = await locker.tokenId();

        await gauge.deposit(toWei("0.5"));
        await usdc.connect(dev).approve(gauge.address, toWei("1"));
        await gauge.connect(dev).deposit(toWei("0.5"));
        await boost.massUpdatePools();

        let ownerBef = await tra.balanceOf(owner.address);
        let devBef = await tra.balanceOf(dev.address);
        expect(ownerBef).to.be.eq(toWei('299999999'));
        expect(devBef).to.be.eq(0);

        await boost.vote(tokenId, [usdc.address], [toWei("1")]);

        // let pendingAmount = await gauge.pendingMax(owner.address);
        // console.log(await boost.weights(owner.address));
        // console.log(pendingAmount);
        // console.log("boost weight:\t" + await gauge.derivedBalance_test2(owner.address, pendingAmount));
        // console.log("boost user weight:\t" + await gauge.derivedBalance_test3(owner.address, pendingAmount));
        // console.log("boost sum:\t" + await gauge.derivedBalance_test4(owner.address, pendingAmount));

        await gauge.getReward(owner.address);
        await gauge.connect(dev).getReward(dev.address);

        let ownerAft = await tra.balanceOf(owner.address);
        let devAft = await tra.balanceOf(dev.address);
        console.log(ownerAft);
        console.log(ownerBef);
        // expect(ownerAft).to.be.eq(toWei('299999999.4375'));
        // expect(devAft).to.be.eq(toWei('0.1575'));

    });
});