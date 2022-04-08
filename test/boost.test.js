const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', () => {
    beforeEach(async () => {

        [owner, dev, addr1] = await ethers.getSigners();
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");
        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        MockToken = await ethers.getContractFactory("MockToken");
        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));

        CheckOper = await ethers.getContractFactory("CheckOper");
        checkOper = await CheckOper.deploy(operatable.address);

        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);


        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(fxs.address, parseInt(eta));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy();

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            lock.address,
            gaugeFactory.address,
            fxs.address,
            "10000",
            parseInt(lastBlock),
            10
        );

        await frax.addPool(boost.address);
        await frax.addPool(owner.address);
        await lock.setVoter(boost.address);
        // const Gauge = await ethers.getContractFactory('Gauge');
        // gauge = await Gauge.deploy(fxs.address, lock.address, boost.address);


    });
    it('should createGauge correct', async () => {
        // await fxs.approve(gauge.address, toWei('1000'))
        //await fxs.approve(boost.address, toWei('1000'))

        await boost.createGauge(fxs.address, "100", true);

        // gaugeAddr = await gaugeFactory.last()
        let gaugeAddr = await boost.gauges(fxs.address)

        const Gauge = await ethers.getContractFactory('Gauge');
        gauge = await Gauge.attach(gaugeAddr)
        expect(gauge.address).to.be.eq(gaugeAddr)


        expect(await boost.poolLength()).to.be.eq(1);

        expect(await boost.isGauge(gauge.address)).to.be.eq(true);
        expect(await boost.poolForGauge(gauge.address)).to.be.eq(fxs.address)

        await frax.addPool(gauge.address);
        // await boost.distribute(gauge.address);
        // await boost.poke(1);

        // stratBlock = await time.latestBlock();
        // // console.log("block:" + stratBlock);
        // await time.advanceBlockTo(parseInt(stratBlock) + 10);
        // console.log("fxs:" + await fxs.balanceOf(boost.address))

        await fxs.approve(lock.address, toWei('1000'))
        let eta = time.duration.days(1);
        // console.log("eta:" + parseInt(eta));

        await lock.create_lock("1000", parseInt(eta));
        //  await boost.poke(1);
        await fxs.approve(gauge.address, toWei('1000'))


        expect(await lock.ownerOf(1)).to.be.eq(owner.address)
        expect(await gauge.tokenIds(owner.address)).to.be.eq(0)

        // await lock.approve(boost.address,1)
        // expect(await lock.getApproved(1)).to.be.eq(true)
        //  await boost.updateAll()

        // await boost.poke(1)
        console.log("totalWeight:"+await boost.totalWeight())

        //expect(await boost.isGauge(owner.address)).to.be.eq(false)

        // await boost.attachTokenToGauge(1, owner.address)
         console.log("supply:"+await boost.weights(fxs.address))

        await gauge.deposit("1000", 1);
        // stratBlock = await time.latestBlock();
        // // console.log("block:" + stratBlock);
        // await time.advanceBlockTo(parseInt(stratBlock) + 10);

        await gauge.earned(fxs.address, owner.address)

        // console.log("votes:"+await boost.votes(1,fxs.address))
        //
        // console.log("rewardPerToken:" + await gauge.rewardPerToken(fxs.address))
        //
        // console.log("owner:" + await fxs.balanceOf(owner.address))
        //
        // console.log("------------------")
        // console.log("derivedSupply:" + await gauge.derivedSupply())
        // console.log("derivedBalance:" + await gauge.derivedBalance(owner.address))
        // console.log("gauge:" + await gauge.balanceOf(owner.address))
        // console.log("adjusted:"+await boost.votes(1,fxs.address))
        // console.log("supply:"+await boost.weights(fxs.address))


        // console.log(await gauge.rewardRate(fxs.address))
        // let a = await gauge.rewardPerTokenStored(fxs.address)
        // console.log("a:" + a)
        // expect(await gauge.isReward(fxs.address)).to.be.eq(false)
        // console.log("rewardsListLength:" + await gauge.rewardsListLength())

        // await boost.updatePool(0)

      

        // expect(await gauge.isReward(fxs.address)).to.be.eq(true)
        // await gauge.getReward(owner.address, [fxs.address])
        // console.log("owner:" + await fxs.balanceOf(owner.address))





        // console.log("user_point_epoch:"+await lock.user_point_epoch(1))
        //
        // console.log("user_point_history:"+await lock.user_point_history(1,1))
        // console.log("_weight:"+await lock.balanceOfNFT(1))
        //
        //
        //  stratBlock = await time.latestBlock();
        // // console.log("block:" + stratBlock);
        // await time.advanceBlockTo(parseInt(stratBlock) + 10);
        //  await boost.poke(1)
        // console.log("ownership_change:"+await lock.ownership_change(1))



        await gauge.withdraw("1000");
        console.log("owner:" + await fxs.balanceOf(owner.address))

         await time.increase(time.duration.days(4));
        await lock.withdraw(1);


        console.log("owner:" + await fxs.balanceOf(owner.address))


    });
    // it('should createGauge correct', async () => {
    //
    //     //await fxs.approve(boost.address, toWei('1000'))
    //
    //     await boost.createGauge(usdc.address, "100", true);
    //
    //     // gaugeAddr = await gaugeFactory.last()
    //     let gaugeAddr = await boost.gauges(usdc.address)
    //
    //     const Gauge = await ethers.getContractFactory('Gauge');
    //     gauge = await Gauge.attach(gaugeAddr)
    //     expect(gauge.address).to.be.eq(gaugeAddr)
    //
    //       await usdc.approve(gauge.address, toWei('1000'))
    //
    //
    //     expect(await boost.poolLength()).to.be.eq(1);
    //
    //     expect(await boost.isGauge(gauge.address)).to.be.eq(true);
    //     expect(await boost.poolForGauge(gauge.address)).to.be.eq(usdc.address)
    //
    //     await frax.addPool(gauge.address);
    //     // await boost.distribute(gauge.address);
    //     // await boost.poke(1);
    //
    //     // stratBlock = await time.latestBlock();
    //     // // console.log("block:" + stratBlock);
    //     // await time.advanceBlockTo(parseInt(stratBlock) + 10);
    //     // console.log("fxs:" + await fxs.balanceOf(boost.address))
    //
    //     await fxs.approve(lock.address, toWei('1000'))
    //     let eta = time.duration.days(1);
    //     // console.log("eta:" + parseInt(eta));
    //
    //     await lock.create_lock("1000", parseInt(eta));
    //     //  await boost.poke(1);
    //     await fxs.approve(gauge.address, toWei('1000'))
    //
    //
    //     expect(await lock.ownerOf(1)).to.be.eq(owner.address)
    //     expect(await gauge.tokenIds(owner.address)).to.be.eq(0)
    //
    //     console.log("totalWeight:"+await boost.totalWeight())
    //
    //     //expect(await boost.isGauge(owner.address)).to.be.eq(false)
    //
    //     // await boost.attachTokenToGauge(1, owner.address)
    //      console.log("supply:"+await boost.weights(fxs.address))
    //
    //     await gauge.deposit("1000", 1);
    //     // stratBlock = await time.latestBlock();
    //     // // console.log("block:" + stratBlock);
    //     // await time.advanceBlockTo(parseInt(stratBlock) + 10);
    //
    //     await gauge.earned(fxs.address, owner.address)
    //     expect(await gauge.isReward(usdc.address)).to.be.eq(false)
    //     await gauge.getReward(owner.address, [fxs.address])
    //     console.log("owner:" + await usdc.balanceOf(owner.address))
    //
    //     // await gauge.withdraw("1000");
    //     // console.log("owner:" + await fxs.balanceOf(owner.address))
    //     //
    //     //  await time.increase(time.duration.days(4));
    //     // await lock.withdraw(1);
    //     //
    //     // console.log("owner:" + await fxs.balanceOf(owner.address))
    //
    //
    // });


});