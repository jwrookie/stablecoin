const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');

const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');

contract('Boost', () => {
    beforeEach(async () => {

        [owner, dev, addr1] = await ethers.getSigners();
        // TestERC20 = await ethers.getContractFactory("TestERC20");
        // usdc = await TestERC20.deploy();
        // busd = await TestERC20.deploy();
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
        //console.log("lastBlock:" + lastBlock)
        const RewardPool = await ethers.getContractFactory("RewardPool");
        rewardPool = await RewardPool.deploy(checkOper.address, fxs.address, "100000", parseInt(lastBlock), 10);

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);
        await frax.addPool(rewardPool.address)
        await frax.addPool(owner.address)
        //await fxs.poolMint(rewardPool.address,toWei('100'))

        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(usdc.address);

        const DummyToken = await ethers.getContractFactory('DummyToken');
        dummyToken = await DummyToken.deploy();
        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkOper.address,
            lock.address,
            fxs.address,
            "10000",
            parseInt(lastBlock),
            10
        );


    });

    it('should withdraw correct', async () => {
        console.log("boost" + boost.address)

    });


});