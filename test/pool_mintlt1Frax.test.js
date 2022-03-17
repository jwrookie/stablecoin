const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {toWei} = web3.utils;
const Factory = require('../test/mock/PancakeFactory.json');
const Pair = require('../test/mock/PancakePair.json');
const Router = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
const {BigNumber} = require('ethers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('Pool_USDC', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        weth = await deployContract(owner, {
            bytecode: WETH.bytecode,
            abi: WETH.abi,
        });

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await Timelock.deploy(owner.address, "259200");

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");
        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        assert.equal(await fxs.oracle(), oracle.address);
        assert.equal(await frax.fxsAddress(), fxs.address);

        const FraxPoolLibrary = await ethers.getContractFactory('FraxPoolLibrary')
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });
        pool = await Pool_USDC.deploy(frax.address, fxs.address, usdc.address, toWei('100'));
        assert.equal(await pool.USDC_address(), usdc.address);


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        assert.equal(await fxs.balanceOf(owner.address), toWei('100000000'));
        assert.equal(await frax.balanceOf(owner.address), toWei('2000000'));
        await usdc.mint(owner.address, toWei('1'));

        await frax.approve(pool.address, toWei('1000'));
        await fxs.approve(pool.address, toWei('1000'));
        await usdc.approve(pool.address, toWei('1000'));
        await frax.addPool(pool.address);

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: Factory.abi
        }, [owner.address]);
        // console.log("factory:" + factory.address)

        pair = await deployContract(owner, {
            bytecode: Pair.bytecode,
            abi: Pair.abi
        });

        router = await deployContract(owner, {
            bytecode: Router.bytecode,
            abi: Router.abi
        }, [factory.address, weth.address]);
        // console.log("router:" + router.address)

        await factory.createPair(usdc.address, weth.address)
        pairAddr = await factory.getPair(usdc.address, weth.address)
        // console.log("pair:" + pairAddr)
        usdc_busd = await pair.attach(pairAddr)
        assert.equal(usdc_busd.address, pairAddr)


        await usdc.approve(router.address, toWei('1000'))
        await weth.approve(router.address, toWei('1000'))
        await usdc.mint(owner.address, toWei('100'))
        //await busd.mint(owner.address, toWei('100'))
        await weth.deposit({value: toWei('100')})
        assert.equal(await weth.balanceOf(owner.address), toWei('100'));


        await router.addLiquidity(
            usdc.address,
            weth.address,
            toWei('1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address, owner.address, timelock.address);
        await pool.setCollatETHOracle(uniswapOracle.address, weth.address);

        await frax.setFRAXEthOracle(uniswapOracle.address, weth.address);
        assert.equal(await frax.fraxEthOracleAddress(), uniswapOracle.address);

        await frax.setFXSEthOracle(uniswapOracle.address, weth.address);
        assert.equal(await frax.fxsEthOracleAddress(), uniswapOracle.address)


    });

    it('test mint1t1FRAX and redeem1t1FRAX  ', async () => {
        assert.equal(await frax.ethUsdPrice(), "100000000");
        assert.equal(await uniswapOracle.price0Average(), 0);
        assert.equal(await uniswapOracle.price1Average(), 0);

        await uniswapOracle.setPeriod(1);
        await uniswapOracle.update();
        let consults = await uniswapOracle.consult(weth.address, toWei('100000'));
        console.log("consults:" + consults);

        console.log("price0Average:" + await uniswapOracle.price0Average());
        console.log("price1Average:" + await uniswapOracle.price1Average());
        assert.equal(await pool.getCollateralPrice(), "100000000");

        assert.equal(await usdc.balanceOf(owner.address), toWei('100'));
        assert.equal(await frax.balanceOf(owner.address), toWei('2000000'));
        assert.equal(await usdc.balanceOf(pool.address), 0);

        await pool.mint1t1FRAX("1000", 0);
        assert.equal(await usdc.balanceOf(owner.address), "99999999999999999000");
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000100000");
        assert.equal(await usdc.balanceOf(pool.address), "1000");

        await pool.redeem1t1FRAX("100000", 0);
        assert.equal(await usdc.balanceOf(owner.address), "99999999999999999000");
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000000000");
        assert.equal(await usdc.balanceOf(pool.address), "1000");


    });
    it('test mintAlgorithmicFRAX and redeemAlgorithmicFRAX ', async () => {
        await uniswapOracle.setPeriod(1);
        await uniswapOracle.update();

        assert.equal(await frax.balanceOf(owner.address), toWei('2000000'));
        assert.equal(await fxs.balanceOf(owner.address), toWei('100000000'));

        assert.equal(await frax.fxsPrice(), "100000000");
        assert.equal(await frax.globalCollateralRatio(), "1000000");
        assert.equal(await frax.fraxStep(), "2500");

        await frax.setFraxStep("2500000");
        assert.equal(await frax.fraxStep(), "2500000");
        await frax.refreshCollateralRatio();

        assert.equal(await frax.globalCollateralRatio(), 0);

        await pool.mintAlgorithmicFRAX("1000", "100");
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000100000");
        assert.equal(await fxs.balanceOf(owner.address), "99999999999999999999999000");

        await pool.redeemAlgorithmicFRAX("1000", 0);
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000099000");
        assert.equal(await fxs.balanceOf(owner.address), "99999999999999999999999000");


    });
    it('test mintFractionalFRAX and redeemFractionalFRAX ', async () => {
        await uniswapOracle.setPeriod(1);
        await uniswapOracle.update();

        assert.equal(await usdc.balanceOf(owner.address), toWei('100'));
        assert.equal(await frax.balanceOf(owner.address), toWei('2000000'));
        assert.equal(await fxs.balanceOf(owner.address), toWei('100000000'));
        assert.equal(await fxs.balanceOf(pool.address), 0);
        assert.equal(await usdc.balanceOf(pool.address), 0);

        assert.equal(await frax.fxsPrice(), "100000000");
        assert.equal(await frax.globalCollateralRatio(), "1000000");
        await frax.setFraxStep("250000");
        await frax.refreshCollateralRatio();
        assert.equal(await frax.globalCollateralRatio(), "750000");

        await pool.mintFractionalFRAX("1000", "1000", 0);
        assert.equal(await usdc.balanceOf(owner.address), "99999999999999999000");
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000133333");
        assert.equal(await fxs.balanceOf(owner.address), "99999999999999999999999667");
        assert.equal(await fxs.balanceOf(pool.address), 0);
        assert.equal(await usdc.balanceOf(pool.address), "1000");

        await pool.redeemFractionalFRAX("100000", 0, 0);
        assert.equal(await usdc.balanceOf(owner.address), "99999999999999999000");
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000033333");
        assert.equal(await fxs.balanceOf(owner.address), "99999999999999999999999667");
        assert.equal(await fxs.balanceOf(pool.address), "250");
        assert.equal(await usdc.balanceOf(pool.address), "1000");


    });

});
