const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', () => {
    async function getBefore(rewardContract, account, rewardAddress, rewardToken) {
        let rewardTokenArray = new Array();
        rewardTokenArray.push(rewardToken);
        await rewardContract.connect(account).getReward(rewardAddress, rewardTokenArray);
        return parseInt(await fxs.balanceOf(account.address));
    }

    async function getAfter(boostContract, tokenId, poolVote, poolWeight, rewardContract, account, rewardAddress, rewardToken) {
        let poolVoteArray = new Array();
        let poolWeightArray = new Array();

        poolVoteArray.push(poolVote);
        poolWeightArray.push(poolWeight);

        await boostContract.connect(account).vote(tokenId, poolVoteArray, poolWeightArray);
        await getBefore(rewardContract, account, rewardAddress, rewardToken);

        return parseInt(await fxs.balanceOf(account.address));
    }

    async function getCurrentBlock() {
        return parseInt(await time.latestBlock());
    }

    async function getDifference() {
        let before = await getBefore(gauge_usdc, dev, dev.address, fxs.address);
        let after = await getAfter(boost, 1, usdc.address, toWei('1'), gauge_usdc, dev, dev.address, fxs.address);
        return after - before;
    }

    async function getRewardAndPrint() {
        result = await gauge_usdc.userInfo(dev.address);
        console.log("rewardDebt:" + result.rewardDebt);
        console.log("accTokenPerShare:" + await gauge_usdc.accTokenPerShare());
        console.log("tokenPerBlock:" + await gauge_usdc.tokenPerBlock());
        // console.log("derivedBalance:" + await gauge_usdc.derivedBalance(dev.address));
        console.log("totalSupply:" + await gauge_usdc.totalSupply());
        console.log("_supply:" + await boost.weights(usdc.address));
        console.log("_adjusted:" + await boost.votes(1, usdc.address));
        console.log("useVe:" + await lock.balanceOfNFT(1));
        console.log("get reward befor blocknum:" + await getCurrentBlock());
        let beforeBalance = await fxs.balanceOf(dev.address);
        await gauge_usdc.connect(dev).getReward(dev.address);
        let afterBalance = await fxs.balanceOf(dev.address);
        let diffBef = afterBalance.sub(beforeBalance);
        console.log("increase:" + diffBef);
        console.log("get reward after blocknum:" + await getCurrentBlock());
    }

    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        await busd.mint(owner.address, toWei('1000'))

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        await usdc.mint(owner.address, toWei('1'));
        await busd.mint(owner.address, toWei('1'))

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let lastBlock = await time.latestBlock();

        const Locker = await ethers.getContractFactory('Locker');
        // let eta = time.duration.days(1);
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt('1800'));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(operatable.address);

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            operatable.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            toWei("1"),
            parseInt(lastBlock),
            "1000"
        );

        await lock.addBoosts(boost.address);
        await usdc.mint(owner.address, toWei('1000'));
        // await fxs.connect(dev).approve(lock.address, toWei('10000'));
        await fxs.approve(lock.address, toWei('10000'));
        await usdc.mint(dev.address, toWei('10000000'));

        await boost.createGauge(usdc.address, "100", true);
        await boost.createGauge(busd.address, "100", true);

        gaugeAddr = await boost.gauges(usdc.address);
        gaugeAddr1 = await boost.gauges(busd.address);

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge_usdc = await Gauge.attach(gaugeAddr);
        gauge_busd = await Gauge.attach(gaugeAddr1);
        expect(gauge_usdc.address).to.be.eq(gaugeAddr);

        // expect(await boost.poolLength()).to.be.eq(1);
        //
        // expect(await boost.isGauge(gauge_usdc.address)).to.be.eq(true);
        // expect(await boost.poolForGauge(gauge_usdc.address)).to.be.eq(usdc.address);
        // await busd.mint(dev.address, toWei('100'));

        await fxs.addPool(boost.address);

        await fxs.transfer(dev.address, toWei('10'));
        await fxs.connect(dev).approve(gauge_usdc.address, toWei('100000'))
        await fxs.connect(dev).approve(lock.address, toWei('100000'))
        await fxs.approve(gauge_busd.address, toWei('100000'))
        await fxs.approve(lock.address, toWei('100000'))


    });
    // it("test boost vote without boost", async () => {
    //     let eta = time.duration.days(7);
    //     await lock.create_lock(toWei('1000'), parseInt(eta));
    //
    //     await usdc.approve(gauge_usdc.address, toWei('10000000'));
    //     await gauge_usdc.deposit(toWei('10'), 1);
    //
    //     await boost.updatePool(0);
    //
    //     // let lastBlock = await time.latestBlock();
    //     //await time.advanceBlockTo(parseInt(lastBlock) + 1);
    //     console.log("get reward befor blocknum:" + await getCurrentBlock());
    //
    //     console.log("fxs:" + await fxs.balanceOf(owner.address))
    //      let rewardOwner = await gauge_usdc.pendingMax(owner.address)
    //     console.log("rewardOwner:" + rewardOwner)
    //     let rewardOwner1 = await gauge_usdc.pending(owner.address)
    //     console.log("rewardOwner1:" + rewardOwner1)
    //
    //     await gauge_usdc.connect(owner).getReward(owner.address)
    //     console.log("get reward aft blocknum:" + await getCurrentBlock());
    //     console.log("fxs:" + await fxs.balanceOf(owner.address))
    //
    //     console.log("---------------------------")
    //
    //
    //     await gauge_usdc.connect(owner).getReward(owner.address)
    //     console.log("fxs:" + await fxs.balanceOf(owner.address))
    //     console.log("get reward aft1 blocknum:" + await getCurrentBlock());
    //
    //     await gauge_usdc.connect(owner).getReward(owner.address)
    //     console.log("fxs:" + await fxs.balanceOf(owner.address))
    //
    //     await gauge_usdc.connect(owner).getReward(owner.address)
    //     console.log("fxs:" + await fxs.balanceOf(owner.address))
    //
    //
    // });
    it("test boost vote with boost", async () => {
        let eta = time.duration.days(1);
        await lock.create_lock(toWei('1000'), parseInt(eta));

        await usdc.approve(gauge_usdc.address, toWei('10000000'));
        await busd.approve(gauge_busd.address, toWei('10000000'));
        await gauge_usdc.deposit(toWei('10'), 1);
        await gauge_busd.deposit(toWei('10'), 1);
        //
        await boost.updatePool(0);
        await boost.updatePool(1);
        //
        // // let lastBlock = await time.latestBlock();
        // // await time.advanceBlockTo(parseInt(lastBlock) + 1);
        // // console.log("get reward befor blocknum:" + await getCurrentBlock());
        // // let rewardOwner = await gauge_usdc.pendingMax(owner.address)
        // // console.log("rewardOwner:" + rewardOwner)
        // // let rewardOwner1 = await gauge_usdc.pending(owner.address)
        // // console.log("rewardOwner1:" + rewardOwner1)
        // //
        // // console.log("fxs:" + await fxs.balanceOf(owner.address))
        // // await gauge_usdc.connect(owner).getReward(owner.address)
        // // console.log("get reward aft blocknum:" + await getCurrentBlock());
        // // console.log("fxs:" + await fxs.balanceOf(owner.address))
        //
        //
        // //console.log("---------------------------")
        //
        //
        await boost.connect(owner).vote(1, [usdc.address], [toWei('1')])

        await boost.connect(owner).reset(1)

        await gauge_usdc.deposit(toWei('10'), 1);
        await gauge_busd.deposit(toWei('10'), 1);

         let lastBlock = await time.latestBlock();
        await time.advanceBlockTo(parseInt(lastBlock) + 10);

          await gauge_usdc.deposit(toWei('10'), 1);
        await gauge_busd.deposit(toWei('10'), 1);

       let  rewardOwner = await gauge_usdc.pendingMax(owner.address)
       let  rewardOwner1 = await gauge_usdc.pending(owner.address)

          let multiple = rewardOwner/rewardOwner1
      expect(multiple).to.be.eq(3.3333333333333335);

        await boost.reset(1)

        await time.increase(time.duration.days(1));

        await lock.withdraw(1)
        await gauge_usdc.connect(owner).getReward(owner.address)

        console.log("fxs:" + await fxs.balanceOf(owner.address))

        await gauge_usdc.connect(owner).getReward(owner.address)
        console.log("fxs:" + await fxs.balanceOf(owner.address))

        await gauge_usdc.connect(owner).getReward(owner.address)
        console.log("fxs:" + await fxs.balanceOf(owner.address))

        await gauge_usdc.connect(owner).withdrawToken(toWei('10'), 1);


    });
    // it("test two users boost vote with boost", async () => {
    //     let eta = time.duration.days(7);
    //     await lock.create_lock(toWei('1'), parseInt(eta));
    //     await lock.connect(dev).create_lock(toWei('1'), parseInt(eta));
    //
    //     await usdc.approve(gauge_usdc.address, toWei('10000000'));
    //     await usdc.connect(dev).approve(gauge_usdc.address, toWei('10000000'));
    //     await gauge_usdc.deposit(toWei('10'), 1);
    //     await gauge_usdc.connect(dev).deposit(toWei('10'), 2);
    //
    //     await boost.updatePool(0);
    //
    //     let lastBlock = await time.latestBlock();
    //     // await time.advanceBlockTo(parseInt(lastBlock) + 1);
    //     console.log("lastBlock:" + lastBlock)
    //
    //     await gauge_usdc.getReward(owner.address, [fxs.address])
    //     await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address])
    //
    //     let ownerAft = await fxs.balanceOf(owner.address)
    //     let devAft = await fxs.balanceOf(dev.address)
    //
    //     await boost.vote(1, [usdc.address], [toWei('1')]);
    //     await boost.connect(dev).vote(2, [usdc.address], [toWei('1')]);
    //
    //     lastBlock = await time.latestBlock();
    //     ///await time.advanceBlockTo(parseInt(lastBlock) + 1);
    //     console.log("lastBlock:" + lastBlock);
    //
    //     await gauge_usdc.getReward(owner.address, [fxs.address]);
    //     await gauge_usdc.connect(dev).getReward(dev.address, [fxs.address]);
    //     let ownerAft1 = await fxs.balanceOf(owner.address);
    //     let devAft1 = await fxs.balanceOf(dev.address);
    //
    //     let ownerDiff = BigNumber.from(ownerAft1).sub(ownerAft);
    //     let devDiff = BigNumber.from(devAft1).sub(devAft);
    //     expect(ownerDiff).to.be.eq("19992");
    //     expect(devDiff).to.be.eq("17301");
    //
    //
    // });


});
