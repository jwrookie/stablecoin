const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const {GetRusdAndTra} = require("./Utils/GetStableConfig");

contract('Dao locker', async function () {
    const ONE_DAT_DURATION = 86400;
    beforeEach(async function (){
        [owner, dev] = await ethers.getSigners();
        [rusd, tra, , checkOpera] = await GetRusdAndTra();
        await rusd.transfer(dev.address, toWei("0.5"));
        await tra.transfer(dev.address, toWei("0.5"));

        // Mint
        const Locker = await ethers.getContractFactory("Locker");
        locker = await Locker.deploy(checkOper.address, tra.address, ONE_DAT_DURATION);

        // Tra will be giving to the user as reward
        await tra.approve(locker.address, toWei("0.5"));
        await tra.connect(dev).approve(locker.address, toWei("0.5"));

        const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
        gaugeFactory = await GaugeFactory.deploy(checkOper.address);

        startBlock = await time.latestBlock();
        initStartBlock = parseInt(startBlock);

        const Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            locker.address,
            gaugeFactory.address,
            tra.address,
            10000,
            parseInt(initStartBlock),
            10
        );

        const GaugeController = await ethers.getContractFactory("GaugeController");
        gaugeController = await GaugeController.deploy(
            checkOper.address,
            boost.address,
            locker.address,
            ONE_DAT_DURATION
        );

        // Create a gauge pool
        await boost.createGauge(rusd.address, 100000, false);
        await boost.addController(gaugeController.address); // Vote

    });
});