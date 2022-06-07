const {time} = require("@openzeppelin/test-helpers");
const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetRusdAndTra} = require("./Utils/GetStableConfig");

contract('Dao locker', async function () {
    const ONE_DAT_DURATION = 86400;

    async function getGaugesInBoost(poolAddress, approveNumber = toWei("100")) {
        const Gauge = await ethers.getContractFactory("Gauge");
        gaugeAddress = await boost.gauges(poolAddress.address);
        gauge = await Gauge.attach(gaugeAddress);
        await poolAddress.approve(gauge.address, approveNumber);
        return gauge;
    }

    beforeEach(async function (){
        [owner, dev] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        await rusd.transfer(dev.address, toWei("0.5"));
        await tra.transfer(dev.address, toWei("0.5"));

        [usdc] = await GetMockToken(1, [owner, dev], toWei("10"));

        // Mint
        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOpera.address, tra.address, ONE_DAT_DURATION);

        // Tra will be giving to the user as reward
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
        await locker.createLock(toWei("0.1"), ONE_DAT_DURATION); // Stake toWei("0.1") tra token
        tokenId = await locker.tokenId();
    });

    it('Call the function removeBoosts', async function () {
        await locker.addBoosts(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(true);
        await expect(locker.removeBoosts(gaugeController.address)).to.emit(locker, 'BoostRemoved')
            .withArgs(gaugeController.address);
        expect(await locker.boosts(gaugeController.address)).to.be.eq(false);
    });

    it('Call the function about approve and change operator', async function () {
        await locker.createLockFor(toWei("0.1"), ONE_DAT_DURATION, dev.address);
        secondTokenId = await locker.tokenId();
        expect(tokenId).to.be.eq(1);
        expect(secondTokenId).to.be.eq(2);

        expect(await locker.isApprovedForAll(owner.address, owner.address)).to.be.eq(false);
        await expect(locker.setApprovalForAll(dev.address, true)).to.emit(locker, 'ApprovalForAll')
            .withArgs(owner.address, dev.address, true);
    });

    it('Call the function about transfer', async function () {
        await locker.createLockFor(toWei("0.1"), ONE_DAT_DURATION, dev.address);
        secondTokenId = await locker.tokenId();

        await locker.safeTransferFrom(
            owner.address,
            dev.address,
            tokenId,
            ""
        );
    });
});